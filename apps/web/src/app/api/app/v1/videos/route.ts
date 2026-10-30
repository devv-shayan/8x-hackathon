import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { readVideoWithConcepts } from '@/server/video/read-video-with-concepts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A long video takes a minute or more to read.
export const maxDuration = 300

/** POST /api/app/v1/videos: a video's title, transcript and key concepts, read once per person. */
export const POST = createAppRoute(endpoints.readVideo, async ({ user, body }) => ({
	body: { video: await readVideoWithConcepts(user.id, body.url) }
}))
