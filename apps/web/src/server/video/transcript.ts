import { z } from 'zod'
import { ApiError } from '@/server/api/app-errors'

// The shape of a video transcript and the rules for accepting one. Nothing
// here calls anything, so all of it is unit-testable; read-video.ts is what
// talks to YouTube and Gemini.

// The brief leaves the real limit as an open decision. An hour keeps a single
// read well inside the model's output limit.
const MAX_VIDEO_SECONDS = 60 * 60

const SECONDS_PER_MINUTE = 60
const YOUTUBE_ID = /^[\w-]{11}$/
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const ID_PATH_PREFIXES = ['embed', 'shorts', 'live']

export const transcriptSegmentSchema = z.object({
	startSeconds: z.number().int().nonnegative(),
	text: z.string().min(1)
})

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>

// What the model is asked to return. Timestamps stay strings at this boundary
// because that is what the model writes reliably; parseTranscript turns them
// into seconds so nothing downstream has to.
export const TRANSCRIPT_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: {
		segments: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					start: { type: 'string', description: 'MM:SS or H:MM:SS' },
					text: { type: 'string' }
				},
				required: ['start', 'text']
			}
		}
	},
	required: ['segments']
}

const transcriptResponseSchema = z.object({
	segments: z.array(z.object({ start: z.string(), text: z.string() }))
})

export function parseYouTubeVideoId(input: string): string | null {
	let url: URL
	try {
		url = new URL(input.trim())
	} catch {
		return null
	}
	const [first, second] = url.pathname.split('/').filter(Boolean)
	const id =
		url.hostname === 'youtu.be'
			? first
			: !YOUTUBE_HOSTS.has(url.hostname)
				? undefined
				: first === 'watch'
					? url.searchParams.get('v')
					: ID_PATH_PREFIXES.includes(first ?? '')
						? second
						: undefined
	return id && YOUTUBE_ID.test(id) ? id : null
}

export function parseTimestamp(timestamp: string): number | null {
	const parts = timestamp.trim().split(':')
	const isValid = (parts.length === 2 || parts.length === 3) && parts.every((p) => /^\d+$/.test(p))
	if (!isValid) return null
	return parts.reduce((total, part) => total * SECONDS_PER_MINUTE + Number(part), 0)
}

/**
 * Turns the model's raw reply into segments. A malformed reply is a bug or an
 * outage, so it throws plainly; a video with no speech or one over the limit
 * is the user's to fix, so those are ApiErrors.
 */
export function parseTranscript(raw: string | undefined): TranscriptSegment[] {
	const { segments } = transcriptResponseSchema.parse(JSON.parse(raw ?? ''))
	const transcript = segments.flatMap(({ start, text }) => {
		const startSeconds = parseTimestamp(start)
		if (startSeconds === null) throw new Error(`Unreadable transcript timestamp: ${start}`)
		const trimmed = text.trim()
		return trimmed ? [{ startSeconds, text: trimmed }] : []
	})

	const last = transcript.at(-1)
	if (!last) {
		throw new ApiError(
			'video_unreadable',
			"We couldn't find any speech in this video. Try another one."
		)
	}
	if (last.startSeconds > MAX_VIDEO_SECONDS) {
		throw new ApiError('video_unreadable', 'This video is too long. Try one under an hour.')
	}
	return transcript
}
