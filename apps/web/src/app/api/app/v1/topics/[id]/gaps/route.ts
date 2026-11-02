import { endpoints } from '@app/contract'
import { createAppRoute, notFound } from '@/server/api/app-route'
import { gapStore } from '@/server/db/gaps'
import { topicStore } from '@/server/db/topics'
import { toTopicGaps } from '@/server/gaps/topic-gaps'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/topics/:id/gaps: this person's gaps on one video.
 * Another person's topic, or one that does not exist, is not found.
 * A topic with no gaps is an empty list, not an error.
 */
export const GET = createAppRoute(endpoints.listTopicGaps, async ({ user, params }) => {
	const topic = await topicStore.findById(user.id, params.id)
	if (!topic) throw notFound()
	const rows = await gapStore.listForTopic(user.id, topic.id)
	return { body: toTopicGaps(topic.title, rows) }
})
