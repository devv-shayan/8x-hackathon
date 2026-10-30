import 'server-only'
import { z } from 'zod'
import { generateContent } from '@/server/ai/gemini'
import { AppError } from '@/lib/errors/app-error'
import {
	parseTranscript,
	parseYouTubeVideoId,
	TRANSCRIPT_RESPONSE_JSON_SCHEMA,
	type TranscriptSegment
} from '@/lib/video/transcript'

// Static mode, not agentic: it was the fastest in our comparison and its
// timestamps were the more reliable, and a transcript needs the whole video
// anyway, so agentic's skipping saves nothing we can use.
const TRANSCRIPT_MODEL = 'gemini-3.5-flash-lite'
const MAX_TRANSCRIPT_TOKENS = 65536
const OEMBED_URL = 'https://www.youtube.com/oembed'
const BUSY_STATUSES = [429, 503]

const TRANSCRIPT_PROMPT = [
	'Transcribe everything spoken in this video, word for word, from the very start to the very end.',
	'Do not summarise or skip anything.',
	'Split it into segments of one or two sentences.',
	'Give each segment the MM:SS time it starts in the video (H:MM:SS past the first hour).',
	'If nobody speaks in the video, return no segments. Never invent speech.'
].join(' ')

const oembedSchema = z.object({ title: z.string() })

export type VideoTranscript = {
	videoId: string
	title: string
	segments: TranscriptSegment[]
}

/**
 * YouTube link in, title and timestamped transcript out. Call it once per
 * video and store the result: every later step reads the stored transcript.
 * Throws an AppError, with a message fit to show, for anything the user can
 * act on.
 */
export async function readVideo(url: string): Promise<VideoTranscript> {
	const videoId = parseYouTubeVideoId(url)
	if (!videoId) {
		throw new AppError("That doesn't look like a YouTube video link.", {
			code: 'video_invalid_url'
		})
	}
	const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
	const title = await fetchTitle(watchUrl)
	const raw = await transcribe(watchUrl, videoId)
	return { videoId, title, segments: parseTranscript(raw) }
}

// Doubles as the availability check, so a private or removed video costs no
// Gemini call.
async function fetchTitle(watchUrl: string): Promise<string> {
	const params = new URLSearchParams({ url: watchUrl, format: 'json' })
	const response = await fetch(`${OEMBED_URL}?${params}`)
	if (!response.ok) {
		throw new AppError("We can't open this video. It may be private or removed.", {
			code: 'video_unavailable',
			status: 422,
			message: `YouTube oEmbed returned ${response.status}`
		})
	}
	return oembedSchema.parse(await response.json()).title
}

async function transcribe(watchUrl: string, videoId: string) {
	try {
		const response = await generateContent(
			{ feature: 'video_transcript', model: TRANSCRIPT_MODEL, meta: { video_id: videoId } },
			{
				contents: [{ fileData: { fileUri: watchUrl } }, { text: TRANSCRIPT_PROMPT }],
				temperature: 0,
				maxOutputTokens: MAX_TRANSCRIPT_TOKENS,
				responseMimeType: 'application/json',
				responseJsonSchema: TRANSCRIPT_RESPONSE_JSON_SCHEMA
			}
		)
		return response.text
	} catch (error) {
		throw toVideoError(error)
	}
}

function toVideoError(error: unknown): unknown {
	const status = z.object({ status: z.number() }).safeParse(error).data?.status
	if (status !== undefined && BUSY_STATUSES.includes(status)) {
		return new AppError('Reading videos is busy right now. Please try again in a minute.', {
			code: 'video_read_busy',
			status: 503,
			cause: error
		})
	}
	// An unlisted video passes the oEmbed check and only fails here.
	if (status === 400 || status === 403) {
		return new AppError("We can't read this video. Public videos work best.", {
			code: 'video_unreadable',
			status: 422,
			cause: error
		})
	}
	return error
}
