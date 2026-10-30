// POST /api/app/v1/uploads: a signed upload URL for an avatar, at a path the route picks under
// the caller's own folder. The storage calls are recorded, so "the device never chose the
// path" and "nothing was signed" are assertions.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { avatarPathSchema, createUploadResponse, MAX_AVATAR_BYTES } from '@app/contract'
import { fake, OTHER, reset, send, USER } from '@/server/api/app-test-kit.mts'

const uploads = await import('./route')

const PATH = new RegExp(`^${USER}/avatar/[0-9a-f-]{36}\\.(jpg|png|webp|heic)$`)
const HOUR = 60 * 60 * 1000

function signsUploads() {
	fake.storage = ({ method, url }) => {
		const path = decodeURIComponent(url.pathname.replace('/storage/v1/object/upload/sign/', ''))
		assert.equal(method, 'POST')
		return Response.json({ url: `/object/upload/sign/${path}?token=fake-upload-token` })
	}
}

beforeEach(() => {
	reset()
	signsUploads()
})

const signed = () =>
	fake.fetchCalls.filter((call) => call.url.pathname.startsWith('/storage/v1/object/upload/sign/'))

test("an avatar upload: 201, a path in the caller's folder, a URL valid for two hours", async () => {
	const before = Date.now()
	const res = await send(uploads.POST, '/api/app/v1/uploads', {
		method: 'POST',
		body: { purpose: 'avatar', content_type: 'image/jpeg', size_bytes: 120_000 }
	})
	assert.equal(res.status, 201)
	assert.equal(res.headers.get('cache-control'), 'private, no-store')
	assert.ok(createUploadResponse.safeParse(res.body).success)

	const { upload } = res.body
	assert.equal(upload.bucket, 'user-uploads')
	assert.match(upload.path, PATH)
	assert.ok(upload.path.endsWith('.jpg'))
	assert.ok(avatarPathSchema.safeParse(upload.path).success, 'PATCH profile accepts it back')
	assert.equal(upload.token, 'fake-upload-token')
	assert.equal(
		upload.signed_url,
		`http://supabase.test/storage/v1/object/upload/sign/user-uploads/${upload.path}?token=fake-upload-token`
	)
	const expires = Date.parse(upload.expires_at)
	assert.ok(expires >= before + 2 * HOUR && expires <= Date.now() + 2 * HOUR)

	assert.equal(signed().length, 1)
	assert.equal(
		signed()[0].url.pathname,
		`/storage/v1/object/upload/sign/user-uploads/${upload.path}`
	)
})

test('the extension follows the content type, and every upload gets a fresh path', async () => {
	const paths = new Set<string>()
	for (const [type, ext] of [
		['image/png', 'png'],
		['image/webp', 'webp'],
		['image/heic', 'heic'],
		['image/png', 'png']
	]) {
		const res = await send(uploads.POST, '/api/app/v1/uploads', {
			method: 'POST',
			body: { purpose: 'avatar', content_type: type, size_bytes: 1 }
		})
		assert.equal(res.status, 201, type)
		assert.ok(res.body.upload.path.endsWith(`.${ext}`), type)
		paths.add(res.body.upload.path)
	}
	assert.equal(paths.size, 4)
})

test('another type, a file too big, another purpose, or a path of its own: 400, nothing signed', async () => {
	for (const body of [
		{ purpose: 'avatar', content_type: 'image/gif', size_bytes: 1 },
		{ purpose: 'avatar', content_type: 'image/svg+xml', size_bytes: 1 },
		{ purpose: 'avatar', content_type: 'image/jpeg', size_bytes: MAX_AVATAR_BYTES + 1 },
		{ purpose: 'avatar', content_type: 'image/jpeg', size_bytes: 0 },
		{ purpose: 'document', content_type: 'image/jpeg', size_bytes: 1 },
		{ purpose: 'avatar', content_type: 'image/jpeg', size_bytes: 1, path: `${OTHER}/avatar/x.jpg` },
		{ purpose: 'avatar', content_type: 'image/jpeg', size_bytes: 1, user_id: OTHER }
	]) {
		const res = await send(uploads.POST, '/api/app/v1/uploads', { method: 'POST', body })
		assert.equal(res.status, 400, JSON.stringify(body))
		assert.equal(res.body.error.code, 'invalid_request')
	}
	assert.deepEqual(signed(), [])
})

test('no session: 401, nothing signed', async () => {
	const res = await send(uploads.POST, '/api/app/v1/uploads', {
		method: 'POST',
		token: null,
		body: { purpose: 'avatar', content_type: 'image/jpeg', size_bytes: 1 }
	})
	assert.equal(res.status, 401)
	assert.deepEqual(signed(), [])
})

test('storage refusing (no bucket, or down): a 500, logged, never a 201 without a URL', async () => {
	fake.storage = () =>
		Response.json(
			{ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' },
			{ status: 400 }
		)
	const res = await send(uploads.POST, '/api/app/v1/uploads', {
		method: 'POST',
		body: { purpose: 'avatar', content_type: 'image/jpeg', size_bytes: 1 }
	})
	assert.equal(res.status, 500)
	assert.equal(res.body.error.code, 'internal')
	assert.equal(res.logs.length, 1)
})
