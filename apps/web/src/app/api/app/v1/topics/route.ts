import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { classStore } from '@/server/db/classes'
import { gapStore } from '@/server/db/gaps'
import { topicStore } from '@/server/db/topics'
import { rowProgress } from '@/server/topics/progress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/topics: the person's recent topics for Home.
 * No transcript or concepts. Each row carries its unfinished class id when
 * there is one, so the app never calls openClass once per topic, and, once a
 * class on it has finished, how many ideas it taught and its next warm-up.
 */
export const GET = createAppRoute(endpoints.listTopics, async ({ user }) => {
	const rows = await topicStore.list(user.id)
	const ids = rows.map((row) => row.id)
	const [openByTopic, finishedByTopic, gapsByTopic] = await Promise.all([
		classStore.findOpenIdsForTopics(user.id, ids),
		classStore.latestFinishedForTopics(user.id, ids),
		gapStore.listForTopics(user.id, ids)
	])
	return {
		body: {
			topics: rows.map((row) => ({
				id: row.id,
				youtube_id: row.youtubeId,
				title: row.title,
				open_class_id: openByTopic.get(row.id) ?? null,
				...rowProgress(
					finishedByTopic.get(row.id)?.conceptResults ?? [],
					gapsByTopic.get(row.id) ?? []
				)
			}))
		}
	}
})
