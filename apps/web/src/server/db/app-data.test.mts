import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'

// The stores behind /api/app/v1's data routes (./items, ./tasks, ./feed, and the profile
// store's own-settings write), against a real database: that every read is the person's own,
// that soft-deleted rows are gone, that a page never skips or repeats a row (timestamps a
// microsecond apart included, which a millisecond JS Date can't tell apart), that a create by
// id is idempotent and never hands over someone else's row, and that the app's profile write
// reaches no money column.
//
// Needs a database with the migrations applied (CI's migrations job, or a local replay:
// docs/rules/migrations.md), named by TEST_DATABASE_URL, and run by `npm run test:db`. It
// signs up throwaway auth users, whose profiles on_auth_user_created makes, and deletes them
// after, which takes their profiles and every row with them. Without the variable it skips,
// so `npm test` stays a no-database lane.
const url = process.env.TEST_DATABASE_URL

describe(
	'the app data stores, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		const sam = randomUUID()
		const alex = randomUUID()
		let items: import('./items').ItemStore
		let tasks: import('./tasks').TaskStore
		let feed: import('./feed').FeedStore
		let profiles: import('./profiles').ProfileStore

		// Inserted with exact timestamps: the updated_at trigger only rewrites them on UPDATE.
		const item = async (
			userId: string,
			name: string,
			updatedAt: string,
			extra: { deleted?: boolean } = {}
		) => {
			const id = randomUUID()
			await base.$executeRaw`
				insert into public.items (id, user_id, name, updated_at, deleted_at)
				values (${id}::uuid, ${userId}::uuid, ${name}, ${updatedAt}::timestamptz,
				        ${extra.deleted ? new Date() : null}::timestamptz)`
			return id
		}
		const task = async (userId: string, itemId: string, title: string, createdAt: string) => {
			const id = randomUUID()
			await base.$executeRaw`
				insert into public.tasks (id, user_id, item_id, title, created_at)
				values (${id}::uuid, ${userId}::uuid, ${itemId}::uuid, ${title}, ${createdAt}::timestamptz)`
			return id
		}
		const walk = async <T extends { id: string }>(
			fetch: (after?: string) => Promise<{ rows: T[]; nextAfter: string | null }>
		) => {
			const seen: T[] = []
			let next: string | undefined
			for (let pages = 0; pages < 20; pages++) {
				const page = await fetch(next)
				seen.push(...page.rows)
				if (!page.nextAfter) return seen
				next = page.nextAfter
			}
			throw new Error('the pages never ended')
		}

		// Supabase Auth's side of a person: a profile can't exist without its auth user
		// (profiles_require_auth_user), so a test signs one up and the trigger makes the profile.
		const signUp = (...ids: string[]) =>
			Promise.all(
				ids.map(
					(id) =>
						base.$executeRaw`insert into auth.users (id, email) values (${id}::uuid, ${`${id}@example.test`})`
				)
			)
		const deleteUsers = (...ids: string[]) =>
			base.$executeRaw`delete from auth.users where id = any(${ids}::uuid[])`

		before(async () => {
			// Loaded here, not at the top: they import server-only modules, which resolve only
			// under the react-server condition `npm run test:db` sets.
			const [itemsModule, tasksModule, feedModule, profilesModule] = await Promise.all([
				import('./items'),
				import('./tasks'),
				import('./feed'),
				import('./profiles')
			])
			items = itemsModule.createItemStore(base)
			tasks = tasksModule.createTaskStore(base)
			feed = feedModule.createFeedStore(base)
			profiles = profilesModule.createProfileStore(base)
			await signUp(sam, alex)
		})

		after(async () => {
			await deleteUsers(sam, alex)
			await base.$disconnect()
		})

		test("items: the person's own, not deleted, newest update first, every row once", async () => {
			// Three rows inside one millisecond: a cursor holding a JS Date would lose two.
			const a = await item(sam, 'a', '2026-09-24 10:00:00.123100+00')
			const b = await item(sam, 'b', '2026-09-24 10:00:00.123500+00')
			const c = await item(sam, 'c', '2026-09-24 10:00:00.123900+00')
			const d = await item(sam, 'd', '2026-09-24 11:00:00+00')
			await item(sam, 'deleted', '2026-09-24 12:00:00+00', { deleted: true })
			await item(alex, "not sam's", '2026-09-24 12:00:00+00')

			const all = await walk((after) => items.list(sam, { limit: 1, after }))
			assert.deepEqual(
				all.map((row) => row.id),
				[d, c, b, a]
			)
			const twos = await walk((after) => items.list(sam, { limit: 2, after }))
			assert.deepEqual(
				twos.map((row) => row.id),
				[d, c, b, a]
			)
			assert.equal((await items.list(sam, { limit: 4 })).nextAfter, null)
			assert.deepEqual(
				(await items.list(alex, { limit: 50 })).rows.map((row) => row.name),
				["not sam's"]
			)
		})

		test("items: one by id is the person's own and not deleted, or null", async () => {
			const mine = await item(sam, 'mine', '2026-09-20 00:00:00+00')
			const gone = await item(sam, 'gone', '2026-09-20 00:00:00+00', { deleted: true })
			const theirs = await item(alex, 'theirs', '2026-09-20 00:00:00+00')
			assert.equal((await items.get(sam, mine))?.name, 'mine')
			assert.equal(await items.get(sam, gone), null)
			assert.equal(await items.get(sam, theirs), null)
			assert.equal(await items.get(sam, randomUUID()), null)
		})

		test("items: a create by id is made once, found again on a retry, never someone else's", async () => {
			const id = randomUUID()
			const first = await items.create(sam, { id, name: 'Plan', owner: 'Sam' })
			assert.equal(first.outcome, 'created')
			assert.ok(first.outcome !== 'conflict' && first.row.status === 'active')

			const retry = await items.create(sam, { id, name: 'Plan, edited' })
			assert.equal(retry.outcome, 'existing')
			assert.ok(retry.outcome !== 'conflict' && retry.row.name === 'Plan')
			assert.equal(await base.item.count({ where: { id } }), 1)

			assert.deepEqual(await items.create(alex, { id, name: 'Mine now' }), { outcome: 'conflict' })
			assert.equal((await base.item.findUnique({ where: { id } }))?.userId, sam)

			const gone = await item(sam, 'gone', '2026-09-20 00:00:00+00', { deleted: true })
			assert.deepEqual(await items.create(sam, { id: gone, name: 'again' }), {
				outcome: 'conflict'
			})

			const fresh = await items.create(sam, { name: 'No id' })
			assert.equal(fresh.outcome, 'created')
		})

		test("tasks: only through the person's own item; oldest first; every row once", async () => {
			const mine = await item(sam, 'with tasks', '2026-09-21 00:00:00+00')
			const theirs = await item(alex, 'their tasks', '2026-09-21 00:00:00+00')
			const gone = await item(sam, 'gone', '2026-09-21 00:00:00+00', { deleted: true })
			const t1 = await task(sam, mine, 'one', '2026-09-21 09:00:00.000100+00')
			const t2 = await task(sam, mine, 'two', '2026-09-21 09:00:00.000200+00')
			const t3 = await task(sam, mine, 'three', '2026-09-21 10:00:00+00')
			await base.$executeRaw`
				update public.tasks set deleted_at = now() where id = ${t3}::uuid`
			await task(alex, theirs, 'theirs', '2026-09-21 09:00:00+00')

			const all = await walk(async (after) => (await tasks.list(sam, mine, { limit: 1, after }))!)
			assert.deepEqual(
				all.map((row) => row.id),
				[t1, t2]
			)
			assert.equal(await tasks.list(sam, theirs, { limit: 10 }), null)
			assert.equal(await tasks.list(sam, gone, { limit: 10 }), null)
		})

		test("tasks: a create checks the item is the person's, keeps the state and date, and is idempotent", async () => {
			const mine = await item(sam, 'target', '2026-09-22 00:00:00+00')
			const other = await item(sam, 'other', '2026-09-22 00:00:00+00')
			const theirs = await item(alex, 'theirs', '2026-09-22 00:00:00+00')
			const id = randomUUID()
			const input = {
				id,
				itemId: mine,
				title: 'Brief',
				state: 'in_progress' as const,
				dueDate: new Date('2026-10-01T00:00:00.000Z')
			}

			const made = await tasks.create(sam, input)
			assert.equal(made.outcome, 'created')
			assert.ok(made.outcome === 'created')
			assert.equal(made.row.state, 'in_progress')
			assert.equal(made.row.priority, 'medium')
			assert.equal(made.row.dueDate?.toISOString(), '2026-10-01T00:00:00.000Z')

			assert.equal((await tasks.create(sam, input)).outcome, 'existing')
			assert.deepEqual(await tasks.create(sam, { ...input, itemId: other }), {
				outcome: 'conflict'
			})
			assert.deepEqual(await tasks.create(sam, { itemId: theirs, title: 'x' }), {
				outcome: 'item_not_found'
			})
			assert.deepEqual(await tasks.create(alex, { ...input, itemId: theirs }), {
				outcome: 'conflict'
			})
			assert.equal(await base.task.count({ where: { itemId: theirs } }), 0)
		})

		test("feed: activity and notifications are the person's own, newest first", async () => {
			const mine = await item(sam, 'feed', '2026-09-23 00:00:00+00')
			const other = await item(sam, 'other feed', '2026-09-23 00:00:00+00')
			const theirs = await item(alex, 'their feed', '2026-09-23 00:00:00+00')
			await base.activity.createMany({
				data: [
					{
						userId: sam,
						itemId: mine,
						kind: 'milestone',
						title: 'old',
						createdAt: new Date('2026-09-23T01:00:00Z')
					},
					{
						userId: sam,
						itemId: other,
						kind: 'comment',
						title: 'new',
						createdAt: new Date('2026-09-23T02:00:00Z')
					},
					{
						userId: alex,
						itemId: theirs,
						kind: 'alert',
						title: 'theirs',
						createdAt: new Date('2026-09-23T03:00:00Z')
					}
				]
			})
			await base.notification.createMany({
				data: [
					{ userId: sam, title: 'first', createdAt: new Date('2026-09-23T01:00:00Z') },
					{ userId: sam, title: 'second', createdAt: new Date('2026-09-23T02:00:00Z') },
					{ userId: alex, title: 'theirs', createdAt: new Date('2026-09-23T03:00:00Z') }
				]
			})

			const everything = await walk((after) => feed.activity(sam, { limit: 1, after }))
			assert.deepEqual(
				everything.map((row) => row.title),
				['new', 'old']
			)
			const one = await feed.activity(sam, { itemId: mine, limit: 10 })
			assert.deepEqual(
				one.rows.map((row) => row.title),
				['old']
			)
			assert.deepEqual((await feed.activity(sam, { itemId: theirs, limit: 10 })).rows, [])

			const inbox = await walk((after) => feed.notifications(sam, { limit: 1, after }))
			assert.deepEqual(
				inbox.map((row) => [row.title, row.category, row.read]),
				[
					['second', 'system', false],
					['first', 'system', false]
				]
			)
		})

		test('profiles: own settings only, the row made if missing, a consent flip reported once', async () => {
			const who = randomUUID()
			try {
				// No auth user (an account deleted while its token still worked): the trigger
				// refuses the profile, and nothing is written.
				assert.equal(await profiles.updateOwnSettings(who, { displayName: 'Ghost' }), null)
				assert.equal(await base.profile.count({ where: { id: who } }), 0)

				// A live user whose profile the signup trigger never made (removed here to stand in
				// for it): made now, with the settings on it.
				await signUp(who)
				await base.profile.delete({ where: { id: who } })
				const first = await profiles.updateOwnSettings(who, {
					displayName: 'Sam',
					locale: 'pt-BR',
					marketingConsent: true
				})
				assert.equal(first?.consentChanged, true)
				assert.deepEqual(
					{ ...first?.profile, createdAt: null },
					{
						displayName: 'Sam',
						avatarUrl: null,
						planType: 'free',
						locale: 'pt-BR',
						marketingConsent: true,
						createdAt: null
					}
				)

				// Money: an object carrying more than the four settings writes no more.
				const smuggled = {
					displayName: null,
					planType: 'premium',
					isAdmin: true,
					premiumStatus: 'active',
					region: 'US'
				} as import('./profiles').OwnSettings
				const second = await profiles.updateOwnSettings(who, smuggled)
				assert.equal(second?.profile.displayName, null)
				assert.equal(second?.consentChanged, false)
				const stored = await base.profile.findUniqueOrThrow({ where: { id: who } })
				assert.equal(stored.planType, 'free')
				assert.equal(stored.isAdmin, false)
				assert.equal(stored.premiumStatus, null)
				assert.equal(stored.region, null)
				assert.equal(stored.locale, 'pt-BR', 'undefined leaves a field as it is')

				// The same value again is no change.
				const same = await profiles.updateOwnSettings(who, { marketingConsent: true })
				assert.equal(same?.consentChanged, false)

				// Two toggles at once: one flip, one report.
				const both = await Promise.all([
					profiles.updateOwnSettings(who, { marketingConsent: false }),
					profiles.updateOwnSettings(who, { marketingConsent: false })
				])
				assert.deepEqual(both.map((result) => result?.consentChanged).sort(), [false, true])
				assert.equal((await profiles.appProfile(who))?.marketingConsent, false)
				assert.equal(await profiles.appProfile(randomUUID()), null)
			} finally {
				await deleteUsers(who)
			}
		})

		test('a page after a row changed or deleted since it was sent skips nothing and never errs', async () => {
			const who = randomUUID()
			await signUp(who)
			try {
				const x = await item(who, 'x', '2026-09-24 03:00:00+00')
				const y = await item(who, 'y', '2026-09-24 02:00:00+00')
				const z = await item(who, 'z', '2026-09-24 01:00:00+00')
				const first = await items.list(who, { limit: 1 })
				assert.deepEqual(
					first.rows.map((row) => row.id),
					[x]
				)

				// Edited: the trigger moves it to the top, and the next page still has the rest.
				await base.$executeRaw`update public.items set name = 'x2' where id = ${x}::uuid`
				const afterEdit = await items.list(who, { limit: 5, after: first.nextAfter! })
				assert.deepEqual(
					afterEdit.rows.map((row) => row.id),
					[y, z]
				)

				// Soft-deleted: it no longer matches, and the row after it is not dropped in its place.
				await base.$executeRaw`update public.items set deleted_at = now() where id = ${x}::uuid`
				const next = await items.list(who, { limit: 5, after: first.nextAfter! })
				assert.deepEqual(
					next.rows.map((row) => row.id),
					[y, z]
				)
				const short = await items.list(who, { limit: 1, after: first.nextAfter! })
				assert.deepEqual(short, { rows: [(await items.get(who, y))!], nextAfter: y })
				// Gone for good (the account was deleted): an empty last page.
				const ended = await items.list(who, { limit: 5, after: randomUUID() })
				assert.deepEqual(ended, { rows: [], nextAfter: null })
			} finally {
				await deleteUsers(who)
			}
		})
	}
)
