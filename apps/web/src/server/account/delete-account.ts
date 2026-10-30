import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import { trackPlayEvent } from '@/lib/plays/events'
import { log } from '@/server/lib/logger'
import { avatarFolder, removeAvatars, UPLOADS_BUCKET } from '@/server/storage/avatars'

/**
 * Delete a person's account now: emit `account_deleted`, delete the auth user, then their
 * uploaded files. The on_auth_user_deleted trigger deletes their profile, and its foreign
 * keys take their rows with it. Every deletion path ends here: DELETE /api/app/v1/account,
 * and the older /api/delete-account (the app's Bearer token, or the website's session).
 *
 * The caller has already verified who `user` is (requireUser, or the website's
 * session). Never pass an id taken from a request.
 *
 * The event goes BEFORE the delete: afterwards the email is gone from
 * auth.users and there is nothing left to suppress with. `account_deleted` is
 * the platform's right-to-be-forgotten hook: on receipt it hard-suppresses the
 * contact and purges their PII from the audience. Skipping it means a deleted
 * person keeps receiving marketing, which is the GDPR failure it exists to
 * prevent. Always send it.
 *
 * The files go AFTER the delete, so a delete that fails never costs a live account its
 * avatar. A storage failure then doesn't undo the deletion or fail it: the person's right
 * to delete their account outranks a cleanup. It is logged with the folder left behind, which
 * nothing can reach any more (the bucket is private, and only a profile's own path is ever
 * signed), for someone to remove by hand.
 *
 * Throws when the account was not deleted, so no caller can answer 200 for it.
 */
export async function deleteAccount(user: { id: string; email: string | null }): Promise<void> {
	const admin = createSecretKeyClient()
	await trackPlayEvent(
		'account_deleted',
		{ id: user.id, email: user.email ?? undefined },
		{ reason: 'self_service' },
		{ eventId: `deleted:${user.id}` }
	)
	const { error } = await admin.auth.admin.deleteUser(user.id)
	if (error) throw error

	try {
		await removeAvatars(user.id)
	} catch (err) {
		log.error('account deleted, but its uploads were not; remove the folder by hand', {
			source: 'account',
			bucket: UPLOADS_BUCKET,
			folder: avatarFolder(user.id),
			err
		})
	}
}
