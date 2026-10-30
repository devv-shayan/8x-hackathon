import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient, type Prisma } from '@prisma/client'

// Every other database suite, locally and in CI, connects as a superuser, which may do
// anything. Production does not. Prisma connects as the role that owns the tables
// (Supabase's `postgres`), which is NOT a superuser, and Supabase Auth creates and deletes
// users as supabase_auth_admin, which holds nothing in public. So a FORCEd RLS that hides
// every row from the owner, a trigger that needs a privilege its caller lacks, or a missing
// grant passes every superuser suite and fails in production. This suite connects as two
// non-superusers shaped like those roles and runs what the app runs. From plays-dashboard's
// runtime-role.test.mts, adapted to this repo's model (the owner connection, no dbAs).
//
//   - app_runtime_test: a non-superuser, not BYPASSRLS, holding the table owner's privileges
//     (membership without SET, so it cannot become the owner). Every store runs as it.
//   - auth_admin_test: a non-superuser with privileges on auth.users only. It creates and
//     deletes a user, which is how the on_auth_user_created and on_auth_user_deleted
//     triggers reach public.
//
// Needs a database with the migrations applied (CI's migrations job, or a local replay:
// docs/rules/migrations.md), named by TEST_DATABASE_URL, and run by `npm run test:db`, whose
// react-server condition lets the stores' `server-only` import resolve. It creates and drops
// two roles: never point it at a shared or production database. Without the variable it
// skips, so `npm test` stays a no-database lane.
const url = process.env.TEST_DATABASE_URL

const RUNTIME = 'app_runtime_test'
const AUTH_ADMIN = 'auth_admin_test'

const dropRole = (role: string) => `do $$ begin
	if exists (select 1 from pg_roles where rolname = '${role}') then
		execute 'drop owned by ${role}';
		execute 'drop role ${role}';
	end if;
end $$`

const as = (role: string, password: string) => {
	const roleUrl = new URL(url ?? '')
	roleUrl.username = role
	roleUrl.password = password
	return new PrismaClient({ datasourceUrl: roleUrl.toString() })
}

describe(
	'the runtime role does what the app does, with no superuser behind it',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		const runtimePassword = randomUUID()
		const authAdminPassword = randomUUID()
		let runtime: PrismaClient
		let authAdmin: PrismaClient
		let stores: {
			profiles: import('./profiles').ProfileStore
			playStats: import('./play-stats').PlayStatsStore
			analytics: import('./analytics').AnalyticsStore
			leads: import('./leads').LeadStore
		}

		// Ids this run owns; cleaned up after, whatever happened.
		const person = randomUUID()
		const deleted = randomUUID()
		const granter = randomUUID()
		const ghost = randomUUID()
		const session = `runtime-${randomUUID().slice(0, 8)}`
		const email = `runtime-${randomUUID().slice(0, 8)}@example.test`

		before(async () => {
			// Loaded here, not at the top: they import server-only modules, which resolve only
			// under the react-server condition `npm run test:db` sets.
			const [profiles, playStats, analytics, leads] = await Promise.all([
				import('./profiles'),
				import('./play-stats'),
				import('./analytics'),
				import('./leads')
			])

			await base.$executeRawUnsafe(dropRole(RUNTIME))
			await base.$executeRawUnsafe(dropRole(AUTH_ADMIN))
			const [{ owner }] = await base.$queryRaw<{ owner: string }[]>`
				select tableowner as owner from pg_tables
				where schemaname = 'public' and tablename = 'profiles'`
			await base.$executeRawUnsafe(
				`create role ${RUNTIME} login nosuperuser nobypassrls password '${runtimePassword}'`
			)
			// The owner's privileges, and nothing a superuser owner has beyond them: the
			// superuser attribute is never inherited, and SET FALSE stops it becoming the owner.
			await base.$executeRawUnsafe(`grant "${owner}" to ${RUNTIME} with inherit true, set false`)
			await base.$executeRawUnsafe(
				`create role ${AUTH_ADMIN} login nosuperuser nobypassrls password '${authAdminPassword}'`
			)
			await base.$executeRawUnsafe(`grant usage on schema auth to ${AUTH_ADMIN}`)
			await base.$executeRawUnsafe(`grant select, insert, delete on auth.users to ${AUTH_ADMIN}`)

			runtime = as(RUNTIME, runtimePassword)
			authAdmin = as(AUTH_ADMIN, authAdminPassword)
			stores = {
				profiles: profiles.createProfileStore(runtime),
				playStats: playStats.createPlayStatsStore(runtime),
				analytics: analytics.createAnalyticsStore(runtime),
				leads: leads.createLeadStore(runtime)
			}

			// Supabase Auth's side: the user exists in auth.users, and on_auth_user_created
			// has made the profile.
			await base.$executeRaw`insert into auth.users (id, email) values (${person}::uuid, ${email})`
		})

		after(async () => {
			await runtime?.$disconnect()
			await authAdmin?.$disconnect()
			const ids = [person, deleted, granter, ghost]
			await base.$executeRaw`delete from auth.users where id = any(${ids}::uuid[])`
			await base.$executeRaw`delete from public.profiles where id = any(${ids}::uuid[])`
			await base.$executeRaw`delete from public.items where user_id = any(${ids}::uuid[])`
			await base.$executeRaw`delete from public.notifications where user_id = any(${ids}::uuid[])`
			await base.$executeRaw`delete from public.analytics_events
				where user_id = any(${ids}::uuid[]) or metadata->>'session_id' = ${session}`
			await base.$executeRaw`delete from public.analytics_pageviews
				where user_id = any(${ids}::uuid[]) or session_id = ${session}`
			await base.$executeRaw`delete from public.premium_grants
				where user_id = any(${ids}::uuid[]) or granted_by = any(${ids}::uuid[])`
			await base.$executeRaw`delete from public.waitlist where email = ${email}`
			await base.$executeRaw`delete from public.contact_messages where email = ${email}`
			await base.$executeRawUnsafe(dropRole(RUNTIME))
			await base.$executeRawUnsafe(dropRole(AUTH_ADMIN))
			await base.$disconnect()
		})

		test('it is not a superuser, and RLS hides nothing from it', async () => {
			const [who] = await runtime.$queryRaw<{ superuser: string; bypass: boolean }[]>`
				select current_setting('is_superuser') as superuser,
				       (select rolbypassrls from pg_roles where rolname = current_user) as bypass`
			assert.deepEqual(who, { superuser: 'off', bypass: false })
			assert.equal(await stores.profiles.isAdmin(person), false)
			assert.ok(
				(await stores.playStats.statsProfiles()).some((p) => p.id === person),
				'the profile made by on_auth_user_created is visible to the runtime role'
			)
		})

		test('a FORCEd RLS would hide every row, and this suite would see it', async () => {
			await base.$executeRawUnsafe('alter table public.profiles force row level security')
			try {
				assert.equal(await stores.profiles.regionOf(person), null)
				assert.equal(
					(await stores.playStats.statsProfiles()).length,
					0,
					'FORCE subjects the owner to policies that do not cover it'
				)
			} finally {
				await base.$executeRawUnsafe('alter table public.profiles no force row level security')
			}
		})

		test('the lifecycle route and the RevenueCat webhook write the profile', async () => {
			const seenAt = new Date('2026-09-20T08:00:00.123Z')
			await stores.profiles.recordSession(person, { seenAt, region: 'TR' })
			assert.equal(await stores.profiles.regionOf(person), 'TR')

			const changed = await stores.profiles.applyEntitlement(person, {
				planType: 'premium',
				premiumSource: 'purchase',
				premiumEnvironment: 'production',
				premiumStatus: 'active',
				premiumStore: 'app_store',
				premiumProduct: 'monthly',
				premiumExpiresAt: new Date(Date.now() + 2 * 86_400_000),
				premiumWillRenew: false,
				premiumStartedAt: new Date('2026-09-01T00:00:00Z')
			})
			assert.equal(changed, 1)
			// An app user id with no profile changes nothing and is not an error.
			assert.equal(
				await stores.profiles.applyEntitlement(randomUUID(), {
					planType: 'free',
					premiumSource: null,
					premiumEnvironment: null,
					premiumStatus: 'expired',
					premiumWillRenew: false,
					premiumExpiresAt: null
				}),
				0
			)

			const profile = await stores.profiles.playEventProfile(person)
			assert.deepEqual(profile, {
				region: 'TR',
				locale: null,
				marketingConsent: false,
				planType: 'premium'
			})
			// The updated_at trigger (set_updated_at, SECURITY INVOKER) ran as this role.
			const [row] = await base.$queryRaw<{ stamped: boolean }[]>`
				select updated_at > created_at as stamped from public.profiles where id = ${person}::uuid`
			assert.equal(row?.stamped, true)
		})

		test('the cron and the Play Stats roster read it back as PostgREST rendered it', async () => {
			const expiring = await stores.profiles.expiringSubscriptions(
				new Date(),
				new Date(Date.now() + 3 * 86_400_000)
			)
			const mine = expiring.find((r) => r.id === person)
			assert.ok(mine, 'the expiring subscription is found')
			assert.match(mine.premium_expires_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?\+00:00$/)

			const inactive = await stores.profiles.inactiveSince(new Date('2026-09-21T00:00:00Z'))
			assert.equal(
				inactive.find((r) => r.id === person)?.last_seen_at,
				'2026-09-20T08:00:00.123+00:00'
			)

			const [roster] = await stores.playStats.rosterByIds([person])
			assert.equal(roster?.premium_started_at, '2026-09-01T00:00:00+00:00')
			assert.equal(roster?.last_seen_at, '2026-09-20T08:00:00.123+00:00')
			const paying = await stores.playStats.rosterPage('paying', 0, 100)
			assert.ok(paying.some((p) => p.id === person))
			assert.deepEqual(await stores.profiles.adminRows([person]), [
				{ id: person, plan_type: 'premium', is_admin: false, region: 'TR' }
			])
		})

		test('the event log: record, dedupe, count, and the retention scan', async () => {
			const since = new Date()
			since.setUTCHours(0, 0, 0, 0)
			const signedIn = { name: 'checkout_started', visitor: { userId: person }, since }
			assert.equal(await stores.analytics.hasDuplicate({ ...signedIn, match: {} }), false)
			await stores.analytics.insertEvent({
				userId: person,
				name: 'checkout_started',
				path: '/pricing',
				metadata: { plan: 'pro', country: 'TR' }
			})
			assert.equal(await stores.analytics.hasDuplicate({ ...signedIn, match: {} }), true)
			assert.equal(
				await stores.analytics.hasDuplicate({ ...signedIn, match: { plan: 'pro' } }),
				true
			)
			assert.equal(
				await stores.analytics.hasDuplicate({ ...signedIn, match: { plan: 'team' } }),
				false
			)

			// A guest: identified by metadata->>'session_id', user_id null.
			const guest = { name: 'landing_view', visitor: { sessionId: session }, match: {} }
			assert.equal(await stores.analytics.hasDuplicate({ ...guest, since: null }), false)
			await stores.analytics.insertEvent({
				userId: null,
				name: 'landing_view',
				path: '/',
				metadata: { session_id: session }
			})
			assert.equal(await stores.analytics.hasDuplicate({ ...guest, since: null }), true)
			assert.equal(
				await stores.analytics.hasDuplicate({ ...guest, since: new Date(Date.now() + 60_000) }),
				false
			)
			// No metadata at all still dedupes when nothing is asked to match.
			await stores.analytics.insertEvent({ userId: person, name: 'app_open', path: null })
			assert.equal(
				await stores.analytics.hasDuplicate({
					name: 'app_open',
					visitor: { userId: person },
					match: {},
					since: null
				}),
				true
			)

			await stores.analytics.insertPageview({
				userId: null,
				sessionId: session,
				path: '/',
				dwellMs: 1200
			})
			// A user id with no account is refused, as the key to auth.users refused it: the
			// RevenueCat webhook for an unknown app user records nothing first-party.
			await assert.rejects(
				stores.analytics.insertEvent({ userId: randomUUID(), name: 'purchase', path: null }),
				/Foreign key constraint violated/
			)
			assert.ok((await stores.analytics.countSince('checkout_started', since)) >= 1)
			assert.ok(
				(await stores.playStats.userIdsForEvent('checkout_started', 0, 1000)).includes(person)
			)
			let seen = 0
			for await (const batch of stores.playStats.accountActivitySince(since)) {
				seen += batch.filter((e) => e.userId === person).length
			}
			assert.equal(seen, 2)
		})

		test('the waitlist and the support form', async () => {
			await stores.leads.joinWaitlist({ email, source: 'web', userAgent: null })
			// Joining twice changes nothing and is not an error.
			await stores.leads.joinWaitlist({ email, source: 'app', userAgent: 'second' })
			const [entry] = await base.$queryRaw<{ source: string }[]>`
				select source from public.waitlist where email = ${email}`
			assert.equal(entry?.source, 'web')
			await stores.leads.addContactMessage({
				name: 'Runtime role',
				email,
				message: 'hello',
				category: 'general'
			})
			const counts = await stores.leads.counts()
			assert.ok(counts.waitlist >= 1 && counts.contactMessages >= 1)
		})

		test('Supabase Auth deleting a user clears their rows through the trigger, as the keys did', async () => {
			await authAdmin.$executeRaw`insert into auth.users (id, email)
				values (${deleted}::uuid, ${`deleted-${email}`}), (${granter}::uuid, ${`granter-${email}`})`
			// on_auth_user_created ran as the auth admin, which holds nothing in public.
			const [created] = await base.$queryRaw<{ n: number }[]>`
				select count(*)::int as n from public.profiles where id = ${deleted}::uuid`
			assert.equal(created?.n, 1)

			const [item] = await base.$queryRaw<{ id: string }[]>`
				insert into public.items (user_id, name) values (${deleted}::uuid, 'Runtime role')
				returning id::text as id`
			await base.$executeRaw`insert into public.tasks (item_id, user_id, title)
				values (${item!.id}::uuid, ${deleted}::uuid, 'Runtime role')`
			await base.$executeRaw`insert into public.notifications (user_id, title)
				values (${deleted}::uuid, 'Runtime role')`
			await base.$executeRaw`insert into public.premium_grants (user_id, granted_by)
				values (${deleted}::uuid, ${granter}::uuid), (${person}::uuid, ${deleted}::uuid)`
			await base.$executeRaw`insert into public.analytics_events (user_id, name, metadata)
				values (${deleted}::uuid, 'app_open', jsonb_build_object('session_id', ${session}::text))`

			await authAdmin.$executeRaw`delete from auth.users where id = ${deleted}::uuid`

			const [left] = await base.$queryRaw<
				{
					profiles: number
					items: number
					tasks: number
					notifications: number
					grants: number
					grantedBy: number
					events: number
				}[]
			>`
				select
					(select count(*)::int from public.profiles where id = ${deleted}::uuid) as profiles,
					(select count(*)::int from public.items where user_id = ${deleted}::uuid) as items,
					(select count(*)::int from public.tasks where user_id = ${deleted}::uuid) as tasks,
					(select count(*)::int from public.notifications where user_id = ${deleted}::uuid)
						as notifications,
					(select count(*)::int from public.premium_grants where user_id = ${deleted}::uuid)
						as grants,
					(select count(*)::int from public.premium_grants where granted_by = ${deleted}::uuid)
						as "grantedBy",
					(select count(*)::int from public.analytics_events where user_id = ${deleted}::uuid)
						as events`
			assert.deepEqual(left, {
				profiles: 0,
				items: 0,
				tasks: 0,
				notifications: 0,
				grants: 0,
				grantedBy: 0,
				events: 0
			})
			// Kept, with the id cleared: the grant someone else received, and the event.
			const [kept] = await base.$queryRaw<{ grants: number; anonymous: number }[]>`
				select
					(select count(*)::int from public.premium_grants
					  where user_id = ${person}::uuid and granted_by is null) as grants,
					(select count(*)::int from public.analytics_events
					  where user_id is null and name = 'app_open'
					    and metadata->>'session_id' = ${session}) as anonymous`
			assert.deepEqual(kept, { grants: 1, anonymous: 1 })
		})

		test("a deleted user's still-valid token cannot bring their profile back", async () => {
			// What the app's onboarding screen sent through the Data API before it moved onto
			// /api/app/v1, as the signed-in person: PostgREST's upsert of { id, display_name },
			// under their claims.
			// Stage 2 of the security migration shut that path for everyone; the app writes
			// through PATCH /api/app/v1/profile now, which is the owner connection.
			const asPerson = <T,>(sub: string, run: (tx: Prisma.TransactionClient) => Promise<T>) =>
				base.$transaction(async (tx) => {
					await tx.$executeRawUnsafe('set local role authenticated')
					await tx.$executeRaw`select set_config('request.jwt.claims',
						${JSON.stringify({ sub, role: 'authenticated' })}, true)`
					return run(tx)
				})
			const upsert = (name: string) => (tx: Prisma.TransactionClient) =>
				tx.$executeRaw`insert into public.profiles (id, display_name)
					values (${ghost}::uuid, ${name})
					on conflict (id) do update set id = excluded.id, display_name = excluded.display_name`
			const profileCount = async () => {
				const [row] = await base.$queryRaw<{ n: number }[]>`
					select count(*)::int as n from public.profiles where id = ${ghost}::uuid`
				return row?.n
			}

			// A signup: Supabase Auth writes the user, and on_auth_user_created the profile.
			await authAdmin.$executeRaw`insert into auth.users (id, email)
				values (${ghost}::uuid, ${`ghost-${email}`})`
			assert.equal(await profileCount(), 1)
			// The Data API is shut even to the person the row belongs to...
			await assert.rejects(
				asPerson(ghost, upsert('Through the Data API')),
				/permission denied for table profiles/
			)
			// ...and the route's write, as the owner connection, names the profile.
			await runtime.profile.update({
				where: { id: ghost },
				data: { displayName: 'Before deletion' }
			})
			const [named] = await base.$queryRaw<{ name: string }[]>`
				select display_name as name from public.profiles where id = ${ghost}::uuid`
			assert.equal(named?.name, 'Before deletion')

			// The account is deleted; the person's access token lives on until it expires. Neither
			// path brings the profile back.
			await authAdmin.$executeRaw`delete from auth.users where id = ${ghost}::uuid`
			assert.equal(await profileCount(), 0)
			await assert.rejects(asPerson(ghost, upsert('Ghost')), /permission denied for table profiles/)
			// The owner connection is held to it too: a profile always has its auth user. The
			// trigger raises SQLSTATE 23503, so Prisma reports it as the foreign key it stands in
			// for (P2003).
			await assert.rejects(
				runtime.profile.create({ data: { id: ghost } }),
				/Foreign key constraint violated/
			)
			assert.equal(await profileCount(), 0)
			// Nothing can hang off a profile that isn't there.
			await assert.rejects(
				runtime.item.create({ data: { userId: ghost, name: 'Ghost' } }),
				/Foreign key constraint violated/
			)
		})
	}
)
