import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { memoryReminderStore } from '@/server/db/memory-reminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/push-token: the signed-in person's Expo push token, so a
 * reminder can reach this phone. The board works without one.
 */
export const POST = createAppRoute(endpoints.registerPushToken, async ({ user, body }) => {
	await memoryReminderStore.saveToken({
		userId: user.id,
		token: body.token,
		platform: body.platform
	})
	return { body: { ok: true as const } }
})
