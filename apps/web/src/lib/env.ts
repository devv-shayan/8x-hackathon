import { z } from 'zod'
import { appVersionSchema, storeUrlSchema } from '@app/contract'

// Single source of truth for every environment variable the app reads.
// Fails fast at boot with a clear message instead of a runtime `undefined`
// surfacing three layers deep. Keep this in sync with .env.example —
// `npm run check:env` (the root scripts/check-env-vars.mjs) fails CI if a
// process.env reference exists in code without a matching entry here, or an
// entry here or in .env.example that nothing reads.
//
// Validated once per server instance by src/instrumentation.ts. Code reads
// each variable from process.env directly, so NEXT_PUBLIC_* values are still
// inlined into the browser bundle; this schema is the contract, not a second
// copy of the values.
//
// Everything is optional: each variable's feature no-ops or answers 503 while
// it is unset (docs/ENV_SETUP.md), and a fresh clone must boot with none of
// them. A value that is set but malformed fails the boot.
const baseSchema = z.object({
	// Prisma: every read and write (src/server/db/). The transaction pooler,
	// port 6543, with ?pgbouncer=true. Unset, first-party analytics records
	// nothing and every database read fails.
	DATABASE_URL: z.string().url().optional().or(z.literal('')),
	// Only read by the Prisma CLI (`migrate dev`/`migrate deploy`), never by
	// the running app. The session pooler: port 5432, no query parameters.
	DIRECT_URL: z.string().url().optional().or(z.literal('')),

	NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().or(z.literal('')),
	SUPABASE_SECRET_KEY: z.string().optional(),
	// Legacy names, read only as fallbacks when the names above are unset.
	// Server-side alias for NEXT_PUBLIC_SUPABASE_URL.
	SUPABASE_URL: z.string().url().optional().or(z.literal('')),
	NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
	SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

	// Google AI Studio key for src/server/ai/gemini.ts. Unset, reading a video
	// answers 503.
	GEMINI_API_KEY: z.string().optional(),

	// Minimum severity the server logger emits (docs/rules/logging.md).
	// Validated here so a typo fails the boot loudly, but the logger reads
	// `process.env.LOG_LEVEL` directly (not `env.LOG_LEVEL`) so it can report a
	// bad boot before this schema has run. Defaults to `info`, or `silent`
	// under NODE_ENV=test.
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),

	// metadataBase, sitemap and robots. Unset falls back to https://example.com;
	// an empty value would crash the root layout, so it is rejected here.
	NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

	NEXT_PUBLIC_POSTHOG_KEY: z.string().optional().or(z.literal('')),
	// Unset falls back to https://us.i.posthog.com. Match the mobile app's host.
	NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional().or(z.literal('')),
	NEXT_PUBLIC_GA_ID: z.string().optional(),
	// Local only: pretend requests come from this country (ISO 3166-1 alpha-2).
	NEXT_PUBLIC_DEV_COUNTRY: z.string().optional(),

	// The Play Stats API (docs/PLAY_API.md). Unset key: the API answers 503.
	DASHBOARD_API_KEY: z.string().optional(),
	// Unset falls back to `app`.
	PLAY_SLUG: z.string().optional(),

	// The Play Events API (docs/EVENTS.md). Server-only, write-only.
	PLAY_INGEST_KEY: z.string().optional(),
	// The platform that receives Play Events. Unset means no event is sent.
	PLATFORM_BASE_URL: z.string().url().optional().or(z.literal('')),

	// Required by cron routes only; an unset secret must not break unrelated pages.
	CRON_SECRET: z.string().optional(),

	// Checked, trimmed, against the webhook's Authorization header. Unset, the
	// webhook refuses every event with a 503 and writes nothing. Optional here
	// on purpose: a missing secret must not stop the rest of the app booting. A
	// Vercel production build fails without a valid one instead
	// (deploy-checks.mjs, run from next.config.mjs).
	REVENUECAT_WEBHOOK_SECRET: z.string().optional(),

	// The minimum-version gate, served by GET /api/app/v1/config
	// (docs/rules/ota.md). The oldest native app version still supported on
	// each platform, and the store listing the app sends people below it to.
	// Unset: no minimum. A minimum needs its store URL (checked below).
	APP_MIN_VERSION_IOS: z.string().trim().pipe(appVersionSchema).optional().or(z.literal('')),
	APP_MIN_VERSION_ANDROID: z.string().trim().pipe(appVersionSchema).optional().or(z.literal('')),
	APP_STORE_URL_IOS: z.string().trim().pipe(storeUrlSchema).optional().or(z.literal('')),
	APP_STORE_URL_ANDROID: z.string().trim().pipe(storeUrlSchema).optional().or(z.literal(''))
})

// A minimum without a store URL would make GET /api/app/v1/config fail its
// contract on every launch (the app then opens normally, ungated). Fail the
// boot instead, naming the missing variable.
const envSchema = baseSchema.superRefine((values, ctx) => {
	for (const [min, store] of [
		['APP_MIN_VERSION_IOS', 'APP_STORE_URL_IOS'],
		['APP_MIN_VERSION_ANDROID', 'APP_STORE_URL_ANDROID']
	] as const) {
		if (values[min] && !values[store]) {
			ctx.addIssue({
				code: 'custom',
				path: [store],
				message: `Required when ${min} is set: the update screen links to it`
			})
		}
	}
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
	const parsed = envSchema.safeParse(process.env)
	if (!parsed.success) {
		console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
		throw new Error('Invalid environment variables — see console output above')
	}
	return parsed.data
}

export const env = loadEnv()
