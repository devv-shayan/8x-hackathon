import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { classStore } from '@/server/db/classes'
import { gapStore } from '@/server/db/gaps'
import { topicStore } from '@/server/db/topics'
import { byStrength, videoProgress } from '@/server/topics/progress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/progress: the dashboard's numbers, in one request rather than one per video.
 * Every video with a finished class, best first, and every warm-up answered across them.
 */
export const GET = createAppRoute(endpoints.getProgress, async ({ user }) => {
	const topics = await topicStore.listAll(user.id)
	const ids = topics.map((topic) => topic.id)
	const [finished, gaps] = await Promise.all([
		classStore.latestFinishedForTopics(user.id, ids),
		gapStore.listForTopics(user.id, ids)
	])
	const videos = topics
		.flatMap((topic) => {
			const video = videoProgress(topic, finished.get(topic.id), gaps.get(topic.id) ?? [])
			return video ? [video] : []
		})
		.sort(byStrength)
	const warmUps = [...gaps.values()].flat().flatMap((gap) => gap.warmUps)
	return {
		body: {
			videos,
			warm_ups: warmUps.map(({ createdAt, studentName, isRight }) => ({
				asked_at: createdAt.toISOString(),
				student_name: studentName,
				is_right: isRight
			}))
		}
	}
})
