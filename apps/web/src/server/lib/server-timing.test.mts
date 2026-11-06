// Server-Timing: per-request spans, the lazy timed query, and the timed client.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	serverTimingHeader,
	timeAi,
	timeAuth,
	timedThenable,
	withQueryTiming,
	withServerTiming
} from './server-timing'

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A stand-in for a Prisma query: runs only once awaited, as a PrismaPromise does. */
function lazyQuery<T>(value: T, runs: { count: number }, ms = 5) {
	return {
		then(onFulfilled?: (v: T) => unknown, onRejected?: (e: unknown) => unknown) {
			runs.count += 1
			return tick(ms)
				.then(() => value)
				.then(onFulfilled, onRejected)
		},
		marker: 'mine'
	}
}

test('the header names durations only, with a query count', () => {
	assert.equal(
		serverTimingHeader({ auth: 12.34, db: 5.06, dbCalls: 1, ai: 900.04, aiCalls: 2 }, 40.04),
		'auth;dur=12.3, db;dur=5.1;desc="1 call, summed", ai;dur=900;desc="2 calls, summed", total;dur=40'
	)
	assert.match(
		serverTimingHeader({ auth: 0, db: 0, dbCalls: 3, ai: 0, aiCalls: 0 }, 1),
		/desc="3 calls, summed"/
	)
})

test('a timed query is lazy: nothing runs until it is awaited', async () => {
	const runs = { count: 0 }
	const query = timedThenable(lazyQuery('row', runs))
	assert.equal(runs.count, 0)
	assert.equal(query.marker, 'mine')
	assert.equal(await query, 'row')
	assert.equal(runs.count, 1)
})

test('auth and each awaited query add to their own request only', async () => {
	const [a, b] = await Promise.all([
		withServerTiming(async () => {
			await timeAuth(() => tick(10))
			await timedThenable(lazyQuery(1, { count: 0 }))
			await timedThenable(lazyQuery(2, { count: 0 }))
			return 'a'
		}),
		withServerTiming(async () => {
			await timedThenable(lazyQuery(3, { count: 0 }))
			return 'b'
		})
	])
	assert.equal(a.result, 'a')
	assert.match(a.header, /desc="2 calls, summed"/)
	assert.doesNotMatch(a.header, /^auth;dur=0,/)
	assert.match(b.header, /^auth;dur=0, db;dur=[\d.]+;desc="1 call, summed"/)
})

test('a failed query is still counted, and catch and finally go through the timing', async () => {
	const failing = {
		then(_ok?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
			return Promise.reject(new Error('down')).then(undefined, onRejected)
		}
	}
	let finished = false
	const { header } = await withServerTiming(async () => {
		await timedThenable(failing).catch(() => 'handled')
		await timedThenable(lazyQuery(1, { count: 0 })).finally(() => {
			finished = true
		})
	})
	assert.ok(finished)
	assert.match(header, /desc="2 calls, summed"/)
})

test('the timed client times model methods, raw queries and transactions, and passes the rest through', async () => {
	const runs = { count: 0 }
	const client = {
		gap: {
			findMany: (args: { take: number }) => lazyQuery([args.take], runs),
			fields: { id: 'id' }
		},
		$transaction: (fn: () => Promise<string>) => fn(),
		$queryRaw: () => lazyQuery(['raw'], runs),
		name: 'db',
		hello() {
			return `hi from ${this.name}`
		}
	}
	const db = withQueryTiming(client)
	assert.equal(db.hello(), 'hi from db')
	assert.deepEqual(db.gap.fields, { id: 'id' })
	assert.equal(db.gap, db.gap)
	const { header } = await withServerTiming(async () => {
		assert.deepEqual(await db.gap.findMany({ take: 2 }), [2])
		await db.$queryRaw()
		await db.$transaction(async () => 'done')
	})
	assert.match(header, /desc="3 calls, summed"/)
	assert.equal(runs.count, 2)
})

test('outside a request nothing is recorded and everything still works', async () => {
	assert.equal(await timeAuth(async () => 'ok'), 'ok')
	assert.equal(await timedThenable(lazyQuery('x', { count: 0 })), 'x')
})

test('AI calls get their own span, separate from the database', async () => {
	const { header } = await withServerTiming(async () => {
		await timeAi(() => tick(10))
		await timedThenable(lazyQuery(1, { count: 0 }))
		await timeAi(() => Promise.reject(new Error('busy'))).catch(() => 'handled')
	})
	assert.match(header, /db;dur=[\d.]+;desc="1 call, summed"/)
	assert.match(header, /ai;dur=[\d.]+;desc="2 calls, summed"/)
	assert.equal(await timeAi(async () => 'outside'), 'outside')
})
