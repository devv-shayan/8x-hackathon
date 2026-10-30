import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/config: public, no auth. The minimum-version gate's contract,
 * read by every installed build on launch (docs/rules/ota.md, @app/contract).
 *
 * A play sets the four APP_* variables; nothing here changes. Each is null when
 * unset. The wrapper checks the body against the contract before sending it,
 * so a minimum without its store URL is a 500 (the app opens normally), never
 * a 200 the app would reject; the env schema refuses to boot with that
 * combination in the first place.
 *
 * Cached for a minute: short enough that a raised minimum reaches everyone
 * quickly, long enough that a launch spike doesn't reach the server each time.
 */
const CACHE_CONTROL = 'public, max-age=60, s-maxage=60'

function configured(value: string | undefined): string | null {
	return value?.trim() || null
}

export const GET = createAppRoute(endpoints.getConfig, async () => ({
	body: {
		min_supported_version: {
			ios: configured(process.env.APP_MIN_VERSION_IOS),
			android: configured(process.env.APP_MIN_VERSION_ANDROID)
		},
		store_url: {
			ios: configured(process.env.APP_STORE_URL_IOS),
			android: configured(process.env.APP_STORE_URL_ANDROID)
		}
	},
	headers: { 'Cache-Control': CACHE_CONTROL }
}))
