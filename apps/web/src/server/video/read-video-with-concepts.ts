import 'server-only'
import type { Video } from '@app/contract'
import { findKeyConcepts } from './find-key-concepts'
import { readVideo } from './read-video'

/** The whole "add a video" step, shaped for the wire. */
export async function readVideoWithConcepts(url: string): Promise<Video> {
	const { videoId, title, segments } = await readVideo(url)
	const { concepts } = await findKeyConcepts(videoId, segments)
	return {
		youtube_id: videoId,
		title,
		segments: segments.map(({ startSeconds, text }) => ({ start_seconds: startSeconds, text })),
		concepts: concepts.map(({ startSeconds, ...concept }) => ({
			...concept,
			start_seconds: startSeconds
		}))
	}
}
