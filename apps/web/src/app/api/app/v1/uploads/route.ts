import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { createAvatarUpload } from '@/server/storage/avatars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/uploads: a signed URL for one new avatar. The route picks the path, under
 * the caller's own folder; the device only says what it is sending, and the bucket refuses
 * any other type or a file over the limit. The device PUTs the file to `signed_url`, then
 * sends `path` as `avatar_path` on PATCH /api/app/v1/profile.
 */
export const POST = createAppRoute(endpoints.createUpload, async ({ user, body }) => {
	const upload = await createAvatarUpload(user.id, body.content_type)
	return {
		body: {
			upload: {
				bucket: upload.bucket,
				path: upload.path,
				signed_url: upload.signedUrl,
				token: upload.token,
				expires_at: upload.expiresAt.toISOString()
			}
		}
	}
})
