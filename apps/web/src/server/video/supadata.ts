import 'server-only'
import { z } from 'zod'
import { log } from '@/server/lib/logger'
import { parseTimedCaptions, timedCaptionSchema } from './captions'
import type { YouTubeInfo } from './youtube-info'

// A video's title, length and captions, through Supadata. YouTube refuses yt-dlp from cloud
// servers, and Supadata fetches from addresses it doesn't. Best effort like yt-dlp: a missing
// key or a failed call leaves a gap for read-video.ts to fill, so nothing here throws.

const API_URL = 'https://api.supadata.ai/v1'
const TIMEOUT_MS = 30_000
// The free plan answers about one request a second, and a 429 passes once that second is up.
const RATE_LIMIT_WAIT_MS = 1_200
// About 10 seconds of speech. Its default chunks run 25, too coarse for a concept's timestamp.
const CHUNK_CHARACTERS = '100'

const metadataSchema = z.object({
	title: z.string().nullish(),
	media: z.object({ duration: z.number().nullish() }).nullish()
})

// A long job comes back as a job id instead. Gemini covers those, so they aren't polled.
const transcriptSchema = z.object({ content: z.array(timedCaptionSchema) })

async function get(path: string, params: Record<string, string>, apiKey: string) {
	const request = () =>
		fetch(`${API_URL}/${path}?${new URLSearchParams(params)}`, {
			headers: { 'x-api-key': apiKey },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		})
	let response = await request()
	if (response.status === 429) {
		await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS))
		response = await request()
	}
	if (!response.ok) throw new Error(`Supadata answered ${response.status}`)
	return response.json()
}

async function bestEffort<T>(videoId: string, request: () => Promise<T>): Promise<T | null> {
	try {
		return await request()
	} catch (error) {
		log.warn('supadata call failed', {
			source: 'video/supadata',
			video_id: videoId,
			error: error instanceof Error ? error.message : String(error)
		})
		return null
	}
}

/** What Supadata can tell us about a video, or null if it couldn't tell us anything. */
export async function fetchSupadataInfo(videoId: string): Promise<YouTubeInfo | null> {
	const apiKey = process.env.SUPADATA_API_KEY
	if (!apiKey) return null
	const url = `https://www.youtube.com/watch?v=${videoId}`
	// One at a time, for the rate limit. `native` is YouTube's own captions only: Gemini
	// transcribes the videos without any.
	const transcript = await bestEffort(videoId, async () =>
		transcriptSchema.parse(
			await get(
				'transcript',
				{ url, lang: 'en', mode: 'native', chunkSize: CHUNK_CHARACTERS },
				apiKey
			)
		)
	)
	const metadata = await bestEffort(videoId, async () =>
		metadataSchema.parse(await get('metadata', { url }, apiKey))
	)
	if (!metadata?.title) return null
	const segments = transcript ? parseTimedCaptions(transcript.content) : []
	log.info('video info read', {
		source: 'video/supadata',
		video_id: videoId,
		has_captions: segments.length > 0
	})
	return {
		title: metadata.title,
		durationSeconds: metadata.media?.duration ?? null,
		segments: segments.length > 0 ? segments : null,
		captionsRateLimited: false
	}
}
