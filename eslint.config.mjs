import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import { defineConfig, globalIgnores } from 'eslint/config'
import expo from 'eslint-config-expo/flat.js'

// One config for the monorepo, one block per workspace. Each workspace's base
// config (Next.js for web, Expo for mobile) brings its own copy of plugins such
// as react and @typescript-eslint, and ESLint refuses two definitions of one
// plugin for the same file — so every base config is scoped to its workspace
// before it is added.

const WEB = 'apps/web'
const MOBILE = 'apps/mobile'
const CONTRACT = 'packages/contract'

// Absolute, so the plugins that resolve paths themselves (Next's pages-dir
// lookup, the TypeScript import resolver) work from any cwd — `npm run lint`
// at the root and `eslint .` inside a workspace alike.
const ROOT = path.dirname(fileURLToPath(import.meta.url))
const abs = (p) => path.join(ROOT, p)

// Application code, where console output is banned.
const WEB_CODE = [`${WEB}/src/**/*.{ts,tsx}`]
const MOBILE_CODE = [`${MOBILE}/{app,components,contexts,hooks,lib}/**/*.{ts,tsx}`]

// Web: one file owns each of these dependencies and the rest of src/ imports
// its wrapper (template-web's shape). Every group goes in WEB_RESTRICTED_IMPORTS:
// flat config resolves a rule last-match-wins, so a second
// `no-restricted-imports` over src/** would replace the first, not add to it.
const WEB_LOGGER_IMPORTS = {
	group: ['pino', 'pino/**'],
	message:
		"Import log from '@/server/lib/logger' instead — the shared Pino wrapper owns correlation and redaction. See docs/rules/logging.md."
}
// Prisma is the only data path (docs/rules/database.md). The client is
// constructed once, in src/server/db/client.ts, and the stores beside it are
// what everything else imports. Type imports stay allowed: typing a parameter
// as PrismaClient is not a second connection. The raw drivers and other ORMs
// have no legitimate importer anywhere in src/.
const WEB_DATA_ACCESS_IMPORTS = {
	group: [
		'@prisma/client',
		'@prisma/client/**',
		'pg',
		'pg/**',
		'postgres',
		'@neondatabase/serverless',
		'drizzle-orm',
		'drizzle-orm/**',
		'kysely',
		'knex',
		'typeorm',
		'sequelize',
		'@supabase/postgrest-js'
	],
	allowTypeImports: true,
	message:
		"Use a store from '@/server/db/*' instead — src/server/db/client.ts is the only place the Prisma client is constructed, and raw database drivers have no place in src/. See docs/rules/database.md."
}
// Supabase is auth only (docs/rules/auth.md). The wrappers in src/lib/supabase/
// hand out a client typed to its auth surface, so `.from()` and `.rpc()` are
// type errors; importing the SDK directly is the way around that type, which is
// why it is banned everywhere else. src/middleware.ts is the one other holder:
// it refreshes the session cookie before any wrapper could run.
const WEB_SUPABASE_IMPORTS = {
	group: ['@supabase/supabase-js', '@supabase/ssr', '@supabase/**'],
	allowTypeImports: true,
	message:
		"Use createServerSupabaseClient / createSecretKeyClient / createBrowserSupabaseClient from '@/lib/supabase/*' instead — Supabase is auth only here; application data goes through Prisma. See docs/rules/auth.md."
}
// The Prisma client itself stays inside src/server/db/: everything else imports a store,
// where each query is written and scoped. Only `db` is refused, so `Prisma` (the namespace,
// for input types and Prisma.DbNull) and type imports still come from the client module.
const WEB_DB_CLIENT_IMPORTS = {
	group: ['@/server/db/client', '**/server/db/client', '**/db/client'],
	importNames: ['db'],
	message:
		"Import a store from '@/server/db/*' instead — the Prisma client is used only inside src/server/db/, where each query lives. See docs/rules/database.md."
}
const WEB_RESTRICTED_IMPORTS = [
	WEB_LOGGER_IMPORTS,
	WEB_DATA_ACCESS_IMPORTS,
	WEB_SUPABASE_IMPORTS,
	WEB_DB_CLIENT_IMPORTS
]
// For a file that owns a dependency: every other group still applies to it.
const webRestrictedImportsExcept = (...owned) =>
	WEB_RESTRICTED_IMPORTS.filter((group) => !owned.includes(group))

// A files/ignores pattern, re-rooted at a workspace. FlatCompat turns eslintrc
// `overrides` into function patterns (called with an absolute path); those
// are wrapped so they only ever match inside the workspace.
function within(dir, pattern) {
	if (typeof pattern === 'function') {
		const root = `${abs(dir)}/`
		return (filePath) => filePath.startsWith(root) && pattern(filePath)
	}
	return pattern.startsWith('!') ? `!${dir}/${pattern.slice(1)}` : `${dir}/${pattern}`
}

function scopeTo(dir, configs) {
	return configs.map((config) => {
		// An object holding only `ignores` is a global ignore; keep it global,
		// but relative to the workspace.
		const keys = Object.keys(config).filter((key) => key !== 'name')
		if (keys.length === 1 && keys[0] === 'ignores') {
			return { ...config, ignores: config.ignores.map((p) => within(dir, p)) }
		}
		return {
			...config,
			files: config.files
				? config.files.map((p) =>
						Array.isArray(p) ? p.map((q) => within(dir, q)) : within(dir, p)
					)
				: [`${dir}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}`],
			...(config.ignores && { ignores: config.ignores.map((p) => within(dir, p)) })
		}
	})
}

const compat = new FlatCompat({ baseDirectory: ROOT })

export default defineConfig([
	globalIgnores([
		'**/.next/**',
		'**/.expo/**',
		'**/dist/**',
		'**/build/**',
		'**/out/**',
		'**/coverage/**',
		`${WEB}/next-env.d.ts`,
		'.claude-logs/**'
	]),

	// ── Web: template-web's rules ────────────────────────────────────────────
	...scopeTo(WEB, compat.extends('next/core-web-vitals', 'next/typescript')),
	{
		files: [`${WEB}/**/*.{js,jsx,mjs,ts,tsx,mts}`],
		settings: {
			next: { rootDir: `${abs(WEB)}/` },
			'import/resolver': { typescript: { project: abs(`${WEB}/tsconfig.json`) } }
		}
	},

	// ── Mobile: Expo's React Native rules ────────────────────────────────────
	...scopeTo(MOBILE, expo),
	{
		files: [`${MOBILE}/**/*.{js,jsx,ts,tsx}`],
		settings: {
			'import/resolver': {
				typescript: { project: abs(`${MOBILE}/tsconfig.json`) },
				node: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'] }
			}
		}
	},
	{
		// Jest globals for the mobile test suite.
		files: [`${MOBILE}/__tests__/**/*.{ts,tsx}`, `${MOBILE}/**/*.test.{ts,tsx}`],
		languageOptions: {
			globals: {
				describe: 'readonly',
				it: 'readonly',
				test: 'readonly',
				expect: 'readonly',
				jest: 'readonly',
				beforeAll: 'readonly',
				beforeEach: 'readonly',
				afterAll: 'readonly',
				afterEach: 'readonly'
			}
		}
	},

	// ── The v1 API contract: TypeScript shared by both apps ─────────────────
	...scopeTo(CONTRACT, compat.extends('next/typescript')),
	{
		files: [`${CONTRACT}/**/*.{ts,mts}`],
		rules: { '@typescript-eslint/no-explicit-any': 'error', 'no-console': 'error' }
	},

	// ── Both apps: the standard's two rules (docs/rules/code-quality.md) ─────
	{
		files: [`${WEB}/**/*.{ts,tsx}`, `${MOBILE}/**/*.{ts,tsx}`],
		rules: { '@typescript-eslint/no-explicit-any': 'error' }
	},
	{
		// Application code only: scripts/ and config files are tooling that
		// legitimately prints to stdout.
		files: [...WEB_CODE, ...MOBILE_CODE],
		rules: { 'no-console': 'error' }
	},
	{
		// env.ts is shared with client code and must report invalid boot config
		// before a server-only logger can be imported.
		files: [`${WEB}/src/lib/env.ts`, `${WEB}/**/instrumentation*.ts`, `${WEB}/sentry.*.config.ts`],
		rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] }
	},

	// ── Mobile: environment variables and the logger ─────────────────────────
	{
		// Every variable is read in lib/env.ts. Expo inlines EXPO_PUBLIC_* into
		// a release build only for a static `process.env.EXPO_PUBLIC_X`, so one
		// place that spells each out beats a rule to remember in every file.
		files: MOBILE_CODE,
		ignores: [`${MOBILE}/lib/env.ts`],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "MemberExpression[object.name='process'][property.name='env']",
					message: 'Read environment variables from lib/env.ts (`env.EXPO_PUBLIC_…`).'
				}
			]
		}
	},
	{
		// In lib/env.ts itself, eslint-config-expo already rejects a computed
		// `process.env[name]` and a destructured `process.env` (both undefined
		// in a release build). This adds the third rule: public names only.
		files: [`${MOBILE}/lib/env.ts`],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector:
						"MemberExpression[computed=false][object.object.name='process'][object.property.name='env'][property.name!=/^EXPO_PUBLIC_/]",
					message: 'Only EXPO_PUBLIC_ variables exist in the app bundle.'
				}
			]
		}
	},
	{
		// The logger's development sink is the one place in the app that prints.
		files: [`${MOBILE}/lib/logger/index.ts`],
		rules: { 'no-console': 'off' }
	},

	// ── Mobile: Supabase is auth only (docs/rules/mobile-data.md) ────────────
	{
		// lib/supabase.ts hands out a client typed to its auth surface, so
		// `.from()` and `.rpc()` are type errors; importing the SDK anywhere else
		// is the way around that type. Data goes through lib/api.ts.
		files: [`${MOBILE}/**/*.{js,jsx,ts,tsx}`],
		ignores: [`${MOBILE}/lib/supabase.ts`],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@supabase/supabase-js', '@supabase/**'],
							message:
								"Import { supabase } from '@/lib/supabase' for sign-in, and call the API through '@/lib/api' for data: the app never reads a table. See docs/rules/mobile-data.md."
						}
					]
				}
			]
		}
	},

	// ── Web: the shared wrappers (logging.md, database.md, auth.md) ───────────
	// All groups in ONE rule entry: flat config resolves a rule last-match-wins,
	// so each exemption below restates every group that still applies rather
	// than only subtracting its own.
	{
		files: [`${WEB}/src/**/*.{ts,tsx}`],
		rules: { 'no-restricted-imports': ['error', { patterns: WEB_RESTRICTED_IMPORTS }] }
	},
	{
		// The one file that constructs the Pino logger.
		files: [`${WEB}/src/server/lib/logger/logger.ts`],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: webRestrictedImportsExcept(WEB_LOGGER_IMPORTS) }
			]
		}
	},
	{
		// The stores: the only code that queries through the Prisma client.
		files: [`${WEB}/src/server/db/**/*.ts`],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: webRestrictedImportsExcept(WEB_DB_CLIENT_IMPORTS) }
			]
		}
	},
	{
		// The one file that constructs the Prisma client.
		files: [`${WEB}/src/server/db/client.ts`],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: webRestrictedImportsExcept(WEB_DATA_ACCESS_IMPORTS, WEB_DB_CLIENT_IMPORTS) }
			]
		}
	},
	{
		// The Supabase wrappers, and the middleware that refreshes the session
		// before any of them could run.
		files: [`${WEB}/src/lib/supabase/**/*.ts`, `${WEB}/src/middleware.ts`],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: webRestrictedImportsExcept(WEB_SUPABASE_IMPORTS) }
			]
		}
	},
	{
		// The logger uses node:async_hooks and process.stdout, so it can't run in
		// a browser bundle. It doesn't import `server-only` (that would throw in
		// the node:test suites that exercise it), so the boundary is enforced
		// here instead: a `'use client'` file never imports the logger.
		files: [`${WEB}/src/**/*.{ts,tsx}`],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector:
						"Program:has(> ExpressionStatement[directive='use client']) ImportDeclaration[source.value=/^@\\/server\\/lib\\/logger(\\/|$)/]",
					message:
						'The logger is server-only; a Client Component cannot import it. See docs/rules/logging.md.'
				}
			]
		}
	}
])
