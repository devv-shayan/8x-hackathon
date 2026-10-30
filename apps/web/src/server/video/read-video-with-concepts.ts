import 'server-only'
import type { Video } from '@app/contract'
import { topicStore, type TopicRecord } from '@/server/db/topics'
import { findKeyConcepts } from './find-key-concepts'
import { readVideo } from './read-video'
import { parseYouTubeVideoId } from './transcript'

function toWireVideo({ id, youtubeId, title, segments, concepts }: TopicRecord): Video {
	return {
		id,
		youtube_id: youtubeId,
		title,
		segments: segments.map(({ startSeconds, text }) => ({ start_seconds: startSeconds, text })),
		concepts: concepts.map(({ startSeconds, ...concept }) => ({
			...concept,
			start_seconds: startSeconds
		}))
	}
}

/**
 * The whole "add a video" step, shaped for the wire. A video is read once per person: adding
 * it again returns the stored topic and spends no AI call.
 */
export async function readVideoWithConcepts(userId: string, url: string): Promise<Video> {
	const youtubeId = parseYouTubeVideoId(url)
	const stored = youtubeId ? await topicStore.find(userId, youtubeId) : null
	if (stored) return toWireVideo(stored)

	const { videoId, title, segments } = await readVideo(url)
	const { concepts } = await findKeyConcepts(videoId, segments)
	return toWireVideo(
		await topicStore.save(userId, { youtubeId: videoId, title, segments, concepts })
	)
}
