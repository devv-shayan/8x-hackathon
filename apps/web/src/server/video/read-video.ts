import 'server-only'
import { z } from 'zod'
import { generateContent, isGeminiBusy } from '@/server/ai/gemini'
import { ApiError } from '@/server/api/app-errors'
import {
	assertTranscriptFinished,
	assertVideoLength,
	parseTranscript,
	parseYouTubeVideoId,
	TRANSCRIPT_RESPONSE_JSON_SCHEMA,
	type TranscriptSegment
} from './transcript'
import { fetchSupadataInfo } from './supadata'
import { fetchYouTubeInfo, type YouTubeInfo } from './youtube-info'

// Static mode, not agentic: it was the fastest in our comparison and its
// timestamps were the more reliable, and a transcript needs the whole video
// anyway, so agentic's skipping saves nothing we can use.
const TRANSCRIPT_MODEL = 'gemini-3.5-flash-lite'
const OEMBED_URL = 'https://www.youtube.com/oembed'

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
 *
 * In production Gemini reads the video first, and Supadata's captions step in when it can't.
 * Elsewhere captions come first: they arrive in seconds, cost no tokens, and their timestamps
 * are YouTube's own. Gemini reads the video when there are none, or when neither yt-dlp nor
 * Supadata can get them.
 *
 * Throws an ApiError, with a message fit to show, for anything the user can
 * act on.
 */
export async function readVideo(url: string): Promise<VideoTranscript> {
	const videoId = parseYouTubeVideoId(url)
	if (!videoId) {
		throw new ApiError('invalid_request', "That doesn't look like a YouTube video link.")
	}
	const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
	if (process.env.NODE_ENV === 'production') return readGeminiFirst(videoId, watchUrl)
	const info = await fetchInfo(videoId)
	assertCanRead(info)
	const title = info?.title ?? (await fetchTitle(watchUrl))
	const segments = info?.segments ?? parseTranscript(await transcribe(watchUrl, videoId))
	return { videoId, title, segments }
}

// The title check can refuse a video and Gemini can refuse to transcribe one, or find it too
// long without captions. Captions may still get through, so the error stands only if they don't.
async function readGeminiFirst(videoId: string, watchUrl: string): Promise<VideoTranscript> {
	try {
		const title = await fetchTitle(watchUrl)
		return { videoId, title, segments: parseTranscript(await transcribe(watchUrl, videoId)) }
	} catch (error) {
		const info = await fetchSupadataInfo(videoId)
		if (!info?.segments) throw error
		assertVideoLength(info.durationSeconds, true)
		return { videoId, title: info.title, segments: info.segments }
	}
}

// yt-dlp costs nothing, so it goes first. Supadata covers the times YouTube refuses it, which on
// a cloud server is always.
async function fetchInfo(videoId: string): Promise<YouTubeInfo | null> {
	const info = await fetchYouTubeInfo(videoId)
	if (info && !info.captionsRateLimited) return info
	return (await fetchSupadataInfo(videoId)) ?? info
}

function assertCanRead(info: YouTubeInfo | null) {
	try {
		assertVideoLength(info?.durationSeconds ?? null, Boolean(info?.segments))
	} catch (error) {
		// Too long only without captions, and those may just be a retry away.
		if (!info?.captionsRateLimited) throw error
		throw new ApiError('unavailable', 'Reading videos is busy right now. Try again in a minute.')
	}
}

// For when yt-dlp can't help. Doubles as the availability check, so a private or
// removed video costs no Gemini call. YouTube answers it the same way for a video
// that turns off embedding, so some public videos stop here too.
async function fetchTitle(watchUrl: string): Promise<string> {
	const params = new URLSearchParams({ url: watchUrl, format: 'json' })
	const response = await fetch(`${OEMBED_URL}?${params}`)
	if (!response.ok) {
		throw new ApiError(
			'video_unreadable',
			"We can't open this video. It may be private, removed or blocked from other apps."
		)
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
				responseMimeType: 'application/json',
				responseJsonSchema: TRANSCRIPT_RESPONSE_JSON_SCHEMA
			}
		)
		assertTranscriptFinished(response.candidates?.[0]?.finishReason)
		return response.text
	} catch (error) {
		throw toVideoError(error)
	}
}

export function toVideoError(error: unknown): unknown {
	if (error instanceof ApiError) return error
	if (isGeminiBusy(error)) {
		return new ApiError('unavailable', 'Reading videos is busy right now. Try again in a minute.', {
			cause: error
		})
	}
	// An unlisted video passes the oEmbed check and only fails here.
	const status = z.object({ status: z.number() }).safeParse(error).data?.status
	if (status === 400 || status === 403) {
		return new ApiError('video_unreadable', "We can't read this video. Public videos work best.", {
			cause: error
		})
	}
	return error
}
