import { endpoints } from '@app/contract'
import { deleteAccount } from '@/server/account/delete-account'
import { createAppRoute } from '@/server/api/app-route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/app/v1/account: the app's "Delete account" (Apple 5.1.1(v),
 * Google Play). Deletes whoever the bearer token belongs to, now. A 200 means
 * the account is gone; any other status means it is not.
 */
export const DELETE = createAppRoute(endpoints.deleteAccount, async ({ user }) => {
	await deleteAccount(user)
	return { body: { ok: true as const } }
})
