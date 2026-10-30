import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { CHECKS } from './check-standards.mjs'
import { STORE_RULES, checkStoreReadiness } from './check-store-readiness.mjs'
import {
	LOGIN_SCREEN,
	MOBILE,
	REPO_ROOT,
	WEB,
	createMonorepoFixture,
	edit,
	editJson,
	write
} from './standards-fixture.mjs'

const SCRIPT = join(REPO_ROOT, 'scripts/check-store-readiness.mjs')

function run(root, ...args) {
	const result = spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024
	})
	return { ...result, report: args.includes('--json') ? JSON.parse(result.stdout) : null }
}

function withFixture(mutate, fn) {
	const root = createMonorepoFixture()
	try {
		mutate(root)
		return fn(root)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

// Google on the web, Apple only on the web too: the template's login today.
function webAppleOnly(root) {
	editJson(root, `${MOBILE}/package.json`, (pkg) => {
		delete pkg.dependencies['expo-apple-authentication']
	})
	edit(root, `${MOBILE}/app/(auth)/login.tsx`, () =>
		[
			"import { supabase } from '@/lib/supabase'",
			'',
			"export const signIn = (provider: 'google' | 'apple') =>",
			'\tsupabase.auth.signInWithOAuth({ provider })',
			''
		].join('\n')
	)
}

test('every store rule is one of the checker’s expo standards, not a second implementation', () => {
	for (const { id, guideline } of STORE_RULES) {
		const check = CHECKS.find((candidate) => candidate.id === id)
		assert.ok(check, `${id} is not a standard in check-standards.mjs`)
		assert.deepEqual(check.kinds, ['expo'], id)
		assert.match(guideline, /^(?:Apple|Play)\b/, id)
	}
})

test('this repo is store-ready, and --strict fails exactly when a store rule is pending', () => {
	const normal = run(REPO_ROOT, '--json')
	const blocking = normal.report.results.filter(
		(result) => result.status === 'unmet' || result.status === 'stale'
	)
	assert.deepEqual(
		blocking.map((result) => `${result.id}: ${result.detail}`),
		[]
	)
	assert.equal(normal.status, 0)
	assert.deepEqual(
		normal.report.results.map((result) => `${result.workspace} ${result.id}`),
		STORE_RULES.map((rule) => `${MOBILE} ${rule.id}`)
	)
	const pending = normal.report.results.some((result) => result.status === 'pending')
	assert.equal(run(REPO_ROOT, '--json', '--strict').status, pending ? 1 : 0)
})

test('the fixture app meets every store rule, and the CLI says so', () => {
	withFixture(
		() => {},
		(root) => {
			const report = checkStoreReadiness({ root })
			assert.deepEqual(
				report.results
					.filter((result) => !result.ok)
					.map((result) => `${result.id}: ${result.detail}`),
				[]
			)
			assert.equal(report.isReady, true)
			assert.equal(report.results.length, STORE_RULES.length)
			const cli = run(root)
			assert.equal(cli.status, 0, cli.stderr)
			assert.match(cli.stdout, /8 of 8 store rules met, 0 pending\./)
		}
	)
})

test('an unmet rule fails check:store, naming the guideline and the fix', () => {
	withFixture(webAppleOnly, (root) => {
		const report = checkStoreReadiness({ root })
		assert.equal(report.isReady, false)
		const rule = report.results.find((result) => result.id === 'sign-in-with-apple')
		assert.equal(rule.status, 'unmet')
		assert.equal(rule.guideline, 'Apple 4.8')
		assert.match(rule.detail, /fix: add expo-apple-authentication/)
		const cli = run(root)
		assert.equal(cli.status, 1)
		assert.match(cli.stdout, /✗ sign-in-with-apple\s+Apple 4\.8/)
	})
})

test('a pending rule passes check:store, fails it with --strict, and fails once met', () => {
	withFixture(
		(root) => {
			webAppleOnly(root)
			write(root, 'scripts/standards-exceptions.json', {
				pending: { 'sign-in-with-apple': 'unscheduled: found by PR 13' }
			})
		},
		(root) => {
			assert.equal(checkStoreReadiness({ root }).isReady, true)
			assert.equal(checkStoreReadiness({ root, strict: true }).isReady, false)
			const strict = run(root, '--strict')
			assert.equal(strict.status, 1)
			assert.match(strict.stderr, /with --strict, pending rules block a store build too/)
			// Fixed, but still listed: the entry is stale and blocks.
			write(root, `${MOBILE}/app/(auth)/login.tsx`, LOGIN_SCREEN)
			editJson(root, `${MOBILE}/package.json`, (pkg) => {
				pkg.dependencies['expo-apple-authentication'] = '1.0.0'
			})
			const stale = checkStoreReadiness({ root })
			assert.equal(stale.isReady, false)
			assert.equal(
				stale.results.find((result) => result.id === 'sign-in-with-apple').status,
				'stale'
			)
		}
	)
})

test('check:store judges only its own rules against the exceptions file', () => {
	// A pending entry for a standard check:store does not run (ota-configured)
	// is neither unknown here nor a reason to fail.
	withFixture(
		(root) =>
			write(root, 'scripts/standards-exceptions.json', {
				pending: { 'ota-configured': 'PR 12' }
			}),
		(root) => {
			const report = checkStoreReadiness({ root })
			assert.deepEqual(report.unknown, [])
			assert.equal(report.isReady, true)
		}
	)
})

test('check:store refuses to pass when there is no Expo app to review', () => {
	withFixture(
		(root) => write(root, 'standards.config.json', { workspaces: [{ path: WEB, kind: 'next' }] }),
		(root) => {
			const report = checkStoreReadiness({ root })
			assert.equal(report.isReady, false)
			assert.equal(report.results.length, 0)
			assert.match(report.problems[0], /no expo workspace/)
			assert.equal(run(root).status, 1)
		}
	)
})

test('the Android rule is judged on the resolved build: blocked storage permissions pass', () => {
	// The fixture's prebuild template and expo-image-picker both request
	// READ_EXTERNAL_STORAGE; android.blockedPermissions removing it is the fix.
	withFixture(
		() => {},
		(root) => {
			const rule = checkStoreReadiness({ root }).results.find(
				(result) => result.id === 'android-permissions-minimal'
			)
			assert.equal(rule.ok, true, rule.detail)
		}
	)
	withFixture(
		(root) =>
			editJson(root, `${MOBILE}/app.json`, (app) => {
				app.expo.android.blockedPermissions = []
			}),
		(root) => {
			const rule = checkStoreReadiness({ root }).results.find(
				(result) => result.id === 'android-permissions-minimal'
			)
			assert.equal(rule.ok, false)
			assert.match(rule.detail, /READ_EXTERNAL_STORAGE is requested \(Expo's prebuild template/)
		}
	)
})
