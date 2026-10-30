import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'

// postgrestTime() must give the text PostgREST gave for a timestamptz on a Supabase
// database (UTC): microseconds, trailing zeros dropped, "+00:00". The Play Stats API's
// roster and the lifecycle cron's Play Events carry it, byte for byte (./postgrest-time.ts).
// Needs a database (TEST_DATABASE_URL, `npm run test:db`); skips without one.
const url = process.env.TEST_DATABASE_URL

describe(
	'postgrestTime renders a timestamptz as PostgREST did',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const db = new PrismaClient({ datasourceUrl: url })
		let postgrestTime: typeof import('./postgrest-time').postgrestTime
		let Prisma: typeof import('./client').Prisma

		before(async () => {
			// Loaded here: they import server-only modules (the react-server condition).
			;({ postgrestTime } = await import('./postgrest-time'))
			;({ Prisma } = await import('./client'))
		})

		after(() => db.$disconnect())

		const render = async (literal: string, timeZone: string) =>
			db.$transaction(async (tx) => {
				await tx.$executeRawUnsafe(`set local timezone = '${timeZone}'`)
				const [row] = await tx.$queryRaw<{ text: string | null }[]>(
					Prisma.sql`select ${postgrestTime('t')} as text from (select ${Prisma.raw(
						literal
					)}::timestamptz as t) as v`
				)
				return row?.text ?? null
			})

		test('microseconds, trailing zeros dropped, +00:00, in any session time zone', async () => {
			for (const timeZone of ['UTC', 'Asia/Karachi', 'America/Los_Angeles']) {
				assert.equal(
					await render("'2026-09-20 12:34:56.789012+00'", timeZone),
					'2026-09-20T12:34:56.789012+00:00'
				)
				assert.equal(
					await render("'2026-09-20 12:34:56.5+00'", timeZone),
					'2026-09-20T12:34:56.5+00:00'
				)
				assert.equal(
					await render("'2026-09-20 12:34:56+00'", timeZone),
					'2026-09-20T12:34:56+00:00'
				)
				assert.equal(
					await render("'2026-09-20 23:30:00-05'", timeZone),
					'2026-09-21T04:30:00+00:00'
				)
				assert.equal(await render('null', timeZone), null)
			}
		})

		test('in a UTC session it is exactly the JSON text PostgREST served', async () => {
			const rows = await db.$transaction(async (tx) => {
				await tx.$executeRawUnsafe(`set local timezone = 'UTC'`)
				return tx.$queryRaw<{ ours: string; postgrest: string }[]>(
					Prisma.sql`select ${postgrestTime('t')} as ours, to_json(t) #>> '{}' as postgrest
						from unnest(array[now(), '2026-01-02 03:04:05.06+00', '1999-12-31 23:59:59+00',
						                  '2026-06-30 10:00:00.000001+00']::timestamptz[]) as t`
				)
			})
			assert.equal(rows.length, 4)
			for (const row of rows) assert.equal(row.ours, row.postgrest)
		})
	}
)
