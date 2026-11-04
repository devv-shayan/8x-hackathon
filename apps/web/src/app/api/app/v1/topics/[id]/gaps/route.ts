import { endpoints } from '@app/contract'
import { createAppRoute, notFound } from '@/server/api/app-route'
import { classStore } from '@/server/db/classes'
import { gapStore } from '@/server/db/gaps'
import { topicStore } from '@/server/db/topics'
import { scoresOf, topicGaps } from '@/server/topics/progress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/topics/:id/gaps: one video's page. The scores of its latest finished class
 * and every idea missed in it, with when each comes back. Only the person's own topic: anyone
 * else's is a 404.
 */
export const GET = createAppRoute(endpoints.getTopicGaps, async ({ user, params }) => {
	const topic = await topicStore.findById(user.id, params.id)
	if (!topic) throw notFound()
	const [finished, gaps] = await Promise.all([
		classStore.latestFinishedForTopics(user.id, [topic.id]),
		gapStore.listForTopics(user.id, [topic.id])
	])
	const latest = finished.get(topic.id)
	const results = latest?.conceptResults ?? []
	const { explanation, afterClass } = scoresOf(results)
	return {
		body: {
			topic: { id: topic.id, title: topic.title, youtube_id: topic.youtubeId },
			taught_at: latest ? latest.createdAt.toISOString() : null,
			explanation_score: explanation,
			after_class_score: afterClass,
			gaps: topicGaps(gaps.get(topic.id) ?? [], results)
		}
	}
})
