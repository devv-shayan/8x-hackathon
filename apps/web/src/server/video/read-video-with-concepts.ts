import 'server-only'
import type { Video } from '@app/contract'
import { topicStore, type TopicRecord } from '@/server/db/topics'
import { findKeyConcepts } from './find-key-concepts'
import { assertPasteLength, pasteTopicId, segmentsFromPaste, titleFromPaste } from './paste-text'
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
			// The wire still requires a number. A paste has no moment in a video; the
			// app hides the time when the topic id says it was pasted.
			start_seconds: startSeconds ?? 0
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

/**
 * A lesson from text the person pasted, used when the video itself can't be read.
 * Concepts keep the quotes and drop the timestamp: there is nothing to point at.
 */
export async function readPastedText(userId: string, text: string): Promise<Video> {
	assertPasteLength(text)
	const youtubeId = pasteTopicId(text)
	const stored = await topicStore.find(userId, youtubeId)
	if (stored) return toWireVideo(stored)

	const segments = segmentsFromPaste(text)
	const concepts = (await findKeyConcepts(youtubeId, segments)).concepts.map((concept) => ({
		...concept,
		startSeconds: null
	}))
	return toWireVideo(
		await topicStore.save(userId, {
			youtubeId,
			title: titleFromPaste(text),
			segments,
			concepts
		})
	)
}
