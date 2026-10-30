// GET and PATCH /api/app/v1/profile. PATCH is the one profile write the app reaches, so the
// money rule is tested here from the outside: nothing but the four own settings reaches the
// store, whatever the body says (AGENTS.md, non-negotiable 3). Also: the consent event fires
// on a change and only then, and an avatar is only ever the caller's own upload.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { profileResponse } from '@app/contract'
import { EMAIL, fake, fakeStore, OTHER, reset, send, USER } from '@/server/api/app-test-kit.mts'

const profile = await import('./route')
const { profileStore } = await import('@/server/db/profiles')
const { analyticsStore } = await import('@/server/db/analytics')

const AVATAR = `${USER}/avatar/9f0c3a7e-1d2b-4c5d-8e6f-7a8b9c0d1e2f.jpg`
const OLD_AVATAR = `${USER}/avatar/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.png`
const THEIRS = `${OTHER}/avatar/9f0c3a7e-1d2b-4c5d-8e6f-7a8b9c0d1e2f.jpg`

const row = {
	displayName: 'Sam Rivera',
	avatarUrl: AVATAR,
	planType: 'premium',
	locale: 'pt-BR',
	marketingConsent: true,
	createdAt: new Date('2026-09-01T00:00:00.000Z')
}

type Storage = { signed: string[]; listed: string[]; removed: string[][] }
let storage: Storage

// A storage backend holding the person's two avatar files. `signFails` / `listFails`: that
// operation answers a 500.
function storageWith({ missing = false, signFails = false, listFails = false } = {}) {
	fake.storage = async ({ method, url, body }) => {
		const path = decodeURIComponent(url.pathname)
		if (path.startsWith('/storage/v1/object/sign/user-uploads/')) {
			const object = path.replace('/storage/v1/object/sign/user-uploads/', '')
			storage.signed.push(object)
			if (signFails) {
				return Response.json({ statusCode: '500', error: 'x', message: 'down' }, { status: 500 })
			}
			if (missing) {
				return Response.json(
					{ statusCode: '404', error: 'not_found', message: 'Object not found' },
					{ status: 400 }
				)
			}
			return Response.json({ signedURL: `/object/sign/user-uploads/${object}?token=download` })
		}
		if (path === '/storage/v1/object/list/user-uploads') {
			storage.listed.push((body as { prefix: string }).prefix)
			if (listFails) {
				return Response.json({ statusCode: '500', error: 'x', message: 'down' }, { status: 500 })
			}
			return Response.json([
				{ name: AVATAR.split('/').pop(), id: 'a' },
				{ name: OLD_AVATAR.split('/').pop(), id: 'b' }
			])
		}
		if (path === '/storage/v1/object/user-uploads' && method === 'DELETE') {
			const { prefixes } = body as { prefixes: string[] }
			storage.removed.push(prefixes)
			return Response.json(prefixes.map((name) => ({ name })))
		}
		return Response.json({ error: `unexpected ${method} ${path}` }, { status: 500 })
	}
}

beforeEach(() => {
	reset()
	storage = { signed: [], listed: [], removed: [] }
	storageWith()
	fakeStore(profileStore, 'appProfile', () => row)
	fakeStore(profileStore, 'updateOwnSettings', () => ({ profile: row, consentChanged: false }))
	fakeStore(profileStore, 'regionOf', () => 'BR')
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const events = () => fake.fetchCalls.filter((call) => call.url.host === 'platform.test')
const stored = (method: string) => fake.storeCalls.filter((call) => call.method === method)

test("GET: the person's profile, plan read-only, avatar signed for an hour", async () => {
	const res = await send(profile.GET, '/api/app/v1/profile')
	assert.equal(res.status, 200)
	assert.equal(res.headers.get('cache-control'), 'private, no-store')
	assert.ok(profileResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, {
		profile: {
			id: USER,
			email: EMAIL,
			display_name: 'Sam Rivera',
			avatar_url: `http://supabase.test/storage/v1/object/sign/user-uploads/${AVATAR}?token=download`,
			plan: 'premium',
			locale: 'pt-BR',
			marketing_consent: true,
			created_at: '2026-09-01T00:00:00.000Z'
		}
	})
	assert.deepEqual(storage.signed, [AVATAR])
	const sign = fake.fetchCalls.find((call) => call.url.pathname.includes('/object/sign/'))
	assert.deepEqual(sign?.body, { expiresIn: 3600 })
	assert.deepEqual(
		stored('appProfile').map((call) => call.args),
		[[USER]]
	)
})

test('GET: no profile row reads as the defaults, with the name from sign-up', async () => {
	fakeStore(profileStore, 'appProfile', () => null)
	fake.userMetadata = { full_name: '  Sam  ' }
	const res = await send(profile.GET, '/api/app/v1/profile')
	assert.equal(res.status, 200)
	assert.deepEqual(res.body.profile, {
		id: USER,
		email: EMAIL,
		display_name: 'Sam',
		avatar_url: null,
		plan: 'free',
		locale: null,
		marketing_consent: false,
		created_at: null
	})
})

test('GET: any plan_type but premium is free', async () => {
	for (const planType of ['free', 'trial', 'granted', '']) {
		fakeStore(profileStore, 'appProfile', () => ({ ...row, planType }))
		const res = await send(profile.GET, '/api/app/v1/profile')
		assert.equal(res.body.profile.plan, 'free', planType)
	}
})

test("GET: an avatar that is someone else's file, or not https, is null and never signed", async () => {
	for (const avatarUrl of [
		THEIRS,
		`${USER}/avatar/../../${OTHER}/avatar/x.jpg`,
		'http://cdn.test/a.png',
		'not a path'
	]) {
		fakeStore(profileStore, 'appProfile', () => ({ ...row, avatarUrl }))
		const res = await send(profile.GET, '/api/app/v1/profile')
		assert.equal(res.status, 200)
		assert.equal(res.body.profile.avatar_url, null, avatarUrl)
	}
	assert.deepEqual(storage.signed, [])

	fakeStore(profileStore, 'appProfile', () => ({
		...row,
		avatarUrl: 'https://lh3.example.test/a.png'
	}))
	const provider = await send(profile.GET, '/api/app/v1/profile')
	assert.equal(provider.body.profile.avatar_url, 'https://lh3.example.test/a.png')
})

test('GET: a file gone from storage is no avatar; storage down costs the avatar, not the profile', async () => {
	storageWith({ missing: true })
	const gone = await send(profile.GET, '/api/app/v1/profile')
	assert.equal(gone.status, 200)
	assert.equal(gone.body.profile.avatar_url, null)
	assert.equal(gone.logs.length, 0)

	storageWith({ signFails: true })
	const down = await send(profile.GET, '/api/app/v1/profile')
	assert.equal(down.status, 200)
	assert.equal(down.body.profile.avatar_url, null)
	assert.equal(down.body.profile.display_name, 'Sam Rivera')
	assert.equal(down.logs.length, 1)
})

test('GET and PATCH: no session is a 401, and nothing is read or written', async () => {
	assert.equal((await send(profile.GET, '/api/app/v1/profile', { token: null })).status, 401)
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		token: 'expired',
		body: { display_name: 'x' }
	})
	assert.equal(res.status, 401)
	assert.deepEqual(fake.storeCalls, [])
})

test('PATCH: only the four own settings reach the store, trimmed', async () => {
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		body: { display_name: '  Sam R  ', locale: 'en-GB', marketing_consent: true }
	})
	assert.equal(res.status, 200)
	assert.ok(profileResponse.safeParse(res.body).success)
	assert.deepEqual(
		stored('updateOwnSettings').map((call) => call.args),
		[
			[
				USER,
				{ displayName: 'Sam R', avatarUrl: undefined, locale: 'en-GB', marketingConsent: true }
			]
		]
	)
})

test('PATCH: plan_type, premium_*, is_admin, region, an id: a 400, and nothing is written', async () => {
	for (const body of [
		{ plan_type: 'premium' },
		{ display_name: 'x', plan_type: 'premium' },
		{ display_name: 'x', plan: 'premium' },
		{ premium_status: 'active' },
		{ premium_expires_at: '2099-01-01T00:00:00Z' },
		{ is_admin: true },
		{ region: 'US' },
		{ id: OTHER, display_name: 'x' },
		{},
		{ display_name: '   ' },
		{ locale: 'not a locale!' },
		{ marketing_consent: 'yes' }
	]) {
		const res = await send(profile.PATCH, '/api/app/v1/profile', { method: 'PATCH', body })
		assert.equal(res.status, 400, JSON.stringify(body))
		assert.equal(res.body.error.code, 'invalid_request')
	}
	assert.deepEqual(fake.storeCalls, [])
	assert.deepEqual(events(), [])
})

test('PATCH: a consent change fires marketing_consent_changed, first-party and to the platform', async () => {
	fakeStore(profileStore, 'updateOwnSettings', () => ({
		profile: { ...row, marketingConsent: false },
		consentChanged: true
	}))
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		body: { marketing_consent: false }
	})
	assert.equal(res.status, 200)
	assert.equal(res.body.profile.marketing_consent, false)

	const [inserted] = stored('insertEvent')
	assert.deepEqual(inserted?.args, [
		{
			userId: USER,
			name: 'marketing_consent_changed',
			path: '/api/app/v1/profile',
			metadata: { subscribed: false, country: 'BR' }
		}
	])
	// Every change is recorded: no daily dedupe check.
	assert.deepEqual(stored('hasDuplicate'), [])

	assert.equal(events().length, 1)
	const event = events()[0].body as Record<string, unknown>
	assert.equal(event.event, 'marketing_consent_changed')
	assert.deepEqual(event.user, {
		id: USER,
		email: EMAIL,
		locale: 'pt-BR',
		marketing_consent: false
	})
	assert.deepEqual(event.properties, { subscribed: false, source: 'app' })
})

test('PATCH: an account deleted after the token check is a 401, with nothing fired or removed', async () => {
	// The store answers null when the profiles_require_auth_user trigger refuses the row.
	fakeStore(profileStore, 'updateOwnSettings', () => null)
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		body: { marketing_consent: false, avatar_path: AVATAR }
	})
	assert.equal(res.status, 401)
	assert.equal(res.body.error.code, 'unauthorized')
	assert.deepEqual(stored('insertEvent'), [])
	assert.deepEqual(events(), [])
	assert.deepEqual(storage.listed, [])
})

test('PATCH: sending the consent it already has fires nothing', async () => {
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		body: { marketing_consent: true }
	})
	assert.equal(res.status, 200)
	assert.deepEqual(stored('insertEvent'), [])
	assert.deepEqual(events(), [])
})

test("PATCH: avatar_path saves the caller's own upload, then removes their other files", async () => {
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		body: { avatar_path: AVATAR }
	})
	assert.equal(res.status, 200)
	const [update] = stored('updateOwnSettings')
	assert.equal((update?.args[1] as { avatarUrl?: string }).avatarUrl, AVATAR)
	assert.deepEqual(storage.listed, [`${USER}/avatar`])
	assert.deepEqual(storage.removed, [[OLD_AVATAR]])
	assert.match(res.body.profile.avatar_url, /\/object\/sign\/user-uploads\//)
})

test('PATCH: avatar_path null clears it and removes every file', async () => {
	fakeStore(profileStore, 'updateOwnSettings', () => ({
		profile: { ...row, avatarUrl: null },
		consentChanged: false
	}))
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		body: { avatar_path: null }
	})
	assert.equal(res.status, 200)
	assert.equal(res.body.profile.avatar_url, null)
	assert.deepEqual(storage.removed, [[AVATAR, OLD_AVATAR]])
})

test("PATCH: someone else's upload, or a path of another shape, is a 400 and nothing is written", async () => {
	for (const avatar_path of [
		THEIRS,
		`${USER}/avatar/x.jpg`,
		`${USER}/other/9f0c3a7e-1d2b-4c5d-8e6f-7a8b9c0d1e2f.jpg`
	]) {
		const res = await send(profile.PATCH, '/api/app/v1/profile', {
			method: 'PATCH',
			body: { avatar_path }
		})
		assert.equal(res.status, 400, avatar_path)
		assert.deepEqual(
			res.body.error.issues.map((issue: { path: string }) => issue.path),
			['avatar_path']
		)
	}
	assert.deepEqual(fake.storeCalls, [])
	assert.deepEqual(storage.removed, [])
})

test("PATCH: old files that can't be removed don't fail the save", async () => {
	storageWith({ listFails: true })
	const res = await send(profile.PATCH, '/api/app/v1/profile', {
		method: 'PATCH',
		body: { avatar_path: AVATAR }
	})
	assert.equal(res.status, 200)
	assert.equal(res.logs.filter((line) => line.level === 'warn').length, 1)
})
