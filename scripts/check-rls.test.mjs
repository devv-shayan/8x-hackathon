import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	APP_READ_TABLES,
	evaluateCatalog,
	evaluateExposure,
	evaluateRlsState,
	restrictsToOwner,
	SERVER_CONTROLLED_COLUMNS
} from './check-rls.mjs'

// A locked table as the security migration leaves one: RLS on, no policy, no grant.
const table = (overrides = {}) => ({
	name: 'waitlist',
	isEnabled: true,
	isForced: false,
	policyCount: 0,
	anonPrivileges: [],
	authenticatedPrivileges: [],
	hasTableSelect: false,
	columns: ['id', 'email'],
	columnSelects: [],
	columnWrites: [],
	...overrides
})

// A policy as Postgres prints it (pg_get_expr), as the Supabase migrations wrote them.
const policy = (name, using, check = null, permissive = true) => ({
	name,
	permissive,
	using,
	check
})
const OWN_ROW = '(auth.uid() = id)'

// The five tables stage 1 of the security migration left open to the app, as
// APP_READ_TABLES held them until stage 2 closed them. The mechanism stays (a table
// listed there may keep owner-restricted policies and the grants they back), so the tests
// of it pass this map explicitly; the shipped map is empty.
const STAGE_1_TABLES = {
	profiles: 'id',
	items: 'user_id',
	tasks: 'user_id',
	activity_feed: 'user_id',
	notifications: 'user_id'
}
const evaluateStage1 = (tables, options = {}) =>
	evaluateRlsState(tables, { appReadTables: STAGE_1_TABLES, ...options })

// profiles as stage 1 left it: read your own row, write your own settings.
const profiles = (overrides = {}) =>
	table({
		name: 'profiles',
		policyCount: 3,
		policies: [
			policy('Users can insert own profile', null, OWN_ROW),
			policy('Users can update own profile', OWN_ROW),
			policy('Users can view own profile', OWN_ROW)
		],
		authenticatedPrivileges: ['INSERT', 'SELECT', 'UPDATE'],
		hasTableSelect: true,
		columns: ['id', 'display_name', 'is_admin', 'plan_type'],
		columnWrites: [
			{ role: 'authenticated', privilege: 'INSERT', column: 'display_name' },
			{ role: 'authenticated', privilege: 'UPDATE', column: 'display_name' }
		],
		...overrides
	})

test('a locked table passes', () => {
	assert.equal(evaluateRlsState([table()]).ok, true)
})

test('no tables at all fails rather than passing on nothing', () => {
	assert.equal(evaluateRlsState([]).ok, false)
})

test('RLS switched off fails', () => {
	const { ok, problems } = evaluateRlsState([table({ isEnabled: false })])
	assert.equal(ok, false)
	assert.match(problems[0], /RLS is not enabled/)
})

test('FORCE fails, even on an exempt table', () => {
	const { ok } = evaluateRlsState([table({ isForced: true })], { exemptTables: ['waitlist'] })
	assert.equal(ok, false)
})

test("Prisma's own ledger is checked like any other table", () => {
	const { ok, problems } = evaluateRlsState([
		table({ name: '_prisma_migrations', isEnabled: false, anonPrivileges: ['SELECT'] })
	])
	assert.equal(ok, false)
	assert.equal(problems.length, 2)
})

test('any grant to anon fails, even on a table the app reads', () => {
	const { ok, problems } = evaluateRlsState([profiles({ anonPrivileges: ['SELECT'] })])
	assert.equal(ok, false)
	assert.match(problems[0], /granted to anon/)
})

test('a policy or an authenticated grant outside APP_READ_TABLES fails', () => {
	const policy = evaluateRlsState([table({ policyCount: 1 })])
	assert.equal(policy.ok, false)
	assert.match(policy.problems[0], /has 1 RLS policy/)
	const grant = evaluateRlsState([table({ authenticatedPrivileges: ['SELECT'] })])
	assert.equal(grant.ok, false)
	assert.match(grant.problems[0], /granted to authenticated \(SELECT\)/)
})

test('since stage 2 no table may keep a policy or a grant', () => {
	assert.deepEqual(APP_READ_TABLES, {})
	const { ok, problems } = evaluateRlsState([profiles()])
	assert.equal(ok, false)
	assert.match(problems[0], /profiles: has 3 RLS policies/)
	assert.match(problems[1], /profiles: granted to authenticated \(INSERT, SELECT, UPDATE\)/)
})

test('a table listed in APP_READ_TABLES may keep its policies and the grants they back', () => {
	assert.equal(evaluateStage1([profiles()]).ok, true)
	const { ok, problems } = evaluateStage1([profiles({ policyCount: 0 })])
	assert.equal(ok, false)
	assert.match(problems[0], /with no policy/)
})

test('an API role that can write a server-controlled column fails, however it was granted', () => {
	assert.ok(SERVER_CONTROLLED_COLUMNS.profiles.includes('is_admin'))
	const { ok, problems } = evaluateStage1([
		profiles({
			columnWrites: [
				{ role: 'authenticated', privilege: 'UPDATE', column: 'display_name' },
				{ role: 'authenticated', privilege: 'UPDATE', column: 'is_admin' },
				{ role: 'anon', privilege: 'INSERT', column: 'plan_type' }
			]
		})
	])
	assert.equal(ok, false)
	assert.match(problems[0], /authenticated UPDATE \(is_admin\), anon INSERT \(plan_type\)/)
	assert.match(problems[0], /A column REVOKE does not narrow a table-level GRANT/)
})

test('a column-locked table must grant every column but its secrets', () => {
	const locked = (columnSelects) =>
		table({
			name: 'profiles',
			policyCount: 1,
			authenticatedPrivileges: ['UPDATE'],
			columns: ['id', 'display_name', 'token_ref'],
			columnSelects
		})
	const secrets = { profiles: ['token_ref'] }
	assert.equal(
		evaluateStage1([locked(['id', 'display_name'])], { secretColumns: secrets }).ok,
		true
	)
	const missing = evaluateStage1([locked(['id'])], { secretColumns: secrets })
	assert.equal(missing.ok, false)
	assert.match(missing.problems[0], /granted column by column, but not on display_name/)
	const leaked = evaluateStage1([locked(['id', 'display_name', 'token_ref'])], {
		secretColumns: secrets
	})
	assert.equal(leaked.ok, false)
	assert.match(leaked.problems[0], /token_ref is listed in SECRET_COLUMNS/)
})

test("auth.uid() = the owner column, as a top-level conjunct, is the person's own rows", () => {
	for (const expression of [
		'(auth.uid() = user_id)',
		'(user_id = auth.uid())',
		'(( SELECT auth.uid() AS uid) = user_id)',
		'((auth.uid() = user_id) AND (deleted_at IS NULL))',
		"((status = 'open'::text) AND (auth.uid() = items.user_id))"
	]) {
		assert.equal(restrictsToOwner(expression, 'user_id'), true, expression)
	}
	for (const expression of [
		'true',
		'(auth.uid() IS NOT NULL)',
		"(auth.role() = 'authenticated'::text)",
		'(auth.uid() = id)',
		'((auth.uid() = user_id) OR (is_public = true))',
		'((auth.uid() = user_id) OR true)',
		'(auth.uid() <> user_id)',
		'(auth.uid() = other_user_id)',
		"((note = ' AND (auth.uid() = user_id) '::text) OR true)"
	]) {
		assert.equal(restrictsToOwner(expression, 'user_id'), false, expression)
	}
})

test('(c) a permissive policy on an app table that does not restrict to the owner fails', () => {
	const loose = evaluateStage1([
		profiles({ policyCount: 4, policies: [...profiles().policies, policy('anyone', 'true')] })
	])
	assert.equal(loose.ok, false)
	assert.match(loose.problems[0], /policy "anyone" \(true\) does not restrict to the person's/)
	assert.match(loose.problems[0], /auth\.uid\(\) = id/)
	// An insert policy is judged by its WITH CHECK, an update policy by both expressions.
	const insert = policy('insert anything', null, '(auth.uid() IS NOT NULL)')
	assert.equal(evaluateStage1([profiles({ policies: [insert] })]).ok, false)
	const update = policy('move a row', OWN_ROW, 'true')
	assert.equal(evaluateStage1([profiles({ policies: [update] })]).ok, false)
	const either = policy('own or public', `(${OWN_ROW} OR (is_public = true))`)
	assert.equal(evaluateStage1([profiles({ policies: [either] })]).ok, false)
})

test('(c) a restrictive policy, or a loose one allowlisted with a reason, passes', () => {
	const restrictive = policy('only while active', '(deleted_at IS NULL)', null, false)
	const narrowed = profiles({ policies: [...profiles().policies, restrictive] })
	assert.equal(evaluateStage1([narrowed]).ok, true)
	const loose = profiles({ policies: [...profiles().policies, policy('anyone', 'true')] })
	const allowed = { 'profiles.anyone': 'the reason a reviewer agreed to' }
	assert.equal(evaluateStage1([loose], { allowedPolicies: allowed }).ok, true)
	// The allowlist is per table and policy name.
	const elsewhere = { 'items.anyone': 'another table' }
	assert.equal(evaluateStage1([loose], { allowedPolicies: elsewhere }).ok, false)
})

test('(a) a view or materialized view an API role can reach fails', () => {
	const view = { name: 'public_profiles', kind: 'view', apiPrivileges: ['anon SELECT'] }
	const matview = {
		name: 'profile_counts',
		kind: 'materialized view',
		apiPrivileges: ['authenticated SELECT']
	}
	const { ok, problems } = evaluateExposure({ views: [view, matview] })
	assert.equal(ok, false)
	assert.equal(problems.length, 2)
	assert.match(problems[0], /public_profiles: a view granted to anon SELECT/)
	assert.match(problems[1], /profile_counts: a materialized view granted to authenticated SELECT/)
	// A view nothing can reach, or one allowlisted with a reason, passes.
	assert.equal(evaluateExposure({ views: [{ ...view, apiPrivileges: [] }] }).ok, true)
	const exposedViews = { public_profiles: 'a reason' }
	assert.equal(evaluateExposure({ views: [view] }, { exposedViews }).ok, true)
})

test('(b) a SECURITY DEFINER function an API role can execute fails', () => {
	const fn = { name: 'all_profiles()', callableBy: ['anon', 'authenticated'] }
	const { ok, problems } = evaluateExposure({ functions: [fn] })
	assert.equal(ok, false)
	assert.match(problems[0], /all_profiles\(\): SECURITY DEFINER, executable by anon, authenticated/)
	assert.match(problems[0], /REVOKE EXECUTE ON FUNCTION all_profiles\(\) FROM public, anon/)
	// A trigger function with EXECUTE revoked still fires, and passes.
	const trigger = { name: 'handle_new_user()', callableBy: [] }
	assert.equal(evaluateExposure({ functions: [trigger] }).ok, true)
	const callableDefinerFunctions = { 'all_profiles()': 'a reason' }
	assert.equal(evaluateExposure({ functions: [fn] }, { callableDefinerFunctions }).ok, true)
})

test('the catalog check fails on any of the tables, the views or the functions', () => {
	const clean = { tables: [table()], views: [], functions: [] }
	assert.equal(evaluateCatalog(clean).ok, true)
	const view = { name: 'v', kind: 'view', apiPrivileges: ['anon SELECT'] }
	assert.equal(evaluateCatalog({ ...clean, views: [view] }).ok, false)
	const fn = { name: 'f()', callableBy: ['authenticated'] }
	assert.equal(evaluateCatalog({ ...clean, functions: [fn] }).ok, false)
	assert.equal(evaluateCatalog({ ...clean, tables: [table({ isEnabled: false })] }).ok, false)
})
