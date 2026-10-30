import type { AppConfig, GatedPlatform } from '@app/contract'
import { api, ApiError } from './api'
import { log } from './logger'

/**
 * The minimum-version gate's half of `GET /api/app/v1/config` (docs/rules/ota.md).
 *
 * OTA updates can't fix native code, and a phone on an old runtime can't receive
 * new updates at all. So the server names the oldest native version it still
 * supports, per platform, and the app compares its own native version with it on
 * launch. Below the minimum, the app shows a full-screen "Update required" with a
 * link to its store listing (components/UpdateRequiredGate.tsx).
 *
 * THE HARD RULE: this check never keeps the app from opening. No site URL, a
 * network error, a timeout, a 404 (the route doesn't exist yet), a body that
 * isn't this shape, a version that won't parse: every one of them means "no
 * update required", and the app opens normally. Only a valid response that
 * names a higher minimum shows the gate.
 *
 * The response's shape is `@app/contract`'s appConfigSchema, the one the route
 * validates with too, and lib/api.ts parses it. `v1` is frozen once a store
 * build reads it: fields may be added, never renamed, removed or retyped.
 * Unknown fields are ignored, so additions are safe for every installed build.
 */

export type { AppConfig, GatedPlatform }

export type RequiredUpdate = {
	/** This binary's native version, e.g. "1.2.0". */
	appVersion: string
	/** The server's minimum for this platform, e.g. "1.3.0". */
	minSupportedVersion: string
	/** The store listing to send the person to. */
	storeUrl: string
}

/** Long enough for a slow network. Nothing waits on it: the app is already open. */
export const CONFIG_TIMEOUT_MS = 10_000

/**
 * Compare two dot-separated numeric versions: negative when `a` is older, 0 when
 * they are the same ("1.4" equals "1.4.0"), positive when `a` is newer. null when
 * either is not a version this gate understands, which callers treat as
 * "no update required".
 */
export function compareVersions(a: string, b: string): number | null {
	const parse = (value: string) =>
		/^\d+(\.\d+)*$/.test(value.trim()) ? value.trim().split('.').map(Number) : null
	const left = parse(a)
	const right = parse(b)
	if (!left || !right) return null
	for (let i = 0; i < Math.max(left.length, right.length); i++) {
		const diff = (left[i] ?? 0) - (right[i] ?? 0)
		if (diff !== 0) return diff
	}
	return 0
}

/** Decide from a validated config. Pure, so the rule is testable on its own. */
export function requiredUpdate(
	config: AppConfig,
	platform: GatedPlatform,
	appVersion: string
): RequiredUpdate | null {
	const minSupportedVersion = config.min_supported_version[platform]
	const url = config.store_url[platform]
	if (!minSupportedVersion || !url) return null
	const comparison = compareVersions(appVersion, minSupportedVersion)
	if (comparison === null || comparison >= 0) return null
	return { appVersion, minSupportedVersion, storeUrl: url }
}

/**
 * Ask the server whether this binary is still supported. Resolves to the update
 * the person must install, or null for every other outcome. Never throws.
 */
export async function checkForRequiredUpdate({
	platform,
	appVersion
}: {
	platform: GatedPlatform
	appVersion: string | null
}): Promise<RequiredUpdate | null> {
	if (!appVersion) return null
	try {
		const config = await api('getConfig', { timeoutMs: CONFIG_TIMEOUT_MS })
		return requiredUpdate(config, platform, appVersion)
	} catch (error) {
		if (error instanceof ApiError && error.code === 'not_configured') return null
		// Offline, timed out, the route not there yet (404), or a server error:
		// open normally. A response that broke the contract was already reported
		// by the API client, as a bug someone should see; still no reason to lock
		// the app.
		if (!(error instanceof ApiError) || error.code !== 'invalid_response') {
			log.warn('App config unavailable; skipping the minimum-version check', {
				code: error instanceof ApiError ? error.code : 'unknown',
				status: error instanceof ApiError ? error.status : null
			})
		}
		return null
	}
}
