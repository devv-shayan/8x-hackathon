import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { classStore } from '@/server/db/classes'
import { topicStore } from '@/server/db/topics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/topics: the person's recent topics for Home.
 * No transcript or concepts. Each row carries its unfinished class id when
 * there is one, so the app never calls openClass once per topic.
 */
export const GET = createAppRoute(endpoints.listTopics, async ({ user }) => {
	const rows = await topicStore.list(user.id)
	const openByTopic = await classStore.findOpenIdsForTopics(
		user.id,
		rows.map((row) => row.id)
	)
	return {
		body: {
			topics: rows.map((row) => ({
				id: row.id,
				youtube_id: row.youtubeId,
				title: row.title,
				open_class_id: openByTopic.get(row.id) ?? null
			}))
		}
	}
})
