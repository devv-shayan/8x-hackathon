import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { envSchema, parseEnv } from '@/lib/env'
import { log } from '@/lib/logger'

jest.mock('@/lib/logger', () => ({ log: { error: jest.fn(), warn: jest.fn() } }))

// The code of lib/env.ts without its comments, which quote the forbidden forms.
const SOURCE = readFileSync(join(__dirname, '../lib/env.ts'), 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, '')
	.replace(/^\s*\/\/.*$/gm, '')
const NAMES = Object.keys(envSchema.shape)

beforeEach(() => jest.mocked(log.error).mockClear())

describe('parseEnv', () => {
	it('passes configured values through', () => {
		const env = parseEnv({
			EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
			EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_123',
			EXPO_PUBLIC_SITE_URL: 'http://127.0.0.1:3000'
		})
		expect(env.EXPO_PUBLIC_SUPABASE_URL).toBe('https://abc.supabase.co')
		expect(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_123')
		expect(env.EXPO_PUBLIC_SITE_URL).toBe('http://127.0.0.1:3000')
	})

	it('treats REPLACE_ placeholders, blanks and unset values as not configured', () => {
		const env = parseEnv({
			EXPO_PUBLIC_SUPABASE_URL: 'REPLACE_WITH_PRODUCTION_SUPABASE_URL',
			EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'REPLACE_WITH_RC_IOS_KEY',
			EXPO_PUBLIC_SITE_URL: '   ',
			EXPO_PUBLIC_POSTHOG_KEY: ''
		})
		expect(env.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined()
		expect(env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY).toBeUndefined()
		expect(env.EXPO_PUBLIC_SITE_URL).toBeUndefined()
		expect(env.EXPO_PUBLIC_POSTHOG_KEY).toBeUndefined()
		expect(env.EXPO_PUBLIC_SENTRY_DSN).toBeUndefined()
		expect(log.error).not.toHaveBeenCalled()
	})

	it('trims surrounding whitespace', () => {
		expect(parseEnv({ EXPO_PUBLIC_POSTHOG_KEY: ' phc_test \n' }).EXPO_PUBLIC_POSTHOG_KEY).toBe(
			'phc_test'
		)
	})

	it('defaults the PostHog host', () => {
		expect(parseEnv({}).EXPO_PUBLIC_POSTHOG_HOST).toBe('https://us.i.posthog.com')
	})

	it('drops a malformed value instead of crashing the app, and names it without its value', () => {
		const env = parseEnv({
			EXPO_PUBLIC_SUPABASE_URL: 'not a url',
			EXPO_PUBLIC_SITE_URL: 'ftp://example.com',
			EXPO_PUBLIC_POSTHOG_KEY: 'phc_kept'
		})
		expect(env.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined()
		expect(env.EXPO_PUBLIC_SITE_URL).toBeUndefined()
		expect(env.EXPO_PUBLIC_POSTHOG_KEY).toBe('phc_kept')
		expect(log.error).toHaveBeenCalledTimes(1)
		const [, fields] = jest.mocked(log.error).mock.calls[0]
		expect(fields).toEqual({ invalid: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SITE_URL'] })
		expect(JSON.stringify(jest.mocked(log.error).mock.calls)).not.toContain('not a url')
	})
})

describe('the variables themselves', () => {
	it('are all EXPO_PUBLIC_ names, the only ones that exist in the app bundle', () => {
		for (const name of NAMES) expect(name).toMatch(/^EXPO_PUBLIC_[A-Z0-9_]+$/)
	})

	it('include nothing that names a secret, since everything here ships in the app', () => {
		for (const name of NAMES) expect(name).not.toMatch(/SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK/)
	})

	it('are each read statically, exactly once, and nothing else is read', () => {
		const reads = [...SOURCE.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1])
		expect(reads.length).toBeGreaterThan(0)
		expect([...reads].sort()).toEqual([...NAMES].sort())
		expect(SOURCE).not.toMatch(/process\.env\s*\[/)
	})
})
