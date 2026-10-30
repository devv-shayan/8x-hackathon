// deploy-checks.mjs fails a Vercel production build that would ship without a
// usable RevenueCat webhook secret or without a usable DATABASE_URL, and
// nothing else. next.config.mjs runs both for `next build` only.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
	assertProductionBuildEnv,
	assertProductionDatabaseEnv,
	databaseUrlProblem,
	MIN_WEBHOOK_SECRET_LENGTH,
	webhookSecretProblem
} from '../../deploy-checks.mjs'
import nextConfig from '../../next.config.mjs'

const VALID = 'a'.repeat(MIN_WEBHOOK_SECRET_LENGTH)
// Supabase's transaction pooler, as docs/ENV_SETUP.md asks for it. A placeholder password.
const VALID_DATABASE_URL =
	'postgresql://postgres.project:placeholder-password@pooler.example.com:6543/postgres?pgbouncer=true&connection_limit=1'
const saved = { ...process.env }

afterEach(() => {
	for (const name of ['VERCEL_ENV', 'REVENUECAT_WEBHOOK_SECRET', 'DATABASE_URL']) {
		if (saved[name] === undefined) delete process.env[name]
		else process.env[name] = saved[name]
	}
})

test('a usable secret: visible ASCII, at least the minimum length, trimmed first', () => {
	assert.equal(webhookSecretProblem(VALID), null)
	assert.equal(webhookSecretProblem(`  ${VALID}\n`), null)
	assert.equal(webhookSecretProblem('0123456789abcdef'.repeat(4)), null)
})

test('an unusable secret, and why', () => {
	for (const [value, reason] of [
		[undefined, /is not set/],
		['', /is not set/],
		['   \n', /is not set/],
		['a'.repeat(MIN_WEBHOOK_SECRET_LENGTH - 1), /shorter than 32/],
		[`${VALID.slice(1)} x`, /whitespace or a non-ASCII/],
		[`${VALID}é`, /whitespace or a non-ASCII/],
		[`${VALID}​`, /whitespace or a non-ASCII/]
	] as const) {
		assert.match(webhookSecretProblem(value) ?? '', reason, JSON.stringify(value))
	}
})

test('fails only a Vercel production build', () => {
	assert.throws(
		() => assertProductionBuildEnv({ VERCEL_ENV: 'production' }),
		/REVENUECAT_WEBHOOK_SECRET is not set.*Bearer <the same value>/s
	)
	assert.throws(
		() =>
			assertProductionBuildEnv({ VERCEL_ENV: 'production', REVENUECAT_WEBHOOK_SECRET: 'short' }),
		/shorter than 32/
	)
	assert.doesNotThrow(() =>
		assertProductionBuildEnv({ VERCEL_ENV: 'production', REVENUECAT_WEBHOOK_SECRET: VALID })
	)
	for (const env of [{}, { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }]) {
		assert.doesNotThrow(() => assertProductionBuildEnv(env), JSON.stringify(env))
	}
})

test('never puts the secret in the error', () => {
	const secret = 'x'.repeat(MIN_WEBHOOK_SECRET_LENGTH - 1)
	assert.throws(
		() => assertProductionBuildEnv({ VERCEL_ENV: 'production', REVENUECAT_WEBHOOK_SECRET: secret }),
		(error: Error) => !error.message.includes(secret)
	)
})

test('next.config.mjs runs it for `next build`, and for no other phase', () => {
	process.env.VERCEL_ENV = 'production'
	delete process.env.REVENUECAT_WEBHOOK_SECRET
	assert.throws(() => nextConfig('phase-production-build'), /REVENUECAT_WEBHOOK_SECRET/)
	for (const phase of ['phase-development-server', 'phase-production-server', 'phase-test']) {
		assert.doesNotThrow(() => nextConfig(phase), phase)
	}
	process.env.REVENUECAT_WEBHOOK_SECRET = VALID
	process.env.DATABASE_URL = VALID_DATABASE_URL
	assert.equal(nextConfig('phase-production-build').reactStrictMode, true)
})

test('a usable DATABASE_URL: postgres, a host, a database, pgbouncer=true on the pooler', () => {
	for (const value of [
		VALID_DATABASE_URL,
		`  ${VALID_DATABASE_URL}\n`,
		'postgres://postgres:placeholder-password@db.example.com:5432/postgres',
		'postgresql://postgres:placeholder-password@db.example.com/postgres'
	]) {
		assert.equal(databaseUrlProblem(value), null, value)
	}
})

test('an unusable DATABASE_URL, and why', () => {
	for (const [value, reason] of [
		[undefined, /is not set/],
		['', /is not set/],
		['  \n', /is not set/],
		['pooler.example.com:6543/postgres', /is not a postgresql:\/\/ URL/],
		['not a url', /is not a URL/],
		// A password with an unencoded "/" ends the host early, at a port that isn't one.
		['postgresql://postgres:pass/word@pooler.example.com:6543/postgres', /percent-encode/],
		['mysql://root:placeholder-password@db.example.com:3306/app', /is not a postgresql/],
		['https://pooler.example.com/postgres', /is not a postgresql/],
		['postgresql://postgres:placeholder-password@localhost:5432/postgres', /localhost/],
		['postgresql://postgres:placeholder-password@127.0.0.1:54322/postgres', /localhost/],
		['postgresql://postgres:placeholder-password@pooler.example.com:6543', /names no database/],
		['postgresql://postgres:placeholder-password@pooler.example.com:6543/', /names no database/],
		[
			'postgresql://postgres:placeholder-password@pooler.example.com:6543/postgres',
			/transaction pooler \(port 6543\) without pgbouncer=true/
		],
		[
			'postgresql://postgres:placeholder-password@pooler.example.com:6543/postgres?pgbouncer=false',
			/without pgbouncer=true/
		]
	] as const) {
		assert.match(databaseUrlProblem(value) ?? '', reason, JSON.stringify(value))
	}
})

test('the DATABASE_URL check fails only a Vercel production build', () => {
	assert.throws(
		() => assertProductionDatabaseEnv({ VERCEL_ENV: 'production' }),
		/DATABASE_URL is not set.*Transaction pooler.*DIRECT_URL is not needed on Vercel/s
	)
	assert.doesNotThrow(() =>
		assertProductionDatabaseEnv({ VERCEL_ENV: 'production', DATABASE_URL: VALID_DATABASE_URL })
	)
	for (const env of [{}, { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }]) {
		assert.doesNotThrow(() => assertProductionDatabaseEnv(env), JSON.stringify(env))
	}
	// Separate from the webhook check: a valid webhook secret doesn't satisfy it, and it
	// never looks at the secret.
	assert.throws(
		() =>
			assertProductionDatabaseEnv({ VERCEL_ENV: 'production', REVENUECAT_WEBHOOK_SECRET: VALID }),
		/DATABASE_URL is not set/
	)
	assert.doesNotThrow(() =>
		assertProductionBuildEnv({ VERCEL_ENV: 'production', REVENUECAT_WEBHOOK_SECRET: VALID })
	)
})

test('never puts the database URL, its password or its host in the error', () => {
	for (const value of [
		'postgresql://postgres:placeholder-password@pooler.example.com:6543/postgres',
		'postgresql://postgres:placeholder-password@localhost:5432/postgres',
		'postgresql://postgres:placeholder@password@pooler.example.com:6543/postgres',
		'mysql://root:placeholder-password@pooler.example.com:3306/app'
	]) {
		assert.throws(
			() => assertProductionDatabaseEnv({ VERCEL_ENV: 'production', DATABASE_URL: value }),
			(error: Error) =>
				!error.message.includes('placeholder') && !error.message.includes('pooler.example.com'),
			value
		)
	}
})

test('next.config.mjs fails `next build` on a missing DATABASE_URL, and only `next build`', () => {
	process.env.VERCEL_ENV = 'production'
	process.env.REVENUECAT_WEBHOOK_SECRET = VALID
	delete process.env.DATABASE_URL
	assert.throws(() => nextConfig('phase-production-build'), /DATABASE_URL is not set/)
	for (const phase of ['phase-development-server', 'phase-production-server', 'phase-test']) {
		assert.doesNotThrow(() => nextConfig(phase), phase)
	}
	process.env.VERCEL_ENV = 'preview'
	assert.equal(nextConfig('phase-production-build').reactStrictMode, true)
})
