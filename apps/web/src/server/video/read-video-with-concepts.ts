import 'server-only'
import type { Video } from '@app/contract'
import { isLocalDemoUser } from '@/server/demo/local-demo'
import { topicStore, type TopicRecord } from '@/server/db/topics'
import { findKeyConcepts } from './find-key-concepts'
import {
	assertPasteLength,
	demoConceptsFromPaste,
	pasteTopicId,
	segmentsFromPaste,
	titleFromPaste
} from './paste-text'
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

// Local demo only: YouTube is blocked from this machine, so the skip-auth path uses a short
// fixture transcript. Scoring and the class still call Gemini for real.
type DemoLesson = {
	title: string
	segments: { startSeconds: number; text: string }[]
	concepts: { title: string; quote: string; startSeconds: number }[]
}

const WORKING_MEMORY_DEMO: DemoLesson = {
	title: 'How working memory works (demo)',
	segments: [
		{
			startSeconds: 0,
			text: 'Working memory is the mental workspace you use to hold and work with information right now.'
		},
		{
			startSeconds: 18,
			text: 'It is limited. Most people can keep only about four chunks of information in mind at once.'
		},
		{
			startSeconds: 36,
			text: 'Attention decides what enters working memory. If attention slips, the information is gone.'
		},
		{
			startSeconds: 54,
			text: 'You can free space by chunking related ideas into one unit, like remembering a phone number in groups.'
		}
	],
	concepts: [
		{
			title: 'Working memory',
			quote: 'mental workspace you use to hold and work with information',
			startSeconds: 0
		},
		{
			title: 'Limited capacity',
			quote: 'only about four chunks of information in mind at once',
			startSeconds: 18
		},
		{
			title: 'Attention gate',
			quote: 'Attention decides what enters working memory',
			startSeconds: 36
		},
		{
			title: 'Chunking',
			quote: 'chunking related ideas into one unit',
			startSeconds: 54
		}
	]
}

// Second demo lesson (e.g. youtube.com/watch?v=sQKbsXmxsfo) so a full cycle can show a
// different topic and mixed scoring without needing a live YouTube fetch.
const PHOTOSYNTHESIS_DEMO: DemoLesson = {
	title: 'How plants make food (demo)',
	segments: [
		{
			startSeconds: 0,
			text: 'Photosynthesis is how plants make their own food using light, water, and carbon dioxide.'
		},
		{
			startSeconds: 22,
			text: 'Chlorophyll in the leaves captures sunlight and starts the reaction.'
		},
		{
			startSeconds: 44,
			text: 'The plant takes in carbon dioxide from the air and water from the roots.'
		},
		{
			startSeconds: 66,
			text: 'The process releases oxygen and stores energy as sugar the plant can use later.'
		}
	],
	concepts: [
		{
			title: 'Photosynthesis',
			quote: 'plants make their own food using light, water, and carbon dioxide',
			startSeconds: 0
		},
		{
			title: 'Chlorophyll',
			quote: 'Chlorophyll in the leaves captures sunlight',
			startSeconds: 22
		},
		{
			title: 'Raw materials',
			quote: 'carbon dioxide from the air and water from the roots',
			startSeconds: 44
		},
		{
			title: 'Oxygen and sugar',
			quote: 'releases oxygen and stores energy as sugar',
			startSeconds: 66
		}
	]
}

function demoLessonFor(youtubeId: string): DemoLesson {
	if (youtubeId === 'sQKbsXmxsfo') return PHOTOSYNTHESIS_DEMO
	return WORKING_MEMORY_DEMO
}

/**
 * The whole "add a video" step, shaped for the wire. A video is read once per person: adding
 * it again returns the stored topic and spends no AI call.
 */
export async function readVideoWithConcepts(userId: string, url: string): Promise<Video> {
	const youtubeId = parseYouTubeVideoId(url)
	const stored = youtubeId ? await topicStore.find(userId, youtubeId) : null
	if (stored) return toWireVideo(stored)

	if (isLocalDemoUser(userId)) {
		const videoId = youtubeId ?? 'demo-local-video'
		const lesson = demoLessonFor(videoId)
		return toWireVideo(
			await topicStore.save(userId, {
				youtubeId: videoId,
				title: lesson.title,
				segments: lesson.segments,
				concepts: lesson.concepts
			})
		)
	}

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
	const concepts = isLocalDemoUser(userId)
		? demoConceptsFromPaste(segments)
		: (await findKeyConcepts(youtubeId, segments)).concepts.map((concept) => ({
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
