import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run, scanText } from './check-secrets.mjs'

const SCRIPT = fileURLToPath(new URL('./check-secrets.mjs', import.meta.url))
const REPO = fileURLToPath(new URL('..', import.meta.url))

// ---------------------------------------------------------------------------
// Fixtures. Every secret-shaped value is assembled at runtime from fragments,
// so no complete one appears in this file: nothing here reads as a leaked
// credential, and GitHub secret scanning, gitleaks and the like have nothing
// to match in any clone. Keep it that way when adding a test.
// ---------------------------------------------------------------------------

const fake = (...parts) => parts.join('')

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const UPPER_ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const HEX = '0123456789abcdef'

// Deterministic, high-entropy filler (a Park–Miller sequence): the rules gate
// on length and entropy, so a fixture needs a disordered value, and the same
// one every run.
function noise(length, alphabet = ALNUM, seed = length) {
	let state = seed
	let out = ''
	for (let index = 0; index < length; index++) {
		state = (state * 48271) % 2147483647
		out += alphabet[state % alphabet.length]
	}
	return out
}

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

// A three-part JWT whose header and payload decode to an obviously synthetic
// object: no role, no project ref, no expiry.
const JWT = fake(
	base64url({ alg: 'HS256', typ: 'JWT' }),
	'.',
	base64url({ fixture: 'check-secrets.test.mjs' }),
	'.',
	noise(36)
)

// Shaped like a Sentry org auth token, the one eas.json's env block names.
const SENTRY_TOKEN = fake('sntrys_', noise(24), '_', noise(32))

function inTempDir(fn) {
	const dir = mkdtempSync(join(tmpdir(), 'check-secrets-'))
	try {
		return fn(dir)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

function writeUnder(dir, path, text) {
	const full = join(dir, path)
	mkdirSync(dirname(full), { recursive: true })
	writeFileSync(full, text)
	return full
}

// Every rule id scanText fires on a piece of text. This whole file is on the
// scanner's SKIP_PATHS list as well, so `check:secrets --all` skips it.
function ids(text) {
	return scanText(text).map((finding) => finding.ruleId)
}

function flags(text) {
	return scanText(text).length > 0
}

test('flags a connection string with a real inline password', () => {
	const url = fake('postgresql://', 'prod_user:', noise(20), '@db.fixture.invalid:5432/postgres')
	assert.ok(ids(`DATABASE_URL="${url}"`).includes('url-credentials'))
})

test('ignores a connection string whose password is a placeholder', () => {
	for (const url of [
		fake('postgresql://', 'user:password', '@host:6543/postgres'),
		fake('postgresql://', 'postgres:postgres', '@localhost:5432/postgres'),
		fake('postgresql://', 'placeholder:placeholder', '@localhost:5432/placeholder'),
		fake('postgresql://', 'user:s3cr3t', '@db.example.com:5432/postgres')
	]) {
		assert.equal(flags(url), false, url)
	}
})

test('flags provider-format keys', () => {
	assert.ok(ids(fake('AKIA', noise(16, UPPER_ALNUM))).includes('aws-access-key-id'))
	assert.ok(ids(fake('ghp_', 'a'.repeat(36), '9')).includes('github-token'))
	assert.ok(ids(fake('xoxb-', '123456789012', '-', 'abcdefghijkl')).includes('slack-token'))
	assert.ok(ids(fake('AIza', 'b'.repeat(35))).includes('google-api-key'))
	assert.ok(ids(fake('sk-ant-', 'c'.repeat(40))).includes('openai-anthropic-key'))
})

test('flags a PEM private-key header', () => {
	assert.ok(ids(fake('-----BEGIN ', 'OPENSSH ', 'PRIVATE KEY', '-----')).includes('private-key'))
})

test('flags a JWT such as a legacy Supabase service-role key', () => {
	assert.ok(ids(`SUPABASE_SERVICE_ROLE_KEY=${JWT}`).includes('jwt'))
})

test('flags a Supabase sb_secret_ key but not the public sb_publishable_ key', () => {
	assert.ok(
		ids(fake('SUPABASE_SECRET_KEY=', 'sb_', 'secret_', noise(28))).includes('supabase-secret-key')
	)
	assert.equal(
		flags(fake('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=', 'sb_', 'publishable_', noise(31))),
		false
	)
	assert.equal(flags(fake('SUPABASE_SECRET_KEY=', 'sb_', 'secret_', '<your-key>')), false)
})

test('flags a high-entropy Bearer token but not a placeholder or env reference', () => {
	assert.ok(ids(fake('Authorization: ', 'Bearer ', noise(32))).includes('auth-header'))
	assert.equal(flags('Authorization: Bearer sk-or-not-a-real-key'), false)
	assert.equal(flags('Authorization: Bearer $CRON_SECRET'), false)
})

test('flags a secret-shaped value on a credential-named key, base64 or hex', () => {
	assert.ok(ids(fake('API_KEY=', noise(39))).includes('sensitive-assignment'))
	assert.ok(ids(fake('MY_CUSTOM_TOKEN=', noise(40, HEX))).includes('sensitive-assignment'))
})

test('does not fire the assignment rule on non-credential keys or ordinary code', () => {
	// A 40-char git SHA on a non-credential key.
	assert.equal(flags(fake('GITHUB_SHA=', noise(40, HEX))), false)
	// A per-request HMAC signature is derived, not a reusable credential.
	assert.equal(flags(fake('x-app-signature: ', '1788517056488.', noise(43))), false)
	// Ordinary source: a schema declaration and a property reference.
	assert.equal(flags('const secret = z.string().min(1)'), false)
	assert.equal(flags('const apiKey = opts.apiKey'), false)
	// An empty or clearly-templated value.
	assert.equal(flags('SUPABASE_SERVICE_ROLE_KEY=""'), false)
	assert.equal(flags('API_KEY=${OPENAI_API_KEY}'), false)
})

test('an inline `allowlist secret` comment suppresses the line', () => {
	assert.equal(flags(fake('API_KEY=', noise(39), ' // allowlist secret')), false)
})

test('reports the same secret once even when two rules match it', () => {
	// A service-role JWT is both a `jwt` and a credential assignment; dedup by
	// masked value keeps one finding per secret.
	const found = scanText(`SERVICE_ROLE_KEY=${JWT}`)
	assert.equal(found.length, 1)
	assert.equal(found[0].ruleId, 'jwt')
})

// ---------------------------------------------------------------------------
// Rules this repo carries beyond template-web (the 2026-09 transcript audit)
// ---------------------------------------------------------------------------

test('flags a kilobyte-plus base64 run such as an inlined keystore', () => {
	assert.ok(ids(fake('MII', 'Ab3+'.repeat(300))).includes('large-base64-blob'))
})

test('flags a PostHog key', () => {
	assert.ok(ids(fake('personal key ', 'phx_', 'a1B2c3D4'.repeat(5))).includes('posthog-key'))
})

test('flags a RapidAPI key', () => {
	const key = fake('a1b2c3d4e5f6'.repeat(2), 'jsn', 'f0e1d2c3b4a5')
	assert.ok(ids(`x-rapidapi-key: ${key}`).includes('rapidapi-key'))
})

test('flags a dev / otp / magic-link credential in a query string, not a short code', () => {
	assert.ok(
		ids(fake('https://play.invalid/login', '?dev=', noise(16))).includes('auth-query-param')
	)
	assert.equal(flags('https://play.invalid/verify?otp=123456'), false)
})

test('scans a session transcript over 1MB, but not a generated file that size', () => {
	const text = 'filler line\n'.repeat(100_000) + fake('API_KEY=', noise(39), '\n')
	assert.ok(text.length > 1_000_000)
	inTempDir((dir) => {
		const transcript = writeUnder(dir, '.claude-logs/2026-09-24_session.md', text)
		const bundle = writeUnder(dir, 'dist/bundle.js', text)
		assert.deepEqual(
			run({ mode: 'paths', paths: [transcript] }).map((finding) => finding.ruleId),
			['sensitive-assignment']
		)
		assert.deepEqual(run({ mode: 'paths', paths: [bundle] }), [])
	})
})

test('--all refuses to pass a tree it never read', () => {
	// Outside a git checkout `git ls-files` lists nothing. GIT_* is dropped so a
	// hook's GIT_DIR cannot point the child back at this repo.
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
	)
	inTempDir((dir) => {
		const result = spawnSync(process.execPath, [SCRIPT, '--all'], {
			cwd: dir,
			env,
			encoding: 'utf8'
		})
		assert.equal(result.status, 2, result.stderr)
	})
})

// ---------------------------------------------------------------------------
// Expo config: apps/mobile/eas.json and app.json
// ---------------------------------------------------------------------------

test('flags a credential under a quoted key, as eas.json and app.json write it', () => {
	assert.ok(ids(`"SENTRY_AUTH_TOKEN": "${SENTRY_TOKEN}"`).includes('sensitive-assignment'))
	assert.ok(ids(`"authToken": "${SENTRY_TOKEN}"`).includes('sensitive-assignment'))
	assert.ok(ids(`'authToken': '${SENTRY_TOKEN}'`).includes('sensitive-assignment'))
	// The same line as a raw transcript quotes it, quotes escaped.
	assert.ok(
		ids(`{\\"SENTRY_AUTH_TOKEN\\": \\"${SENTRY_TOKEN}\\"}`).includes('sensitive-assignment')
	)
})

test('leaves the placeholders and $VAR references Expo config carries', () => {
	assert.equal(flags('"SENTRY_AUTH_TOKEN": "$SENTRY_AUTH_TOKEN"'), false)
	assert.equal(
		flags('"EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "REPLACE_WITH_PRODUCTION_PUBLISHABLE_KEY"'),
		false
	)
})

test('does not flag a RevenueCat public SDK key, but does flag its secret key', () => {
	for (const prefix of ['appl_', 'goog_', 'amzn_']) {
		const key = fake(prefix, noise(27))
		assert.equal(flags(`"EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "${key}"`), false, prefix)
		assert.equal(flags(`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${key}`), false, prefix)
	}
	const secret = fake('sk_', noise(30))
	assert.ok(ids(`"REVENUECAT_SECRET_KEY": "${secret}"`).includes('sensitive-assignment'))
})

test("the template's own eas.json and app.json scan clean", () => {
	for (const path of ['apps/mobile/eas.json', 'apps/mobile/app.json']) {
		const text = readFileSync(join(REPO, path), 'utf8')
		assert.ok(text.length > 0, path)
		assert.deepEqual(scanText(text), [], path)
	}
})

test('catches a real key pasted into eas.json, end to end', () => {
	// The template's profiles carry no env (values live in EAS environment
	// variables), so paste one the way a play might: into the production profile.
	const eas = JSON.parse(readFileSync(join(REPO, 'apps/mobile/eas.json'), 'utf8'))
	assert.ok(eas.build?.production, 'eas.json has no production profile to paste into')
	eas.build.production.env = { ...eas.build.production.env, SENTRY_AUTH_TOKEN: SENTRY_TOKEN }
	inTempDir((dir) => {
		const pasted = `${JSON.stringify(eas, null, '\t')}\n`
		const path = writeUnder(dir, 'apps/mobile/eas.json', pasted)
		const found = run({ mode: 'paths', paths: [path] })
		assert.equal(found.length, 1)
		assert.equal(found[0].ruleId, 'sensitive-assignment')
	})
})
