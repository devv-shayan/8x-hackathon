import { endpoints } from '@app/contract'
import { createAppRoute, notFound } from '@/server/api/app-route'
import { topicStore } from '@/server/db/topics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/app/v1/topics/:id: title and video for Explain (no transcript). */
export const GET = createAppRoute(endpoints.getTopic, async ({ user, params }) => {
	const topic = await topicStore.findOutline(user.id, params.id)
	if (!topic) throw notFound()
	return { body: { topic: { id: topic.id, title: topic.title, youtube_id: topic.youtubeId } } }
})
