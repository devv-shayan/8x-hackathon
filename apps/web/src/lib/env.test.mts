// The env schema runs once at boot (src/instrumentation.ts) and throws when it
// fails, which takes every dynamic route down with it. So each case boots the
// real module in a fresh process with a clean environment and checks whether
// it would have stopped the server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const WEB_ROOT = fileURLToPath(new URL('../../', import.meta.url))

function boot(env: Record<string, string>) {
	const result = spawnSync(
		process.execPath,
		[
			'--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
			'--import',
			'./scripts/register-ts.mjs',
			'--input-type=module',
			'-e',
			"await import('./src/lib/env.ts')"
		],
		{ cwd: WEB_ROOT, env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' }
	)
	return { ok: result.status === 0, stderr: result.stderr }
}

test('boots with nothing set', () => {
	assert.equal(boot({ NODE_ENV: 'development' }).ok, true)
	assert.equal(boot({ NODE_ENV: 'test' }).ok, true)
})

test('a production runtime boots without the RevenueCat webhook secret', () => {
	// The webhook refuses every event on its own (503, nothing written, an
	// error logged). Failing the boot would take every other route down too.
	// A Vercel production *build* fails instead: deploy-checks.mjs.
	for (const env of [
		{ NODE_ENV: 'production' },
		{ NODE_ENV: 'production', VERCEL_ENV: 'production' },
		{ NODE_ENV: 'production', VERCEL_ENV: 'preview' }
	]) {
		assert.equal(boot(env).ok, true, JSON.stringify(env))
	}
})

test('the minimum-version gate: a minimum needs its store listing', () => {
	const ios = {
		NODE_ENV: 'production',
		APP_MIN_VERSION_IOS: '1.3.0',
		APP_STORE_URL_IOS: 'https://apps.apple.com/app/id1234567890'
	}
	assert.equal(boot(ios).ok, true)
	assert.equal(
		boot({ NODE_ENV: 'production', APP_MIN_VERSION_ANDROID: '', APP_STORE_URL_ANDROID: '' }).ok,
		true
	)

	for (const [env, name] of [
		[{ APP_MIN_VERSION_IOS: '1.3.0' }, /APP_STORE_URL_IOS/],
		[{ APP_MIN_VERSION_ANDROID: '2', APP_STORE_URL_ANDROID: '' }, /APP_STORE_URL_ANDROID/],
		[
			{ APP_MIN_VERSION_IOS: 'v1.3', APP_STORE_URL_IOS: ios.APP_STORE_URL_IOS },
			/APP_MIN_VERSION_IOS/
		],
		[{ APP_STORE_URL_IOS: 'http://apps.apple.com/app/id1' }, /APP_STORE_URL_IOS/]
	] as const) {
		const { ok, stderr } = boot({ NODE_ENV: 'production', ...env })
		assert.equal(ok, false, JSON.stringify(env))
		assert.match(stderr, name)
	}
})

test('a malformed value fails the boot, naming the variable', () => {
	const { ok, stderr } = boot({ NODE_ENV: 'development', LOG_LEVEL: 'loud' })
	assert.equal(ok, false)
	assert.match(stderr, /LOG_LEVEL/)
})
