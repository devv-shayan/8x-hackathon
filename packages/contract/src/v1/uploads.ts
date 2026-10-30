import { z } from 'zod'
import { isoDateTime } from './common'

// POST /api/app/v1/uploads: a signed upload URL for one file.
//
// The route authorizes the person, picks the storage path itself (under their
// user id), and signs an upload URL with the secret key. The device then PUTs
// the file straight to storage with it. No storage policies: authorization
// lives in the route (docs/rules/mobile-data.md → Storage).

export const UPLOAD_PURPOSES = ['avatar'] as const
export const uploadPurposeSchema = z.enum(UPLOAD_PURPOSES)

/** Allowed content types for an avatar, and the file extension each is stored with. */
export const AVATAR_CONTENT_TYPES = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/heic': 'heic'
} as const

export type AvatarContentType = keyof typeof AVATAR_CONTENT_TYPES

export const avatarContentTypeSchema = z.enum(
	Object.keys(AVATAR_CONTENT_TYPES) as [AvatarContentType, ...AvatarContentType[]]
)

/** The largest avatar accepted, in bytes. The storage bucket enforces it too. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export const createUploadBody = z
	.object({
		purpose: uploadPurposeSchema,
		content_type: avatarContentTypeSchema,
		size_bytes: z.number().int().min(1).max(MAX_AVATAR_BYTES)
	})
	.strict()

export const uploadSchema = z.object({
	/** The storage bucket the file goes into. */
	bucket: z.string(),
	/** Where the file will live. Send it back as `avatar_path` on PATCH profile. */
	path: z.string(),
	/** PUT the file here, with the content type declared above. */
	signed_url: z.url(),
	token: z.string(),
	/** After this the URL no longer accepts an upload. */
	expires_at: isoDateTime
})

export const createUploadResponse = z.object({ upload: uploadSchema })

/** `<user id>/avatar/<uuid>.<ext>`, the only path shape an avatar is stored under. */
export const avatarPathSchema = z
	.string()
	.regex(
		/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\/avatar\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|heic)$/,
		'an avatar path from POST /api/app/v1/uploads'
	)

export type CreateUploadBody = z.infer<typeof createUploadBody>
export type Upload = z.infer<typeof uploadSchema>
