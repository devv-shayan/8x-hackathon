import { z } from 'zod'
import type { TranscriptSegment } from './transcript'

// Turns YouTube captions into transcript segments: a caption file (WebVTT) from yt-dlp, or timed
// chunks from Supadata. Nothing here calls anything; youtube-info.ts and supadata.ts fetch them.

// A segment closes at the end of a sentence once it has run this long, or at this ceiling
// when the captions have no punctuation, which auto-generated ones often don't.
const MIN_SEGMENT_SECONDS = 5
const MAX_SEGMENT_SECONDS = 20

const SECONDS_PER_MINUTE = 60
const MS_PER_SECOND = 1000
const CUE_TIMING = /^(\d+):(\d{2}):(\d{2})\.\d{3} --> /
const SENTENCE_END = /[.?!]["')\]]?$/
const INLINE_TAG = /<[^>]*>/g
const SOUND_LABEL = /\[[^\]]*\]/g
const SPEAKER_MARK = /^(?:>>|&gt;&gt;)\s*/
const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&nbsp;': ' '
}

type CaptionLine = { startSeconds: number; text: string }

function cleanLine(line: string): string {
	return line
		.replace(INLINE_TAG, '')
		.replace(SPEAKER_MARK, '')
		.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
		.replace(SOUND_LABEL, '')
		.replace(/\s+/g, ' ')
		.trim()
}

// Auto-generated captions roll: each cue repeats the line before it and adds the next one, so
// a line counts once, at the first cue that shows it.
function readLines(vtt: string): CaptionLine[] {
	const lines: CaptionLine[] = []
	for (const block of vtt.replace(/\r/g, '').split(/\n{2,}/)) {
		const [timing, ...cue] = block.split('\n')
		const time = timing?.match(CUE_TIMING)
		if (!time) continue
		const [, hours, minutes, seconds] = time.map(Number)
		const startSeconds =
			((hours ?? 0) * SECONDS_PER_MINUTE + (minutes ?? 0)) * SECONDS_PER_MINUTE + (seconds ?? 0)
		for (const line of cue.map(cleanLine)) {
			if (line && line !== lines.at(-1)?.text) lines.push({ startSeconds, text: line })
		}
	}
	return lines
}

function toSegments(lines: CaptionLine[]): TranscriptSegment[] {
	const segments: TranscriptSegment[] = []
	let current: TranscriptSegment | null = null
	for (const { startSeconds, text } of lines) {
		current = current
			? { startSeconds: current.startSeconds, text: `${current.text} ${text}` }
			: { startSeconds, text }
		const elapsed = startSeconds - current.startSeconds
		const closes =
			elapsed >= MAX_SEGMENT_SECONDS || (elapsed >= MIN_SEGMENT_SECONDS && SENTENCE_END.test(text))
		if (closes) {
			segments.push(current)
			current = null
		}
	}
	if (current) segments.push(current)
	return segments
}

/** A caption file's speech as transcript segments. Empty if the file has none. */
export function parseCaptions(vtt: string): TranscriptSegment[] {
	return toSegments(readLines(vtt))
}

export const timedCaptionSchema = z.object({ text: z.string(), offset: z.number().nonnegative() })

/** Timed chunks, with their offsets in milliseconds, as transcript segments, one each. */
export function parseTimedCaptions(
	captions: z.infer<typeof timedCaptionSchema>[]
): TranscriptSegment[] {
	const segments = captions.map(({ text, offset }) => ({
		startSeconds: Math.floor(offset / MS_PER_SECOND),
		text: cleanLine(text)
	}))
	return segments.filter(({ text }) => text)
}
