// GET /api/app/v1/config against its @app/contract schema: every build on
// every launch reads it, and anything but this exact shape makes the app open
// without the minimum-version gate.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { appConfigSchema } from '@app/contract'
import { GET } from './route'

const NAMES = [
	'APP_MIN_VERSION_IOS',
	'APP_MIN_VERSION_ANDROID',
	'APP_STORE_URL_IOS',
	'APP_STORE_URL_ANDROID'
] as const

afterEach(() => {
	for (const name of NAMES) delete process.env[name]
})

function get() {
	return GET(new NextRequest('http://web.test/api/app/v1/config'), {
		params: Promise.resolve({})
	})
}

async function quietly<T>(fn: () => Promise<T>) {
	const write = process.stdout.write
	process.stdout.write = (() => true) as typeof process.stdout.write
	try {
		return await fn()
	} finally {
		process.stdout.write = write
	}
}

test('nothing set: every key present and null, cached for a minute, no auth needed', async () => {
	const res = await get()
	assert.equal(res.status, 200)
	assert.equal(res.headers.get('cache-control'), 'public, max-age=60, s-maxage=60')
	assert.deepEqual(await res.json(), {
		min_supported_version: { ios: null, android: null },
		store_url: { ios: null, android: null }
	})
})

test('a minimum per platform, with its store listing, trimmed', async () => {
	process.env.APP_MIN_VERSION_IOS = ' 1.3.0 '
	process.env.APP_STORE_URL_IOS = 'https://apps.apple.com/app/id1234567890\n'
	process.env.APP_MIN_VERSION_ANDROID = '1.2'
	process.env.APP_STORE_URL_ANDROID =
		'https://play.google.com/store/apps/details?id=com.example.app'
	const res = await get()
	assert.equal(res.status, 200)
	const body = await res.json()
	assert.deepEqual(body, {
		min_supported_version: { ios: '1.3.0', android: '1.2' },
		store_url: {
			ios: 'https://apps.apple.com/app/id1234567890',
			android: 'https://play.google.com/store/apps/details?id=com.example.app'
		}
	})
	assert.equal(appConfigSchema.safeParse(body).success, true)
})

test('an empty value is unset', async () => {
	process.env.APP_MIN_VERSION_IOS = ''
	process.env.APP_STORE_URL_IOS = '   '
	const res = await get()
	assert.deepEqual((await res.json()).min_supported_version, { ios: null, android: null })
})

test('a body the app would reject is a 500, never a partial 200', async () => {
	for (const env of [
		{ APP_MIN_VERSION_IOS: '1.3.0' },
		{ APP_MIN_VERSION_ANDROID: '1.2.3.4', APP_STORE_URL_ANDROID: 'https://play.google.com/x' },
		{ APP_MIN_VERSION_IOS: '1.3.0', APP_STORE_URL_IOS: 'http://apps.apple.com/app/id1' }
	]) {
		Object.assign(process.env, env)
		const res = await quietly(get)
		assert.equal(res.status, 500, JSON.stringify(env))
		assert.equal(res.headers.get('cache-control'), 'private, no-store')
		assert.equal((await res.json()).error.code, 'internal')
		for (const name of NAMES) delete process.env[name]
	}
})
