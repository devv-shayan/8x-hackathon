import { api, ApiError } from './api'
import { APP_SUPPORT_EMAIL } from './constants'

/**
 * Delete the signed-in person's account, from inside the app, through
 * DELETE /api/app/v1/account.
 *
 * Apple 5.1.1(v) and Google Play both require it: an app that lets people
 * create an account must let them delete it without leaving the app. (Play
 * also wants a web link; that is the public /delete-account page on the site.)
 *
 * The route deletes whoever the access token belongs to, never an id the app
 * sends, so nothing here is trusted beyond "this device holds a valid session".
 * ON DELETE CASCADE removes the person's rows with them.
 *
 * Nothing is swallowed: the person asked for their account to be deleted, so
 * every failure throws an `AccountDeletionError` whose message is written to be
 * shown to them, and whose `reason` is `delete_account_failed`'s metadata.
 * Resolving means the server confirmed the deletion, and only then.
 */

export type AccountDeletionFailure =
	'not_configured' | 'no_session' | 'unauthorized' | 'network' | 'server'

export class AccountDeletionError extends Error {
	readonly reason: AccountDeletionFailure

	constructor(reason: AccountDeletionFailure, message: string) {
		super(message)
		this.name = 'AccountDeletionError'
		this.reason = reason
	}
}

/** Longer than a read: the server deletes the person's files too. */
const TIMEOUT_MS = 30_000

export async function deleteAccount(): Promise<void> {
	try {
		// Success is the contract's `{ ok: true }`, parsed by the client: a wrong
		// EXPO_PUBLIC_SITE_URL answering 200 with a web page is an error.
		await api('deleteAccount', { timeoutMs: TIMEOUT_MS })
	} catch (error) {
		throw deletionError(error)
	}
}

function deletionError(error: unknown): AccountDeletionError {
	const code = error instanceof ApiError ? error.code : null
	switch (code) {
		case 'not_configured':
			return new AccountDeletionError(
				'not_configured',
				`Account deletion isn't set up in this version of the app. Email ${APP_SUPPORT_EMAIL} and we'll delete your account for you.`
			)
		case 'signed_out':
			return new AccountDeletionError(
				'no_session',
				"You're signed out, so there's no account to delete here. Sign in, then try again."
			)
		case 'unauthorized':
			// The API client has already signed this device out of the dead session.
			return new AccountDeletionError(
				'unauthorized',
				'Your session has expired, so your account was not deleted. Sign in again, then try again.'
			)
		case 'offline':
		case 'unreachable':
		case 'timeout':
			return new AccountDeletionError(
				'network',
				"We couldn't reach our server, so your account was not deleted. Check your connection and try again."
			)
		default:
			return new AccountDeletionError(
				'server',
				`Something went wrong on our side, so your account was not deleted. Try again in a few minutes, or email ${APP_SUPPORT_EMAIL}.`
			)
	}
}
