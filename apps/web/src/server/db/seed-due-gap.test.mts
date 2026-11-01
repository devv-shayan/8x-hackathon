import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { isGapDue } from '@/server/gaps/schedule'

// The seed on a real database: one due gap, and a second run keeps that same gap.
// Needs TEST_DATABASE_URL, like ./topics.test.mts; without it the suite skips.
const url = process.env.TEST_DATABASE_URL

describe(
	'the due-gap seed, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const client = new PrismaClient({ datasourceUrl: url })
		const userId = randomUUID()

		before(async () => {
			await client.$executeRaw`
				insert into auth.users (id, email) values (${userId}::uuid, ${`${userId}@example.test`})`
		})

		after(async () => {
			await client.$executeRaw`delete from auth.users where id = ${userId}::uuid`
			await client.$disconnect()
		})

		test('seeds one due gap and does not add another the next time', async () => {
			const { seedDueGap } = await import('./seed-due-gap')
			const now = new Date('2026-11-02T12:00:00.000Z')
			const first = await seedDueGap(client, { userId, now })
			assert.equal(first.created, true)
			const gap = await client.gap.findFirst({ where: { id: first.gapId, userId } })
			assert.ok(gap)
			assert.equal(isGapDue(gap, now), true)

			const second = await seedDueGap(client, { userId, now })
			assert.equal(second.created, false)
			assert.equal(second.gapId, first.gapId)
			assert.equal(await client.gap.count({ where: { userId, topicId: first.topicId } }), 1)
		})
	}
)
