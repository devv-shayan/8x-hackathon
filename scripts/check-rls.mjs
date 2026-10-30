#!/usr/bin/env node
// Verifies Row Level Security and the API roles' grants on the database DATABASE_URL points
// at: the state Postgres reports, not the SQL text, once the migrations are applied.
//
// The model is template-web's (docs/rules/database.md): every table has RLS on with no
// policies and nothing granted to anon or authenticated, a locked door, because the one data
// path is Prisma on the server. Prisma connects as the table owner, which RLS does not gate,
// so the app is unaffected; any other role gets nothing, even if the Supabase Data API is
// switched back on. The checks, from plays-dashboard's copy of this file:
//
//   - every table has RLS enabled, and none is FORCEd (the owner must stay exempt);
//   - nothing is granted to anon;
//   - no table has a policy or an authenticated grant. APP_READ_TABLES below, empty since
//     the app moved onto /api/app/v1, is the one way a table could keep both: each grant
//     backed by a policy, and every permissive policy restricted to the person's own rows
//     (auth.uid() = the owner column, ANDed with anything else), unless ALLOWED_POLICIES
//     names it;
//   - no API role can write a column in SERVER_CONTROLLED_COLUMNS. Postgres answers this
//     with has_column_privilege(), which counts a table-level grant too: the template's
//     original column REVOKEs on profiles did nothing for exactly that reason;
//   - on a table whose SELECT is granted column by column, every column is granted or named
//     in SECRET_COLUMNS (plays-dashboard's rule: an ungranted column makes Postgres deny the
//     whole read);
//   - no view or materialized view in the schema is readable or writable by an API role
//     (a view runs as its owner and skips the RLS of the tables under it, and Supabase's
//     default privileges grant every new one to anon), unless EXPOSED_VIEWS names it;
//   - no SECURITY DEFINER function in the schema is executable by an API role (it runs as its
//     owner, past RLS, and the Data API serves every function at /rpc/<name>; Postgres grants
//     EXECUTE to PUBLIC by default), unless CALLABLE_DEFINER_FUNCTIONS names it.
//
// RLS and grants are not in the Prisma schema, so the drift check cannot see them. CI runs
// this at the end of the migrations job against the replayed database, and
// deploy-migrations.yml against production:
//
//   DATABASE_URL=postgresql://... npm run check:rls
//
// Exit codes: 0 every table is locked as above, 1 otherwise (or there are no tables).

import prismaClientModule from '@prisma/client'
import { pathToFileURL } from 'node:url'

const { PrismaClient } = prismaClientModule

// Tables deliberately left without RLS, each with the reason. Ships empty.
export const RLS_EXEMPT_TABLES = []

/**
 * Tables a client may still read directly through Supabase, signed in, under their RLS
 * policies, each with the column that names its owner. Empty: stage 1 of the security
 * migration (20260924000200_lock_the_api_roles_out) left the mobile app's five tables here;
 * once the app read through /api/app/v1 only, stage 2
 * (20260924000600_lock_the_api_roles_out_stage_2) dropped their policies and revoked
 * their grants. `check:standards` (`rls-no-policies`) fails if a table comes back. Never add
 * one: a new read is a route.
 */
export const APP_READ_TABLES = {}

/**
 * Permissive policies on APP_READ_TABLES that may do something other than restrict to the
 * person's own rows, as `table.policy name`, each with the reason. Ships empty.
 */
export const ALLOWED_POLICIES = {}

/** Views an API role may read, each with the reason. Ships empty. */
export const EXPOSED_VIEWS = {}

/**
 * SECURITY DEFINER functions an API role may call, as `name(argument types)`, each with the
 * reason. Ships empty: this repo's definer functions are triggers, which fire without EXECUTE.
 */
export const CALLABLE_DEFINER_FUNCTIONS = {}

/**
 * Columns only server code may write (AGENTS.md, non-negotiable 3; docs/rules/database.md).
 * Neither anon nor authenticated may hold INSERT or UPDATE on them, by a column grant or a
 * table grant. created_at is here too: the Play Stats API's new-user counts and retention
 * cohorts are cut by it.
 */
export const SERVER_CONTROLLED_COLUMNS = {
	profiles: [
		'is_admin',
		'plan_type',
		'premium_source',
		'premium_environment',
		'premium_status',
		'premium_started_at',
		'premium_expires_at',
		'premium_will_renew',
		'premium_store',
		'premium_product',
		'region',
		'last_seen_at',
		'created_at'
	]
}

/**
 * Columns that must stay unreadable to `authenticated` on a column-locked table, so the check
 * can tell a deliberate omission from a forgotten grant (plays-dashboard keeps its encrypted
 * provider credentials this way). Ships empty: no table here grants SELECT column by column.
 */
export const SECRET_COLUMNS = {}

const API_ROLES = ['anon', 'authenticated']

// ── Policy expressions ─────────────────────────────────────────────────────────
//
// A policy expression as Postgres prints it (pg_get_expr), e.g.
// `((auth.uid() = user_id) AND (deleted_at IS NULL))`. It restricts to the owner when, at its
// top level, it is `auth.uid() = <owner column>` ANDed with anything: an AND can only narrow.
// A top-level OR, or no such conjunct, and it can reach someone else's rows.

function matchingParen(text, open) {
	let depth = 0
	let quoted = false
	for (let i = open; i < text.length; i++) {
		const c = text[i]
		if (c === "'") quoted = !quoted
		if (quoted) continue
		if (c === '(') depth++
		if (c === ')' && --depth === 0) return i
	}
	return -1
}

function stripParens(text) {
	let s = text.trim()
	while (s.startsWith('(') && matchingParen(s, 0) === s.length - 1) s = s.slice(1, -1).trim()
	return s
}

/** The top-level operands of `keyword` (AND or OR), outside parentheses and string literals. */
function topLevel(text, keyword) {
	const parts = []
	const token = ` ${keyword} `
	let depth = 0
	let quoted = false
	let start = 0
	for (let i = 0; i < text.length; i++) {
		const c = text[i]
		if (c === "'") quoted = !quoted
		if (quoted) continue
		if (c === '(') depth++
		else if (c === ')') depth--
		else if (depth === 0 && text.startsWith(token, i)) {
			parts.push(text.slice(start, i))
			start = i + token.length
			i += token.length - 1
		}
	}
	parts.push(text.slice(start))
	return parts
}

/**
 * Whether a policy expression limits rows to the signed-in person's own: `auth.uid()` equal to
 * `column`, as a top-level conjunct. `(SELECT auth.uid())`, Supabase's recommended form,
 * counts the same.
 *
 * @param {string} expression
 * @param {string} column
 */
export function restrictsToOwner(expression, column) {
	const normalized = stripParens(
		expression
			.replace(/\(\s*SELECT\s+auth\.uid\(\)(?:\s+AS\s+\w+)?\s*\)/gi, 'auth.uid()')
			.replace(/\s+/g, ' ')
	)
	if (topLevel(normalized, 'OR').length > 1) return false
	const owner = `(?:\\w+\\.)?${column}`
	const own = new RegExp(`^(?:auth\\.uid\\(\\) = ${owner}|${owner} = auth\\.uid\\(\\))$`)
	return topLevel(normalized, 'AND').some((conjunct) => own.test(stripParens(conjunct)))
}

// ── Evaluation ─────────────────────────────────────────────────────────────────

export function evaluateRlsState(
	tables,
	{
		exemptTables = RLS_EXEMPT_TABLES,
		appReadTables = APP_READ_TABLES,
		allowedPolicies = ALLOWED_POLICIES,
		serverControlledColumns = SERVER_CONTROLLED_COLUMNS,
		secretColumns = SECRET_COLUMNS
	} = {}
) {
	if (tables.length === 0) {
		return { ok: false, problems: ['the database has no tables: were the migrations applied?'] }
	}
	const exempt = new Set(exemptTables)
	const problems = []
	for (const table of tables) {
		if (table.isForced) {
			problems.push(
				`${table.name}: FORCE ROW LEVEL SECURITY is on, which subjects the owner (Prisma, the ` +
					`migrations) to policies that do not exist and locks it out. Enable, don't force.`
			)
		}
		if (table.anonPrivileges.length > 0) {
			problems.push(
				`${table.name}: granted to anon (${table.anonPrivileges.join(', ')}). Nothing here is served ` +
					`to a signed-out caller; add \`REVOKE ALL ON "${table.name}" FROM anon, authenticated;\` ` +
					`in a migration (docs/rules/migrations.md).`
			)
		}
		const owner = Object.hasOwn(appReadTables, table.name) ? appReadTables[table.name] : null
		if (owner != null) {
			if (table.authenticatedPrivileges.length > 0 && table.policyCount === 0) {
				problems.push(
					`${table.name}: granted to authenticated (${table.authenticatedPrivileges.join(', ')}) with ` +
						`no policy. Add the policy the grant is for, or drop the grant.`
				)
			}
			for (const policy of table.policies ?? []) {
				// A restrictive policy can only narrow what the permissive ones allow.
				if (!policy.permissive) continue
				if (Object.hasOwn(allowedPolicies, `${table.name}.${policy.name}`)) continue
				const expressions = [policy.using, policy.check].filter((e) => e != null)
				if (expressions.length > 0 && expressions.every((e) => restrictsToOwner(e, owner))) {
					continue
				}
				problems.push(
					`${table.name}: policy "${policy.name}" (${[policy.using, policy.check]
						.filter((e) => e != null)
						.join(' / ')}) does not restrict to the person's own rows. Every permissive ` +
						`policy on a table the app still reads must require auth.uid() = ${owner}, ANDed ` +
						`with anything else; or name it in ALLOWED_POLICIES with the reason.`
				)
			}
		} else {
			if (table.policyCount > 0) {
				problems.push(
					`${table.name}: has ${table.policyCount} RLS ${table.policyCount === 1 ? 'policy' : 'policies'}. ` +
						`The standard is RLS with no policies: authorization is in the route, and a policy is a ` +
						`Data API path nothing sanctioned uses (docs/rules/database.md).`
				)
			}
			if (table.authenticatedPrivileges.length > 0) {
				problems.push(
					`${table.name}: granted to authenticated (${table.authenticatedPrivileges.join(', ')}). ` +
						`Add \`REVOKE ALL ON "${table.name}" FROM anon, authenticated;\` in a migration ` +
						`(docs/rules/migrations.md).`
				)
			}
		}
		const locked = new Set(serverControlledColumns[table.name] ?? [])
		const writable = (table.columnWrites ?? []).filter((w) => locked.has(w.column))
		if (writable.length > 0) {
			const list = writable.map((w) => `${w.role} ${w.privilege} (${w.column})`).join(', ')
			problems.push(
				`${table.name}: ${list}. These columns are server-controlled: only server code writes them ` +
					`(AGENTS.md, non-negotiable 3). A column REVOKE does not narrow a table-level GRANT; ` +
					`revoke the table-level INSERT/UPDATE and grant back only the person's own columns.`
			)
		}
		// A column-locked table: no table-level SELECT, but some columns carry one. Postgres
		// reports a column it has no privilege on as a TABLE-level denial, so one forgotten
		// column takes out every query that asks for it, however unrelated.
		const granted = new Set(table.columnSelects ?? [])
		const secret = new Set(secretColumns[table.name] ?? [])
		if (!table.hasTableSelect && granted.size > 0) {
			const missing = (table.columns ?? []).filter((c) => !granted.has(c) && !secret.has(c))
			if (missing.length > 0) {
				problems.push(
					`${table.name}: SELECT is granted column by column, but not on ${missing.join(', ')}. Any ` +
						`read asking for one of those is denied as "permission denied for table ` +
						`${table.name}". Grant it in a migration, or name the column in SECRET_COLUMNS with ` +
						`its reason.`
				)
			}
		}
		const leaked = [...secret].filter((c) => granted.has(c) || table.hasTableSelect)
		if (leaked.length > 0) {
			problems.push(
				`${table.name}: ${leaked.join(', ')} is listed in SECRET_COLUMNS, but authenticated can ` +
					`select it. A later table-level grant undoes the column revoke it relies on.`
			)
		}
		if (exempt.has(table.name)) continue
		if (!table.isEnabled) {
			problems.push(
				`${table.name}: RLS is not enabled. Add \`ALTER TABLE "${table.name}" ENABLE ROW LEVEL ` +
					`SECURITY;\` in a migration, or list it in RLS_EXEMPT_TABLES with the reason.`
			)
		}
	}
	return { ok: problems.length === 0, problems }
}

/**
 * Views and SECURITY DEFINER functions: the two ways around RLS that a grant alone opens.
 *
 * @param {{ views?: { name: string, kind: string, apiPrivileges: string[] }[],
 *           functions?: { name: string, callableBy: string[] }[] }} objects
 */
export function evaluateExposure(
	{ views = [], functions = [] },
	{ exposedViews = EXPOSED_VIEWS, callableDefinerFunctions = CALLABLE_DEFINER_FUNCTIONS } = {}
) {
	const problems = []
	for (const view of views) {
		if (view.apiPrivileges.length === 0 || Object.hasOwn(exposedViews, view.name)) continue
		problems.push(
			`${view.name}: a ${view.kind} granted to ${view.apiPrivileges.join(', ')}. It runs as its ` +
				`owner and skips the RLS of the tables under it, so this hands their rows to the Data ` +
				`API. Add \`REVOKE ALL ON "${view.name}" FROM anon, authenticated;\` in a migration, or ` +
				`name it in EXPOSED_VIEWS with the reason.`
		)
	}
	for (const fn of functions) {
		if (fn.callableBy.length === 0 || Object.hasOwn(callableDefinerFunctions, fn.name)) continue
		problems.push(
			`${fn.name}: SECURITY DEFINER, executable by ${fn.callableBy.join(', ')}. It runs as its ` +
				`owner, past RLS, and the Data API serves it at /rpc. Add \`REVOKE EXECUTE ON FUNCTION ` +
				`${fn.name} FROM public, anon, authenticated;\` in a migration (a trigger still fires), ` +
				`or name it in CALLABLE_DEFINER_FUNCTIONS with the reason.`
		)
	}
	return { ok: problems.length === 0, problems }
}

/** Everything above, for one database's catalog. */
export function evaluateCatalog({ tables, views = [], functions = [] }, options = {}) {
	const problems = [
		...evaluateRlsState(tables, options).problems,
		...evaluateExposure({ views, functions }, options).problems
	]
	return { ok: problems.length === 0, problems }
}

// ── The catalog ────────────────────────────────────────────────────────────────
//
// Catalog queries are the sanctioned use of $queryRaw: nothing in the Prisma schema can
// express RLS state, grants or policies. current_schema() follows DATABASE_URL.

async function fetchTables(db) {
	return db.$queryRaw`
		SELECT c.relname AS "name",
		       c.relrowsecurity AS "isEnabled",
		       c.relforcerowsecurity AS "isForced",
		       (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS "policyCount",
		       coalesce((SELECT jsonb_agg(jsonb_build_object(
		                          'name', p.polname,
		                          'permissive', p.polpermissive,
		                          'using', pg_get_expr(p.polqual, p.polrelid),
		                          'check', pg_get_expr(p.polwithcheck, p.polrelid))
		                        ORDER BY p.polname)
		                   FROM pg_policy p WHERE p.polrelid = c.oid), '[]'::jsonb) AS "policies",
		       coalesce((SELECT array_agg(g.privilege_type::text ORDER BY g.privilege_type::text)
		                   FROM information_schema.role_table_grants g
		                  WHERE g.table_schema = n.nspname AND g.table_name = c.relname
		                    AND g.grantee = 'anon'), '{}'::text[]) AS "anonPrivileges",
		       coalesce((SELECT array_agg(g.privilege_type::text ORDER BY g.privilege_type::text)
		                   FROM information_schema.role_table_grants g
		                  WHERE g.table_schema = n.nspname AND g.table_name = c.relname
		                    AND g.grantee = 'authenticated'), '{}'::text[]) AS "authenticatedPrivileges",
		       EXISTS (SELECT 1 FROM aclexplode(c.relacl) a JOIN pg_roles r ON r.oid = a.grantee
		                WHERE r.rolname = 'authenticated' AND a.privilege_type = 'SELECT')
		         AS "hasTableSelect",
		       coalesce((SELECT array_agg(att.attname ORDER BY att.attnum) FROM pg_attribute att
		                  WHERE att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped),
		                '{}'::text[]) AS "columns",
		       coalesce((SELECT array_agg(att.attname ORDER BY att.attnum) FROM pg_attribute att
		                  WHERE att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
		                    AND EXISTS (SELECT 1 FROM aclexplode(att.attacl) a
		                                  JOIN pg_roles r ON r.oid = a.grantee
		                                 WHERE r.rolname = 'authenticated'
		                                   AND a.privilege_type = 'SELECT')),
		                '{}'::text[]) AS "columnSelects",
		       coalesce((SELECT jsonb_agg(jsonb_build_object('role', role.name, 'privilege', priv.name,
		                                                     'column', att.attname)
		                                  ORDER BY att.attnum, role.name, priv.name)
		                   FROM pg_attribute att
		                   CROSS JOIN unnest(${API_ROLES}::text[]) AS role(name)
		                   CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE']) AS priv(name)
		                  WHERE att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
		                    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role.name)
		                    AND has_column_privilege(role.name, c.oid, att.attnum, priv.name)),
		                '[]'::jsonb) AS "columnWrites"
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
		ORDER BY c.relname
	`
}

// has_table_privilege and has_function_privilege count PUBLIC and role membership, which is
// how the defaults reach an API role. Objects an extension owns are the extension's business.
async function fetchViews(db) {
	return db.$queryRaw`
		SELECT c.relname AS "name",
		       CASE c.relkind WHEN 'm' THEN 'materialized view' ELSE 'view' END AS "kind",
		       coalesce((SELECT array_agg(role.name || ' ' || priv.name ORDER BY role.name, priv.name)
		                   FROM unnest(${API_ROLES}::text[]) AS role(name)
		                   CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS priv(name)
		                  WHERE EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role.name)
		                    AND has_table_privilege(role.name, c.oid, priv.name)),
		                '{}'::text[]) AS "apiPrivileges"
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = current_schema() AND c.relkind IN ('v', 'm')
		  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
		ORDER BY c.relname
	`
}

async function fetchDefinerFunctions(db) {
	return db.$queryRaw`
		SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS "name",
		       coalesce((SELECT array_agg(role.name ORDER BY role.name)
		                   FROM unnest(${API_ROLES}::text[]) AS role(name)
		                  WHERE EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role.name)
		                    AND has_function_privilege(role.name, p.oid, 'EXECUTE')),
		                '{}'::text[]) AS "callableBy"
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = current_schema() AND p.prosecdef AND p.prokind IN ('f', 'p')
		  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
		ORDER BY 1
	`
}

async function main() {
	if (!process.env.DATABASE_URL) {
		console.error(
			'DATABASE_URL is not set. This check reads a database with the migrations applied.'
		)
		process.exit(1)
	}
	const db = new PrismaClient()
	let catalog
	try {
		catalog = {
			tables: await fetchTables(db),
			views: await fetchViews(db),
			functions: await fetchDefinerFunctions(db)
		}
	} finally {
		await db.$disconnect()
	}
	const { ok, problems } = evaluateCatalog(catalog)
	if (!ok) {
		console.error('Row Level Security check failed:\n')
		for (const problem of problems) console.error(`  - ${problem}`)
		console.error('\nSee docs/rules/database.md and docs/rules/migrations.md.')
		process.exit(1)
	}
	const { tables, views, functions } = catalog
	const open = tables.filter((table) => Object.hasOwn(APP_READ_TABLES, table.name)).length
	const openNote =
		open === 0
			? ''
			: `, ${open} read by a client directly (APP_READ_TABLES), each grant backed by a ` +
				`policy restricted to the owner's rows`
	console.log(
		`RLS enabled on all ${tables.length} table(s), none forced, none granted to anon, no ` +
			`server-controlled column writable by an API role; ${tables.length - open} with no ` +
			`policy and no grant${openNote}; ${views.length} view(s) and ${functions.length} ` +
			`SECURITY DEFINER function(s), none reachable by an API role.`
	)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main()
}
