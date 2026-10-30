import type { TranscriptSegment } from './transcript'

// Turns a YouTube caption file (WebVTT) into transcript segments. Nothing here calls anything;
// youtube-info.ts is what fetches the file.

// A segment closes at the end of a sentence once it has run this long, or at this ceiling
// when the captions have no punctuation, which auto-generated ones often don't.
const MIN_SEGMENT_SECONDS = 5
const MAX_SEGMENT_SECONDS = 20

const SECONDS_PER_MINUTE = 60
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

/** A caption file's speech as transcript segments. Empty if the file has none. */
export function parseCaptions(vtt: string): TranscriptSegment[] {
	const segments: TranscriptSegment[] = []
	let current: TranscriptSegment | null = null
	for (const { startSeconds, text } of readLines(vtt)) {
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
