import { randomUUID } from 'node:crypto'
import { AVATAR_CONTENT_TYPES, avatarPathSchema, type AvatarContentType } from '@app/contract'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'

// Avatars in Supabase Storage: the private `user-uploads` bucket, created by the migration
// 20260924000500_user_uploads_bucket (and supabase/config.toml locally), which also enforces
// the allowed types and the 5 MiB limit on every upload. No storage policies: a device only
// ever holds a URL this module signed for it, after the route verified who it is
// (docs/rules/mobile-data.md → Storage).
//
// Every file a person uploads lives under `<user id>/avatar/`, so their files are one prefix,
// and the path itself says whose a file is.

export const UPLOADS_BUCKET = 'user-uploads'

// Supabase's fixed validity for a signed upload URL: the SDK takes no expiry for it.
const UPLOAD_URL_VALID_MS = 2 * 60 * 60 * 1000
// Long enough for a screen that stays open; short enough that a copied link dies. The app
// asks again with the profile rather than storing it.
const DOWNLOAD_URL_VALID_S = 60 * 60
// Far more than one person's avatar folder holds; a larger one is emptied a page at a time,
// up to a bound, so a remove that quietly removes nothing can't loop forever.
const LIST_PAGE = 1000
const MAX_PAGES = 10

export function avatarFolder(userId: string): string {
	return `${userId}/avatar`
}

/** Whether `path` is an avatar upload of this person's, in the shape POST uploads hands out. */
export function isOwnAvatarPath(userId: string, path: string): boolean {
	return avatarPathSchema.safeParse(path).success && path.startsWith(`${avatarFolder(userId)}/`)
}

function bucket() {
	return createSecretKeyClient().storage.from(UPLOADS_BUCKET)
}

// Storage answers "no such object" and "no such bucket" as a 400 whose body says 404.
function isNotFound(error: { status?: number; statusCode?: string }): boolean {
	return error.status === 404 || error.statusCode === '404'
}

export type AvatarUpload = {
	bucket: string
	path: string
	signedUrl: string
	token: string
	expiresAt: Date
}

/** A signed URL the device PUTs one new avatar to, at a fresh path under the person's folder. */
export async function createAvatarUpload(
	userId: string,
	contentType: AvatarContentType
): Promise<AvatarUpload> {
	const path = `${avatarFolder(userId)}/${randomUUID()}.${AVATAR_CONTENT_TYPES[contentType]}`
	const expiresAt = new Date(Date.now() + UPLOAD_URL_VALID_MS)
	const { data, error } = await bucket().createSignedUploadUrl(path)
	if (error) throw error
	return { bucket: UPLOADS_BUCKET, path, signedUrl: data.signedUrl, token: data.token, expiresAt }
}

/**
 * What the app shows for the stored `profiles.avatar_url`: a short-lived signed URL for the
 * person's own upload, an absolute https URL as it is (a provider's picture a play copies
 * in), and null for anything else. That includes a path to someone else's file, written
 * straight into the column while the app could still write the table (before migration
 * 20260924000600_lock_the_api_roles_out_stage_2 revoked that): it is never signed. A file
 * that no longer exists is null. Throws when storage fails.
 */
export async function avatarUrlFor(userId: string, stored: string | null): Promise<string | null> {
	if (!stored) return null
	if (URL.canParse(stored)) return new URL(stored).protocol === 'https:' ? stored : null
	if (!isOwnAvatarPath(userId, stored)) return null
	const { data, error } = await bucket().createSignedUrl(stored, DOWNLOAD_URL_VALID_S)
	if (error) {
		if (isNotFound(error)) return null
		throw error
	}
	return data.signedUrl
}

/**
 * Deletes the person's avatar files, all but `keep`: the ones replaced, and uploads never
 * saved to the profile. A person or bucket with no files is not an error. Throws when
 * storage fails.
 */
export async function removeAvatars(userId: string, { keep }: { keep?: string } = {}) {
	const folder = avatarFolder(userId)
	for (let page = 0; page < MAX_PAGES; page++) {
		const { data, error } = await bucket().list(folder, { limit: LIST_PAGE })
		if (error) {
			if (isNotFound(error)) return
			throw error
		}
		const paths = data.map((file) => `${folder}/${file.name}`).filter((path) => path !== keep)
		if (paths.length === 0) return
		const removed = await bucket().remove(paths)
		if (removed.error) throw removed.error
		if (data.length < LIST_PAGE) return
	}
}
