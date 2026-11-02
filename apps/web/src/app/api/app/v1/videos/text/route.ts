import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { readPastedText } from '@/server/video/read-video-with-concepts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST /api/app/v1/videos/text: a lesson from pasted text, when a video can't be read. */
export const POST = createAppRoute(endpoints.pasteText, async ({ user, body }) => ({
	body: { video: await readPastedText(user.id, body.text) }
}))
