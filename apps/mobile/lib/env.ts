import { z } from 'zod'
import { log } from './logger'

/**
 * Every environment variable the app reads, in one place. Nothing else in
 * apps/mobile touches `process.env` (ESLint enforces it).
 *
 * THREE RULES, each of which has broken a release build somewhere:
 *
 * 1. Only `EXPO_PUBLIC_*` names. Expo inlines those into the JavaScript bundle
 *    at build time; nothing else exists on the phone.
 * 2. Each one is read STATICALLY: `process.env.EXPO_PUBLIC_X`, spelled out, as
 *    below. Expo only inlines a static member access. `process.env[name]` or
 *    `const { EXPO_PUBLIC_X } = process.env` works in development and is
 *    `undefined` in every release build.
 * 3. Nothing secret, ever. Everything here ships inside the app, and anyone who
 *    downloads it can read it. These are all public client keys by design:
 *    the Supabase publishable key, RevenueCat's public SDK keys, a Sentry DSN,
 *    a PostHog project key. A service-role key, webhook secret or private
 *    token must never get an `EXPO_PUBLIC_` name.
 *
 * Where the values come from: `.env.local` while developing, and EAS
 * environment variables (development / preview / production) for builds and
 * updates. See apps/mobile/README.md → "Environment variables".
 *
 * An unset value, an empty one, or a `REPLACE_…` placeholder is `undefined`, and
 * the feature that needs it reports itself "not configured" instead of
 * calling a placeholder host. A value that is set but malformed is logged and
 * also treated as unset: in a phone app, crashing at launch is worse than
 * running without the one service that is misconfigured.
 */

const url = z.url({ protocol: /^https?$/ })
const key = z.string().min(1)

/**
 * The shape of an 8xResearch product key. research-widget.plugin.js holds
 * the same pattern, so the build adds the microphone permissions exactly when
 * the app will show the widget (__tests__/researchWidget.test.tsx checks the two agree).
 */
export const RESEARCH_PRODUCT_KEY = /^[0-9a-f]{18}$/

export const envSchema = z.object({
	EXPO_PUBLIC_SUPABASE_URL: url.optional(),
	EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key.optional(),
	// Legacy name for the same public key; read only when the new one is unset.
	EXPO_PUBLIC_SUPABASE_ANON_KEY: key.optional(),

	// The web app (apps/web) the phone calls for all of its data (/api/app/v1).
	EXPO_PUBLIC_SITE_URL: url.optional(),

	EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: key.optional(),
	EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: key.optional(),

	EXPO_PUBLIC_SENTRY_DSN: url.optional(),

	EXPO_PUBLIC_POSTHOG_KEY: key.optional(),
	EXPO_PUBLIC_POSTHOG_HOST: url.default('https://us.i.posthog.com'),

	// 8xResearch's public product key for this app. Unset, the interview widget
	// (components/ResearchWidget.tsx) is off and the build asks for no microphone.
	EXPO_PUBLIC_RESEARCH_PRODUCT_KEY: z.string().regex(RESEARCH_PRODUCT_KEY).optional()
})

export type Env = z.infer<typeof envSchema>
export type EnvInput = { [K in keyof Env]?: string }

/** Unset, blank and `REPLACE_…` placeholders all mean "not configured". */
function configured(value: string | undefined): string | undefined {
	const trimmed = value?.trim()
	return trimmed && !trimmed.startsWith('REPLACE_') ? trimmed : undefined
}

/**
 * Validate raw values. Exported for tests; the app uses `env` below. Invalid
 * values are reported and dropped, never thrown.
 */
export function parseEnv(input: EnvInput): Env {
	const raw = Object.fromEntries(
		Object.entries(input).map(([name, value]) => [name, configured(value)])
	)
	const parsed = envSchema.safeParse(raw)
	if (parsed.success) return parsed.data

	const invalid = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
	log.error('Invalid environment variables; treating them as unset', { invalid })
	for (const name of invalid) delete raw[name]
	return envSchema.parse(raw)
}

// Spelled out one by one, on purpose. See rule 2 above.
export const env = parseEnv({
	EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
	EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
	EXPO_PUBLIC_SITE_URL: process.env.EXPO_PUBLIC_SITE_URL,
	EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
	EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
	EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
	EXPO_PUBLIC_POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY,
	EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
	EXPO_PUBLIC_RESEARCH_PRODUCT_KEY: process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
})
