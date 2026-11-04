import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { keyConceptSchema, type KeyConcept } from '@/server/video/key-concepts'
import { transcriptSegmentSchema, type TranscriptSegment } from '@/server/video/transcript'
import { db } from './client'

// The person's topics (prisma/schema/learning.prisma). Every method takes the user id the
// route verified (requireUser), never one from the request, and scopes every query by it.
//
// Transcripts and concepts are JSON columns, so what comes back is parsed: a row that no
// longer matches is an error, never a partial topic.

export type NewTopic = {
	youtubeId: string
	title: string
	segments: TranscriptSegment[]
	concepts: KeyConcept[]
}

export type TopicRecord = NewTopic & { id: string }

/** Home's recent list: no transcript or concepts. */
export type TopicListItem = {
	id: string
	youtubeId: string
	title: string
}

const RECENT_TOPICS_LIMIT = 20

const storedContentSchema = z.object({
	segments: z.array(transcriptSegmentSchema),
	concepts: z.array(keyConceptSchema)
})

const TOPIC = {
	id: true,
	youtubeId: true,
	title: true,
	segments: true,
	concepts: true
} as const

const TOPIC_LIST = {
	id: true,
	youtubeId: true,
	title: true
} as const

type TopicRow = {
	id: string
	youtubeId: string
	title: string
	segments: unknown
	concepts: unknown
}

function toRecord({ id, youtubeId, title, segments, concepts }: TopicRow): TopicRecord {
	return { id, youtubeId, title, ...storedContentSchema.parse({ segments, concepts }) }
}

export function createTopicStore(client: Pick<PrismaClient, 'topic'>) {
	return {
		/** The person's topic for a video, or null if they haven't added it. */
		async find(userId: string, youtubeId: string): Promise<TopicRecord | null> {
			const row = await client.topic.findUnique({
				where: { userId_youtubeId: { userId, youtubeId } },
				select: TOPIC
			})
			return row ? toRecord(row) : null
		},

		/** One of the person's topics by id, or null. */
		async findById(userId: string, id: string): Promise<TopicRecord | null> {
			const row = await client.topic.findFirst({ where: { id, userId }, select: TOPIC })
			return row ? toRecord(row) : null
		},

		/** Newest topics first. Title and youtube id only — no transcript. */
		async list(userId: string): Promise<TopicListItem[]> {
			return client.topic.findMany({
				where: { userId },
				orderBy: { createdAt: 'desc' },
				take: RECENT_TOPICS_LIMIT,
				select: TOPIC_LIST
			})
		},

		/**
		 * Marks one concept as not in the video. `already` when it was marked
		 * before; `missing` when this topic has no concept with that title.
		 */
		async markNotInVideo(
			userId: string,
			topicId: string,
			title: string
		): Promise<'marked' | 'already' | 'missing'> {
			const row = await client.topic.findFirst({ where: { id: topicId, userId }, select: TOPIC })
			const topic = row ? toRecord(row) : null
			if (!topic) return 'missing'
			const match = topic.concepts.find((concept) => concept.title === title)
			if (!match) return 'missing'
			if (match.notInVideo === true) return 'already'
			await client.topic.update({
				where: { id: topic.id },
				data: {
					concepts: topic.concepts.map((concept) =>
						concept.title === title ? { ...concept, notInVideo: true } : concept
					)
				}
			})
			return 'marked'
		},

		/** Saves a topic. If two reads of one video raced, the first one saved wins. */
		async save(userId: string, topic: NewTopic): Promise<TopicRecord> {
			const row = await client.topic.upsert({
				where: { userId_youtubeId: { userId, youtubeId: topic.youtubeId } },
				update: {},
				create: { userId, ...topic },
				select: TOPIC
			})
			return toRecord(row)
		}
	}
}

export type TopicStore = ReturnType<typeof createTopicStore>

export const topicStore = createTopicStore(db)
