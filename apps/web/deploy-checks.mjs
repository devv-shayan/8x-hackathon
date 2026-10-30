// Checks that fail a Vercel production build rather than a live deployment.
//
// Next.js 15 validates the env schema (src/instrumentation.ts) when a server
// boots, never during `next build`. So a production deployment missing a value
// it cannot run without would build, pass CI, get promoted, and only then fail.
// A check here stops the build instead: Vercel refuses to promote it and the
// previous deployment stays live.
//
// next.config.mjs runs this for `next build` only, and it acts only when
// VERCEL_ENV is `production`. Preview builds, CI builds, `next dev` and
// `next start` never fail here. Keep it to what production truly needs.

/** The shortest RevenueCat webhook secret a production build accepts. */
export const MIN_WEBHOOK_SECRET_LENGTH = 32

// Visible ASCII only. HTTP trims whitespace around a header value, and Node
// reads header bytes as latin1, so a secret with a space, a tab, a newline or a
// non-ASCII character can never equal the Authorization header RevenueCat sends.
const VISIBLE_ASCII = /^[\x21-\x7E]+$/

/**
 * Why `value` can't be the RevenueCat webhook secret, or null when it can.
 * The value is trimmed first, as the webhook route trims it.
 *
 * @param {string | undefined} value
 * @returns {string | null}
 */
export function webhookSecretProblem(value) {
	const secret = value?.trim() ?? ''
	if (!secret) return 'is not set'
	if (!VISIBLE_ASCII.test(secret)) {
		return 'contains whitespace or a non-ASCII character, so it can never match the Authorization header RevenueCat sends'
	}
	if (secret.length < MIN_WEBHOOK_SECRET_LENGTH) {
		return `is shorter than ${MIN_WEBHOOK_SECRET_LENGTH} characters`
	}
	return null
}

/**
 * Throws, failing the build, when a Vercel production build lacks what
 * production needs. Never includes a secret's value in the message.
 *
 * @param {Record<string, string | undefined>} env
 */
export function assertProductionBuildEnv(env) {
	if (env.VERCEL_ENV !== 'production') return
	const problem = webhookSecretProblem(env.REVENUECAT_WEBHOOK_SECRET)
	if (problem == null) return
	throw new Error(
		`REVENUECAT_WEBHOOK_SECRET ${problem}. This production build stops here so the live ` +
			'deployment keeps running: without a valid secret the RevenueCat webhook refuses every ' +
			'event, and subscription changes never reach profiles. Set it in Vercel → Settings → ' +
			'Environment Variables (Production), for example with `openssl rand -hex 32`, and set ' +
			'RevenueCat → Integrations → Webhooks → Authorization header to `Bearer <the same value>`. ' +
			'See docs/ENV_SETUP.md.'
	)
}

// ── The database ─────────────────────────────────────────────────────────────
//
// Every server read and write goes through Prisma on DATABASE_URL: the Play
// Stats API, the admin panel, first-party analytics, and the RevenueCat
// webhook's entitlement writes. `next build` never connects, so a production
// deployment without it would build, be promoted, and fail every request that
// touches the database. DIRECT_URL is not checked: the running client never
// reads it, only the Prisma CLI does, and migrations run in GitHub Actions
// (deploy-migrations.yml), never on Vercel.

/** Supabase's transaction pooler, which cannot keep a prepared statement. */
export const TRANSACTION_POOLER_PORT = '6543'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])

/**
 * Why `value` can't be production's DATABASE_URL, or null when it can. The
 * value never appears in what it returns: it holds the database password.
 *
 * @param {string | undefined} value
 * @returns {string | null}
 */
export function databaseUrlProblem(value) {
	const raw = value?.trim() ?? ''
	if (!raw) return 'is not set'
	let url
	try {
		url = new URL(raw)
	} catch {
		return 'is not a URL (percent-encode any special character in the password)'
	}
	if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
		return 'is not a postgresql:// URL'
	}
	if (!url.hostname) return 'names no host'
	if (LOCAL_HOSTS.has(url.hostname)) {
		return 'points at localhost, which a Vercel function cannot reach'
	}
	if (url.pathname.length <= 1) return "names no database (Supabase's is /postgres)"
	if (url.port === TRANSACTION_POOLER_PORT && url.searchParams.get('pgbouncer') !== 'true') {
		return (
			`uses the transaction pooler (port ${TRANSACTION_POOLER_PORT}) without pgbouncer=true, ` +
			'so Prisma prepares statements the pooler cannot keep and queries fail'
		)
	}
	return null
}

/**
 * Throws, failing the build, when a Vercel production build has no usable
 * DATABASE_URL. Separate from the webhook check above; next.config.mjs runs
 * both. Never includes the value in the message.
 *
 * @param {Record<string, string | undefined>} env
 */
export function assertProductionDatabaseEnv(env) {
	if (env.VERCEL_ENV !== 'production') return
	const problem = databaseUrlProblem(env.DATABASE_URL)
	if (problem == null) return
	throw new Error(
		`DATABASE_URL ${problem}. This production build stops here so the live deployment keeps ` +
			"running: every server read and write goes through it, the RevenueCat webhook's " +
			'entitlement writes included, so without it the Play Stats API, the admin panel and the ' +
			'webhook fail on every request. Set it in Vercel → Settings → Environment Variables ' +
			'(Production) to Supabase → Connect → Transaction pooler (port 6543), ending ' +
			'?pgbouncer=true&connection_limit=1. DIRECT_URL is not needed on Vercel: migrations run ' +
			'in GitHub Actions. See docs/ENV_SETUP.md.'
	)
}
