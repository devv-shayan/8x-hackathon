import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { ESLint } from 'eslint'
import {
	CHECKS,
	applyExceptions,
	evaluateStandards,
	loadExceptions,
	loadWorkspaces,
	runStandardsChecks
} from './check-standards.mjs'
import {
	MOBILE,
	PURPOSE,
	REPO_ROOT,
	WEB,
	androidManifest,
	createMonorepoFixture,
	edit,
	editJson,
	linkNodeModule,
	privacyManifest,
	write
} from './standards-fixture.mjs'

const SCRIPT = join(REPO_ROOT, 'scripts/check-standards.mjs')
const MOBILE_CHECKS = CHECKS.filter((check) => check.kinds?.includes('expo')).map(
	(check) => check.id
)

function git(root, ...args) {
	return spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
}

function assertMet(result) {
	assert.equal(result.ok, true, result.detail ?? undefined)
}

function assertUnmet(result, ...patterns) {
	assert.equal(result.ok, false, `${result.id} passed, but the fixture was built to fail it`)
	for (const pattern of patterns) assert.match(result.detail, pattern)
}

// ── Exceptions ───────────────────────────────────────────────────────────────

test('an exception for a standard that is now met is stale and blocks', () => {
	const results = [{ id: 'readme', title: 'README', ok: true, detail: null }]
	const { annotated } = applyExceptions(results, {
		pending: { readme: 'Phase 1' },
		divergences: {}
	})
	assert.equal(annotated[0].status, 'stale')
})

test('pending and divergence exceptions excuse an unmet standard, and nothing else does', () => {
	const results = [
		{ id: 'a', title: 'A', ok: false, detail: 'missing' },
		{ id: 'b', title: 'B', ok: false, detail: 'missing' },
		{ id: 'c', title: 'C', ok: false, detail: 'missing' }
	]
	const { annotated, unknown } = applyExceptions(results, {
		pending: { a: 'Phase 2', ghost: 'Phase 3' },
		divergences: { b: 'on purpose' }
	})
	assert.deepEqual(
		annotated.map((result) => result.status),
		['pending', 'divergence', 'unmet']
	)
	assert.deepEqual(unknown, ['ghost'])
})

test('a workspace-scoped key excuses that workspace and no other', () => {
	const results = [
		{ id: 'typescript-strict', workspace: WEB, ok: false, detail: 'off' },
		{ id: 'typescript-strict', workspace: MOBILE, ok: false, detail: 'off' }
	]
	const { annotated, unknown } = applyExceptions(results, {
		pending: { [`${WEB}:typescript-strict`]: 'PR 7' }
	})
	assert.deepEqual(
		annotated.map((result) => result.status),
		['pending', 'unmet']
	)
	assert.deepEqual(unknown, [])
})

test('a bare key that still covers a met workspace is stale and names the narrower key', () => {
	const results = [
		{ id: 'typescript-strict', workspace: WEB, ok: false, detail: 'off' },
		{ id: 'typescript-strict', workspace: MOBILE, ok: true, detail: null }
	]
	const { annotated } = applyExceptions(results, { pending: { 'typescript-strict': 'PR 7' } })
	assert.deepEqual(
		annotated.map((result) => result.status),
		['pending', 'stale']
	)
	assert.match(annotated[1].detail, /narrow it to "apps\/web:typescript-strict"/)
})

test('a divergence that names no check is declared, and excuses nothing', () => {
	const results = [{ id: 'readme', workspace: null, ok: false, detail: 'missing' }]
	const { annotated, unknown, declared } = applyExceptions(results, {
		divergences: { 'npm-not-pnpm': 'Expo on npm workspaces' }
	})
	assert.equal(annotated[0].status, 'unmet')
	assert.deepEqual(unknown, [])
	assert.deepEqual(declared, [{ key: 'npm-not-pnpm', note: 'Expo on npm workspaces' }])
})

// ── This repo ────────────────────────────────────────────────────────────────

test('this repo meets every standard it does not explicitly except, and the CLI says so', () => {
	const run = spawnSync(process.execPath, [SCRIPT, '--root', REPO_ROOT, '--json'], {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024
	})
	const report = JSON.parse(run.stdout)
	const blocking = report.results.filter(
		(result) => result.status === 'unmet' || result.status === 'stale'
	)
	assert.deepEqual(
		blocking.map((result) => `${result.workspace ?? 'repo'} ${result.id}: ${result.detail}`),
		[],
		'every unmet standard must be listed in scripts/standards-exceptions.json'
	)
	assert.deepEqual(report.unknown, [])
	assert.equal(report.isMet, true)
	assert.equal(run.status, 0)
	assert.deepEqual(report.workspaces, loadWorkspaces(REPO_ROOT))
	const expected =
		CHECKS.filter((check) => check.scope === 'repo').length +
		report.workspaces.reduce(
			(sum, ws) => sum + CHECKS.filter((check) => check.kinds?.includes(ws.kind)).length,
			0
		)
	assert.equal(report.results.length, expected)
})

// A pending exception names the PR that meets it ("PR 12"). A finding no PR
// covers yet says so ("unscheduled: found by PR 13") until one is assigned.
test('every pending exception names the PR that meets it, or says it has none yet', () => {
	const { pending } = loadExceptions(REPO_ROOT)
	for (const [key, note] of Object.entries(pending)) {
		assert.match(
			note,
			/^(?:PR \d+|unscheduled: found by PR \d+)\b/,
			`${key}: "${note}" names no PR`
		)
	}
})

// ── standards.config.json ────────────────────────────────────────────────────

test('without standards.config.json the repo is one Next.js app at its root', () => {
	const root = mkdtempSync(join(tmpdir(), 'check-standards-config-'))
	try {
		assert.deepEqual(loadWorkspaces(root), [{ path: '.', kind: 'next' }])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('standards.config.json is refused with an unknown kind, a missing or an escaping path', () => {
	const root = mkdtempSync(join(tmpdir(), 'check-standards-config-'))
	try {
		write(root, 'apps/api/package.json', { name: 'api' })
		const refuse = (workspaces, pattern) => {
			write(root, 'standards.config.json', { workspaces })
			assert.throws(() => loadWorkspaces(root), pattern)
		}
		refuse([{ path: 'apps/api', kind: 'rails' }], /kind "rails"/)
		refuse([{ path: 'apps/gone', kind: 'next' }], /apps\/gone" has no package\.json/)
		refuse([{ path: '../elsewhere', kind: 'next' }], /must be inside the repo/)
		refuse([], /lists no "workspaces"/)
		write(root, 'standards.config.json', { workspaces: [{ path: './apps/api/', kind: 'next' }] })
		assert.deepEqual(loadWorkspaces(root), [{ path: 'apps/api', kind: 'next' }])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

function checkMonorepo(mutate, id, workspace = MOBILE) {
	const root = createMonorepoFixture()
	try {
		mutate(root)
		const { results } = runStandardsChecks({ root, ids: [id] })
		const result = results.find(
			(candidate) => candidate.id === id && candidate.workspace === workspace
		)
		assert.ok(result, `${id} did not run in ${workspace ?? 'the repo'}`)
		return result
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

const unchanged = () => {}

test('the CLI exits 1 with the reason when standards.config.json is broken', () => {
	const root = createMonorepoFixture()
	try {
		write(root, 'standards.config.json', { workspaces: [{ path: MOBILE, kind: 'flutter' }] })
		const run = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' })
		assert.equal(run.status, 1)
		assert.match(run.stderr, /kind "flutter"/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('the synthetic monorepo meets every mobile standard and the web checks it is built for', () => {
	const root = createMonorepoFixture()
	try {
		const ids = [...MOBILE_CHECKS, 'env-schema']
		const { results } = runStandardsChecks({ root, ids })
		const failed = results.filter((result) => !result.ok)
		assert.deepEqual(
			failed.map((result) => `${result.workspace} ${result.id}: ${result.detail}`),
			[]
		)
		assert.equal(results.length, MOBILE_CHECKS.length + 3) // env-schema, and the two shared checks on web
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('repo-level checks run once, and each workspace runs only its own kind', () => {
	const root = createMonorepoFixture()
	try {
		const { results, workspaces } = runStandardsChecks({
			root,
			ids: ['readme', 'env-schema', 'typescript-strict', 'mobile-logger']
		})
		assert.deepEqual(workspaces, [
			{ path: WEB, kind: 'next' },
			{ path: MOBILE, kind: 'expo' }
		])
		assert.deepEqual(
			results.map((result) => `${result.workspace ?? 'repo'} ${result.id}`),
			[
				'repo readme',
				`${WEB} env-schema`,
				`${WEB} typescript-strict`,
				`${MOBILE} typescript-strict`,
				`${MOBILE} mobile-logger`
			]
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('an exception is judged against the fixture end to end: pending while unmet, stale once met', () => {
	const root = createMonorepoFixture()
	try {
		write(root, 'scripts/standards-exceptions.json', { pending: { 'ota-configured': 'PR 12' } })
		const met = evaluateStandards({ root, ids: ['ota-configured'] })
		assert.equal(met.results[0].status, 'stale')
		assert.equal(met.isMet, false)
		editJson(root, `${MOBILE}/package.json`, (pkg) => delete pkg.dependencies['expo-updates'])
		const unmet = evaluateStandards({ root, ids: ['ota-configured'] })
		assert.equal(unmet.results[0].status, 'pending')
		assert.equal(unmet.isMet, true)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

// ── Next.js workspace: the app-level checks, resolved inside it ───────────────

test('env-schema reads the schema and example inside the workspace, not at the root', () => {
	assertMet(checkMonorepo(unchanged, 'env-schema', WEB))
	const result = checkMonorepo(
		(root) => {
			mkdirSync(join(root, 'src/lib'), { recursive: true })
			cpSync(join(root, WEB, 'src/lib/env.ts'), join(root, 'src/lib/env.ts'))
			rmSync(join(root, WEB, 'src/lib/env.ts'))
		},
		'env-schema',
		WEB
	)
	assertUnmet(result, /apps\/web\/src\/lib\/env\.ts is missing/)
})

test('env-schema fails when the root check:env never looks at the workspace', () => {
	const result = checkMonorepo(
		(root) => write(root, 'scripts/check-env-vars.mjs', '// Checks apps/mobile only.\n'),
		'env-schema',
		WEB
	)
	assertUnmet(result, /check-env-vars\.mjs never looks at apps\/web\//)
})

// The other monorepo layout: each workspace owns its env check, and the
// root check:env runs every workspace's.
function ownEnvChecks(root, rootScript) {
	editJson(root, 'package.json', (pkg) => {
		pkg.scripts['check:env'] = rootScript
	})
	for (const ws of [WEB, MOBILE]) {
		editJson(root, `${ws}/package.json`, (pkg) => {
			pkg.scripts = { 'check:env': 'node scripts/check-env-vars.mjs' }
		})
		write(root, `${ws}/scripts/check-env-vars.mjs`, '// Checks this workspace.\n')
	}
	rmSync(join(root, 'scripts/check-env-vars.mjs'))
}

test('env-schema accepts a check:env the workspace owns, when the root check:env runs it', () => {
	for (const rootScript of [
		'npm run check:env --workspaces --if-present',
		'npm run check:env --workspace=@fixture/web && npm run check:env -w apps/mobile'
	]) {
		assertMet(checkMonorepo((root) => ownEnvChecks(root, rootScript), 'env-schema', WEB))
		assertMet(checkMonorepo((root) => ownEnvChecks(root, rootScript), 'mobile-env-schema'))
	}
})

test('env-schema fails a workspace check:env the root never runs, or a workspace without one', () => {
	const unreached = checkMonorepo(
		(root) => ownEnvChecks(root, 'npm run check:env --workspace=@fixture/mobile'),
		'env-schema',
		WEB
	)
	assertUnmet(unreached, /the root "check:env" never runs apps\/web's/)
	const missing = checkMonorepo((root) => {
		ownEnvChecks(root, 'npm run check:env --workspaces --if-present')
		editJson(root, `${MOBILE}/package.json`, (pkg) => delete pkg.scripts['check:env'])
	}, 'mobile-env-schema')
	assertUnmet(missing, /apps\/mobile\/package\.json has no "check:env" script/)
})

test('structured-logger names the workspace paths it is missing', () => {
	const result = checkMonorepo(unchanged, 'structured-logger', WEB)
	assertUnmet(
		result,
		/pino is not a runtime dependency of apps\/web\/package\.json/,
		/apps\/web\/src\/server\/lib\/logger\/logger\.ts is missing/,
		/must discover apps\/web\/src\/\*\*\/\*\.test\.mts/
	)
})

test('structured-logger accepts the workspace test script or a root one that names it', () => {
	const viaWorkspace = checkMonorepo(
		(root) =>
			editJson(root, `${WEB}/package.json`, (pkg) => {
				pkg.scripts = { test: 'node --test "src/**/*.test.mts"' }
			}),
		'structured-logger',
		WEB
	)
	assert.doesNotMatch(viaWorkspace.detail, /must discover/)
	const viaRoot = checkMonorepo(
		(root) =>
			editJson(root, 'package.json', (pkg) => {
				pkg.scripts.test = 'node --test "apps/web/src/**/*.test.mts"'
			}),
		'structured-logger',
		WEB
	)
	assert.doesNotMatch(viaRoot.detail, /must discover/)
})

test('supabase-auth-only reads the wrappers inside the workspace', () => {
	const result = checkMonorepo(unchanged, 'supabase-auth-only', WEB)
	assertUnmet(
		result,
		/apps\/web\/src\/lib\/supabase\/auth-only\.ts is missing/,
		/apps\/web\/src\/lib\/supabase\/server\.ts is missing/
	)
})

test('eslint-effective-rules asks ESLint about each workspace file, from the root', () => {
	assertMet(checkMonorepo(unchanged, 'eslint-effective-rules', WEB))
	assertMet(checkMonorepo(unchanged, 'eslint-effective-rules', MOBILE))
	const result = checkMonorepo(
		(root) =>
			edit(root, 'eslint.config.mjs', (text) =>
				text.replace(
					/\]\n$/,
					"\t{ files: ['apps/mobile/lib/**'], rules: { 'no-console': 'off' } }\n]\n"
				)
			),
		'eslint-effective-rules',
		MOBILE
	)
	assertUnmet(result, /for apps\/mobile\/lib\/env\.ts: no-console is not an error/)
})

test('typescript-strict reads each workspace tsconfig', () => {
	assertMet(checkMonorepo(unchanged, 'typescript-strict', MOBILE))
	const result = checkMonorepo(
		(root) =>
			editJson(root, `${MOBILE}/tsconfig.json`, (config) => {
				config.compilerOptions.strict = false
			}),
		'typescript-strict',
		MOBILE
	)
	assertUnmet(result, /resolved apps\/mobile\/tsconfig\.json/)
})

// ── Expo workspace: the mobile standards ─────────────────────────────────────

test('mobile-no-server-code fails on Pino or Prisma in the app', () => {
	assertMet(checkMonorepo(unchanged, 'mobile-no-server-code'))
	const dependency = checkMonorepo(
		(root) =>
			editJson(root, `${MOBILE}/package.json`, (pkg) => {
				pkg.dependencies.pino = '1.0.0'
			}),
		'mobile-no-server-code'
	)
	assertUnmet(dependency, /depends on pino/)
	const prisma = checkMonorepo((root) => {
		write(root, `${MOBILE}/prisma/schema.prisma`, 'datasource db {\n\tprovider = "postgresql"\n}\n')
		write(root, `${MOBILE}/lib/db.ts`, "import { PrismaClient } from '@prisma/client'\n")
	}, 'mobile-no-server-code')
	assertUnmet(
		prisma,
		/server-only directories exist: apps\/mobile\/prisma/,
		/Prisma schemas exist/,
		/imports Pino or Prisma: apps\/mobile\/lib\/db\.ts/
	)
})

test('mobile-env-schema passes static EXPO_PUBLIC_ reads through Zod', () => {
	assertMet(checkMonorepo(unchanged, 'mobile-env-schema'))
})

test('mobile-env-schema fails on a dynamic read, in env.ts or anywhere else', () => {
	const inSchema = checkMonorepo(
		(root) =>
			edit(
				root,
				`${MOBILE}/lib/env.ts`,
				(text) =>
					`${text}const name = 'EXPO_PUBLIC_SITE_URL'\nexport const site = process.env[name]\n`
			),
		'mobile-env-schema'
	)
	assertUnmet(inSchema, /dynamic process\.env access.*apps\/mobile\/lib\/env\.ts:\d+/)
	const destructured = checkMonorepo(
		(root) =>
			write(root, `${MOBILE}/lib/site.ts`, 'export const { EXPO_PUBLIC_SITE_URL } = process.env\n'),
		'mobile-env-schema'
	)
	assertUnmet(destructured, /apps\/mobile\/lib\/site\.ts:1/)
})

test('mobile-env-schema fails on a missing schema, a non-public read, or check:env not covering it', () => {
	assertUnmet(
		checkMonorepo((root) => rmSync(join(root, MOBILE, 'lib/env.ts')), 'mobile-env-schema'),
		/apps\/mobile\/lib\/env\.ts is missing/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/lib/env.ts`, (text) =>
					text.replace('process.env.EXPO_PUBLIC_SITE_URL', 'process.env.SITE_URL')
				),
			'mobile-env-schema'
		),
		/reads SITE_URL — only EXPO_PUBLIC_\*/
	)
	assertUnmet(
		checkMonorepo(
			(root) => write(root, 'scripts/check-env-vars.mjs', '// Checks apps/web only.\n'),
			'mobile-env-schema'
		),
		/never looks at apps\/mobile\//
	)
})

test('mobile-no-secrets-in-bundle passes eas.json profiles that name their EAS environment', () => {
	// The fixture's preview profile keeps an env block with one neutral key.
	assertMet(checkMonorepo(unchanged, 'mobile-no-secrets-in-bundle'))
})

test('mobile-no-secrets-in-bundle fails on a secret-named EXPO_PUBLIC_ variable', () => {
	const result = checkMonorepo(
		(root) =>
			write(
				root,
				`${MOBILE}/lib/admin.ts`,
				'export const role = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_NAME\n'
			),
		'mobile-no-secrets-in-bundle'
	)
	assertUnmet(result, /EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_NAME \(apps\/mobile\/lib\/admin\.ts\)/)
})

test('mobile-no-secrets-in-bundle fails an EXPO_PUBLIC_ name in an eas.json env, whatever its value', () => {
	// A placeholder, a $VAR reference and a loopback URL all ship as written.
	for (const value of [
		'REPLACE_WITH_STAGING_SITE_URL',
		'$STAGING_SITE_URL',
		'http://127.0.0.1:3000'
	]) {
		const result = checkMonorepo(
			(root) =>
				editJson(root, `${MOBILE}/eas.json`, (eas) => {
					eas.build.preview.env.EXPO_PUBLIC_SITE_URL = value
				}),
			'mobile-no-secrets-in-bundle'
		)
		assertUnmet(
			result,
			/sets build\.preview\.env\.EXPO_PUBLIC_SITE_URL in a build profile's env/,
			/eas env:set --environment/,
			/docs\/rules\/secrets\.md/
		)
	}
})

test('mobile-no-secrets-in-bundle fails a credential-named key in an eas.json env', () => {
	const result = checkMonorepo(
		(root) =>
			editJson(root, `${MOBILE}/eas.json`, (eas) => {
				eas.build.development.env = { SENTRY_AUTH_TOKEN: '$SENTRY_AUTH_TOKEN', uploadApiKey: 'x' }
			}),
		'mobile-no-secrets-in-bundle'
	)
	assertUnmet(
		result,
		/sets build\.development\.env\.SENTRY_AUTH_TOKEN, build\.development\.env\.uploadApiKey in/
	)
})

test('mobile-no-secrets-in-bundle refuses to pass having found no EXPO_PUBLIC_ variable', () => {
	const result = checkMonorepo((root) => {
		for (const file of [
			'lib/env.ts',
			'lib/supabase.ts',
			'lib/account.ts',
			'.env.example',
			'eas.json'
		]) {
			rmSync(join(root, MOBILE, file))
		}
	}, 'mobile-no-secrets-in-bundle')
	assertUnmet(result, /found no EXPO_PUBLIC_\* variable/)
})

test('mobile-logger passes a breadcrumb logger with the web redaction list', () => {
	assertMet(checkMonorepo(unchanged, 'mobile-logger'))
})

test('mobile-logger fails without Sentry breadcrumbs or without the logger', () => {
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/lib/logger.ts`, (text) =>
					text.replace('Sentry.addBreadcrumb({ message, data: safe })', 'void message')
				),
			'mobile-logger'
		),
		/leaves no Sentry breadcrumbs/
	)
	assertUnmet(
		checkMonorepo((root) => rmSync(join(root, MOBILE, 'lib/logger.ts')), 'mobile-logger'),
		/no mobile logger/
	)
})

test('mobile-logger fails when the app and the web redact different words', () => {
	const result = checkMonorepo(
		(root) => edit(root, `${MOBILE}/lib/logger.ts`, (text) => text.replace("'cookie', ", '')),
		'mobile-logger'
	)
	assertUnmet(result, /only the web redacts: cookie/)
})

test('mobile-logger fails when ESLint lets console through in any app file', () => {
	const result = checkMonorepo(
		(root) =>
			edit(root, 'eslint.config.mjs', (text) =>
				text.replace(
					/\]\n$/,
					"\t{ files: ['apps/mobile/lib/account.ts'], rules: { 'no-console': 'off' } }\n]\n"
				)
			),
		'mobile-logger'
	)
	assertUnmet(
		result,
		/no-console is not an error in 1 source file\(s\): apps\/mobile\/lib\/account\.ts/
	)
})

test('mobile-auth-only passes an auth-only client with the SDK banned elsewhere', () => {
	assertMet(checkMonorepo(unchanged, 'mobile-auth-only'))
})

test('mobile-auth-only fails when the client type exposes a data path or is not used', () => {
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/lib/supabase.ts`, (text) =>
					text.replace("'auth' | 'storage'", "'auth' | 'from'")
				),
			'mobile-auth-only'
		),
		/exposes from — that is a data path/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/lib/supabase.ts`, (text) =>
					text.replace('export const supabase: AuthOnlySupabaseClient =', 'export const supabase =')
				),
			'mobile-auth-only'
		),
		/exports no `supabase` annotated/
	)
})

test('mobile-auth-only fails when @supabase/* can be imported outside lib/supabase.ts', () => {
	const result = checkMonorepo(
		(root) =>
			edit(root, 'eslint.config.mjs', (text) =>
				text.replace("files: ['apps/mobile/**/*.{ts,tsx}']", "files: ['apps/mobile/{app,lib}/**']")
			),
		'mobile-auth-only'
	)
	assertUnmet(result, /can be imported in apps\/mobile\/components/)
})

test('ota-configured passes, and a profile inherits its channel through extends', () => {
	assertMet(checkMonorepo(unchanged, 'ota-configured'))
	assertMet(
		checkMonorepo(
			(root) => editJson(root, `${MOBILE}/eas.json`, (eas) => delete eas.build.production.channel),
			'ota-configured'
		)
	)
})

test('ota-configured fails without expo-updates, an update URL, or the fingerprint policy', () => {
	const result = checkMonorepo((root) => {
		editJson(root, `${MOBILE}/package.json`, (pkg) => delete pkg.dependencies['expo-updates'])
		editJson(root, `${MOBILE}/app.json`, (app) => {
			delete app.expo.updates
			app.expo.runtimeVersion = { policy: 'appVersion' }
		})
	}, 'ota-configured')
	assertUnmet(
		result,
		/expo-updates is not a dependency/,
		/has no updates\.url/,
		/runtimeVersion is \{"policy":"appVersion"\}/
	)
})

test('ota-configured fails on a release profile without a channel', () => {
	const result = checkMonorepo(
		(root) => editJson(root, `${MOBILE}/eas.json`, (eas) => delete eas.build.preview.channel),
		'ota-configured'
	)
	assertUnmet(
		result,
		/build profiles without a channel \(their builds never get an update\): preview$/
	)
})

test('store-review-skill passes when the skill exists, is invoked, and CI runs check:store', () => {
	assertMet(checkMonorepo(unchanged, 'store-review-skill'))
})

test('store-review-skill fails without the skill, its invocation, or CI running check:store', () => {
	assertUnmet(
		checkMonorepo(
			(root) => rmSync(join(root, '.claude/skills/store-review'), { recursive: true }),
			'store-review-skill'
		),
		/store-review\/SKILL\.md is missing/
	)
	assertUnmet(
		checkMonorepo(
			(root) => write(root, '.claude/skills/ship/SKILL.md', 'Run the gates, then push.\n'),
			'store-review-skill'
		),
		/ship\/SKILL\.md does not invoke store-review when apps\/mobile\/ changed/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, '.github/workflows/ci.yml', (text) =>
					text.replace('- run: npm run check:store', '# - run: npm run check:store')
				),
			'store-review-skill'
		),
		/never runs check:store/
	)
})

test('ios-purpose-strings passes specific strings, from the plugin or ios.infoPlist', () => {
	assertMet(checkMonorepo(unchanged, 'ios-purpose-strings'))
	assertMet(
		checkMonorepo(
			(root) =>
				editJson(root, `${MOBILE}/app.json`, (app) => {
					app.expo.plugins = []
					app.expo.ios.infoPlist = {
						NSPhotoLibraryUsageDescription: PURPOSE.photosPermission,
						NSCameraUsageDescription: PURPOSE.cameraPermission,
						NSMicrophoneUsageDescription: PURPOSE.microphonePermission
					}
				}),
			'ios-purpose-strings'
		)
	)
})

test('ios-purpose-strings accepts false, the documented opt-out, and passes with no such module', () => {
	assertMet(
		checkMonorepo(
			(root) =>
				editJson(root, `${MOBILE}/app.json`, (app) => {
					app.expo.plugins[0][1].microphonePermission = false
				}),
			'ios-purpose-strings'
		)
	)
	const none = checkMonorepo(
		(root) =>
			editJson(
				root,
				`${MOBILE}/package.json`,
				(pkg) => delete pkg.dependencies['expo-image-picker']
			),
		'ios-purpose-strings'
	)
	assertMet(none)
	assert.match(none.detail, /no installed module asks/)
})

test('ios-purpose-strings fails on a missing or a generic purpose string', () => {
	const missing = checkMonorepo(
		(root) => editJson(root, `${MOBILE}/app.json`, (app) => (app.expo.plugins = [])),
		'ios-purpose-strings'
	)
	assertUnmet(
		missing,
		/expo-image-picker: NSPhotoLibraryUsageDescription is not set/,
		/NSCameraUsageDescription is not set/,
		/NSMicrophoneUsageDescription is not set/
	)
	const generic = checkMonorepo(
		(root) =>
			editJson(root, `${MOBILE}/app.json`, (app) => {
				app.expo.plugins[0][1].cameraPermission = 'Allow $(PRODUCT_NAME) to access your camera'
			}),
		'ios-purpose-strings'
	)
	assertUnmet(generic, /NSCameraUsageDescription is the generic/)
})

test('ios-privacy-manifest passes when every category the dependencies use is declared', () => {
	assertMet(checkMonorepo(unchanged, 'ios-privacy-manifest'))
})

test('ios-privacy-manifest names the category and the dependency that needs it', () => {
	const result = checkMonorepo(
		(root) =>
			editJson(root, `${MOBILE}/app.json`, (app) => {
				app.expo.ios.privacyManifests.NSPrivacyAccessedAPITypes.pop()
			}),
		'ios-privacy-manifest'
	)
	assertUnmet(result, /NSPrivacyAccessedAPICategoryFileTimestamp \(used by react-native\)/)
})

test('ios-privacy-manifest reads transitive native dependencies too', () => {
	const result = checkMonorepo((root) => {
		write(root, 'node_modules/expo-file-system/package.json', { name: 'expo-file-system' })
		write(
			root,
			'node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy',
			privacyManifest(['NSPrivacyAccessedAPICategoryDiskSpace'])
		)
		editJson(root, 'node_modules/expo/package.json', (pkg) => {
			pkg.dependencies['expo-file-system'] = '1.0.0'
		})
	}, 'ios-privacy-manifest')
	assertUnmet(result, /NSPrivacyAccessedAPICategoryDiskSpace \(used by expo-file-system\)/)
})

test('ios-privacy-manifest fails without the manifest, a reason, or installed dependencies', () => {
	assertUnmet(
		checkMonorepo(
			(root) => editJson(root, `${MOBILE}/app.json`, (app) => delete app.expo.ios.privacyManifests),
			'ios-privacy-manifest'
		),
		/has no ios\.privacyManifests\.NSPrivacyAccessedAPITypes/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				editJson(root, `${MOBILE}/app.json`, (app) => {
					app.expo.ios.privacyManifests.NSPrivacyAccessedAPITypes[0].NSPrivacyAccessedAPITypeReasons =
						[]
				}),
			'ios-privacy-manifest'
		),
		/NSPrivacyAccessedAPICategoryUserDefaults gives no NSPrivacyAccessedAPITypeReasons/
	)
	assertUnmet(
		checkMonorepo(
			(root) => rmSync(join(root, 'node_modules/expo'), { recursive: true }),
			'ios-privacy-manifest'
		),
		/expo is not installed under node_modules/
	)
})

test('android-permissions-minimal passes when the broad permissions are blocked', () => {
	assertMet(checkMonorepo(unchanged, 'android-permissions-minimal'))
})

test('android-permissions-minimal names every source of an unblocked broad permission', () => {
	const result = checkMonorepo(
		(root) =>
			editJson(root, `${MOBILE}/app.json`, (app) => {
				app.expo.android.blockedPermissions = []
				app.expo.android.permissions = ['READ_MEDIA_IMAGES']
			}),
		'android-permissions-minimal'
	)
	assertUnmet(
		result,
		/READ_EXTERNAL_STORAGE is requested \(Expo's prebuild template, expo-image-picker\)/,
		/WRITE_EXTERNAL_STORAGE is requested \(Expo's prebuild template\)/,
		/READ_MEDIA_IMAGES is requested \(apps\/mobile\/app\.json android\.permissions\)/
	)
})

test('android-permissions-minimal accepts a justified permission and fails a stale justification', () => {
	const justified = checkMonorepo((root) => {
		editJson(root, `${MOBILE}/app.json`, (app) => {
			app.expo.android.permissions = ['android.permission.READ_MEDIA_IMAGES']
		})
		write(root, 'scripts/standards-exceptions.json', {
			androidPermissions: { READ_MEDIA_IMAGES: 'a gallery app: browsing photos is the product' }
		})
	}, 'android-permissions-minimal')
	assertMet(justified)
	const stale = checkMonorepo(
		(root) =>
			write(root, 'scripts/standards-exceptions.json', {
				androidPermissions: { READ_MEDIA_VIDEO: 'no longer true' }
			}),
		'android-permissions-minimal'
	)
	assertUnmet(
		stale,
		/lists android\.permission\.READ_MEDIA_VIDEO, which the build does not request/
	)
})

test('android-permissions-minimal reads a committed native manifest instead of the template', () => {
	const result = checkMonorepo((root) => {
		const manifest = `${MOBILE}/android/app/src/main/AndroidManifest.xml`
		write(root, manifest, androidManifest(['android.permission.MANAGE_EXTERNAL_STORAGE']))
		git(root, 'init', '-q')
		git(root, 'add', '-f', manifest)
	}, 'android-permissions-minimal')
	assertUnmet(
		result,
		/MANAGE_EXTERNAL_STORAGE is requested \(apps\/mobile\/android\/app\/src\/main\/AndroidManifest\.xml\)/
	)
	assert.doesNotMatch(result.detail, /prebuild template/)
})

test('att-when-tracking passes an app with no ads or attribution SDK, and says why', () => {
	const result = checkMonorepo(unchanged, 'att-when-tracking')
	assertMet(result)
	assert.match(result.detail, /no ads or attribution SDK/)
})

test('att-when-tracking fails an ads SDK without the tracking prompt', () => {
	const result = checkMonorepo(
		(root) =>
			editJson(root, `${MOBILE}/package.json`, (pkg) => {
				pkg.dependencies['react-native-google-mobile-ads'] = '1.0.0'
			}),
		'att-when-tracking'
	)
	assertUnmet(
		result,
		/react-native-google-mobile-ads is a dependency, expo-tracking-transparency is not/,
		/NSUserTrackingUsageDescription is not set/,
		/calls requestTrackingPermissionsAsync/
	)
})

test('att-when-tracking passes ads with the package, a specific string and the request', () => {
	const addTracking = (root, purpose) => {
		editJson(root, `${MOBILE}/package.json`, (pkg) => {
			pkg.dependencies['react-native-google-mobile-ads'] = '1.0.0'
			pkg.dependencies['expo-tracking-transparency'] = '1.0.0'
		})
		editJson(root, `${MOBILE}/app.json`, (app) => {
			app.expo.plugins.push(['expo-tracking-transparency', { userTrackingPermission: purpose }])
		})
		write(
			root,
			`${MOBILE}/lib/tracking.ts`,
			"import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency'\n\nexport const askToTrack = () => requestTrackingPermissionsAsync()\n"
		)
	}
	assertMet(
		checkMonorepo(
			(root) => addTracking(root, 'Fixture uses this to show you ads that match what you read.'),
			'att-when-tracking'
		)
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				addTracking(
					root,
					'Allow this app to collect app-related data that can be used for tracking you or your device.'
				),
			'att-when-tracking'
		),
		/NSUserTrackingUsageDescription is the generic/
	)
})

test('account-deletion-in-app passes a linked screen that reaches the deletion route', () => {
	assertMet(checkMonorepo(unchanged, 'account-deletion-in-app'))
})

test('account-deletion-in-app follows imports through a hook, and accepts the v1 route', () => {
	const result = checkMonorepo((root) => {
		write(
			root,
			`${MOBILE}/hooks/useDeleteAccount.ts`,
			"import { deleteAccount } from '../lib/account'\n\nexport const useDeleteAccount = () => deleteAccount\n"
		)
		edit(root, `${MOBILE}/app/settings.tsx`, (text) =>
			text
				.replace(
					"import { deleteAccount } from '@/lib/account'",
					"import { useDeleteAccount } from '@/hooks/useDeleteAccount'"
				)
				.replace('onPress={() => deleteAccount()}', 'onPress={useDeleteAccount()}')
		)
		edit(root, `${MOBILE}/lib/account.ts`, (text) =>
			text.replace("'/api/delete-account'", "'/api/app/v1/account'")
		)
	}, 'account-deletion-in-app')
	assertMet(result)
})

test('account-deletion-in-app accepts the route by its contract name, through the API client', () => {
	const result = checkMonorepo((root) => {
		edit(root, `${MOBILE}/lib/account.ts`, (text) =>
			text.replace(
				"fetch(env.EXPO_PUBLIC_SITE_URL + '/api/delete-account', {\n\t\tmethod: 'POST'\n\t})",
				"api('deleteAccount', { timeoutMs: 30_000 })"
			)
		)
	}, 'account-deletion-in-app')
	assertMet(result)
})

test('account-deletion-in-app accepts a Supabase edge function named delete-account', () => {
	const result = checkMonorepo((root) => {
		edit(root, `${MOBILE}/lib/account.ts`, (text) =>
			text.replace(
				"fetch(env.EXPO_PUBLIC_SITE_URL + '/api/delete-account', {\n\t\tmethod: 'POST'\n\t})",
				"supabase.functions.invoke('delete-account', { body: { confirm: true } })"
			)
		)
	}, 'account-deletion-in-app')
	assertMet(result)
})

test('account-deletion-in-app resolves an i18n key through locales/en, and only to the right words', () => {
	const localized = (copy) => (root) => {
		edit(root, `${MOBILE}/app/settings.tsx`, (text) =>
			text.replace('Delete account', "{t('settings.delete.action')}")
		)
		mkdirSync(join(root, MOBILE, 'locales', 'en'), { recursive: true })
		writeFileSync(
			join(root, MOBILE, 'locales', 'en', 'settings.json'),
			JSON.stringify({ delete: { action: copy } })
		)
	}
	assertMet(checkMonorepo(localized('Delete account'), 'account-deletion-in-app'))
	assertUnmet(
		checkMonorepo(localized('Sign out'), 'account-deletion-in-app'),
		/shows a "Delete account" action/
	)
})

test('account-deletion-in-app fails without the route, the action, or a way to reach it', () => {
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/lib/account.ts`, (text) =>
					text.replace("'/api/delete-account'", "'/api/profile'")
				),
			'account-deletion-in-app'
		),
		/calls the account-deletion route/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/app/settings.tsx`, (text) =>
					text.replace('Delete account', 'Account')
				),
			'account-deletion-in-app'
		),
		/shows a "Delete account" action/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/app/(tabs)/profile.tsx`, (text) =>
					text.replace("'/settings'", "'/help'")
				),
			'account-deletion-in-app'
		),
		/nothing navigates to \/settings/
	)
})

test('paywall-legal-links passes routes or URL constants, and a build with nothing to sell', () => {
	assertMet(checkMonorepo(unchanged, 'paywall-legal-links'))
	assertMet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/app/upgrade.tsx`, (text) =>
					text
						.replace("router.push('/terms')", 'Linking.openURL(TERMS_URL)')
						.replace("router.push('/privacy')", 'Linking.openURL(PRIVACY_URL)')
				),
			'paywall-legal-links'
		)
	)
	const nothingToSell = checkMonorepo(
		(root) =>
			editJson(
				root,
				`${MOBILE}/package.json`,
				(pkg) => delete pkg.dependencies['react-native-purchases']
			),
		'paywall-legal-links'
	)
	assertMet(nothingToSell)
	assert.match(nothingToSell.detail, /no in-app purchase SDK/)
})

test('paywall-legal-links fails a paywall missing a legal link or restore', () => {
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/app/upgrade.tsx`, (text) => text.replace(/.*Terms of Use.*\n/, '')),
			'paywall-legal-links'
		),
		/apps\/mobile\/app\/upgrade\.tsx has no Terms of Use \(EULA\) link$/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/app/upgrade.tsx`, (text) =>
					text.replace("router.push('/privacy')", 'undefined')
				),
			'paywall-legal-links'
		),
		/has no Privacy Policy link$/
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/app/upgrade.tsx`, (text) =>
					text.replace('Purchases.restorePurchases()', 'undefined')
				),
			'paywall-legal-links'
		),
		/has no Restore purchases action$/
	)
})

test('paywall-legal-links refuses to pass when it cannot find the paywall', () => {
	const result = checkMonorepo(
		(root) =>
			edit(root, `${MOBILE}/app/upgrade.tsx`, (text) =>
				text.replace('Purchases.purchasePackage(offer)', 'undefined')
			),
		'paywall-legal-links'
	)
	assertUnmet(result, /no screen under apps\/mobile\/app\/ calls a purchase/)
})

const LOGIN = `${MOBILE}/app/(auth)/login.tsx`

test('sign-in-with-apple passes Google beside the native Apple sheet, and an app with no third-party login', () => {
	assertMet(checkMonorepo(unchanged, 'sign-in-with-apple'))
	const noLogin = checkMonorepo((root) => rmSync(join(root, LOGIN)), 'sign-in-with-apple')
	assertMet(noLogin)
	assert.match(noLogin.detail, /no third-party login is offered/)
})

test('sign-in-with-apple fails Google with Apple only through the web OAuth page', () => {
	const result = checkMonorepo((root) => {
		editJson(root, `${MOBILE}/package.json`, (pkg) => {
			delete pkg.dependencies['expo-apple-authentication']
		})
		write(
			root,
			LOGIN,
			[
				"import { supabase } from '@/lib/supabase'",
				'',
				"export const signIn = (provider: 'google' | 'apple') =>",
				'\tsupabase.auth.signInWithOAuth({ provider })',
				''
			].join('\n')
		)
	}, 'sign-in-with-apple')
	assertUnmet(
		result,
		/google sign-in in apps\/mobile\/app\/\(auth\)\/login\.tsx is offered/,
		/expo-apple-authentication is not a dependency/,
		/goes through the web OAuth page/,
		/fix: add expo-apple-authentication/
	)
})

test('sign-in-with-apple fails when the Apple package is installed but its sheet is never shown', () => {
	const result = checkMonorepo(
		(root) =>
			edit(root, LOGIN, (text) =>
				text.replace('AppleAuthentication.signInAsync(', 'AppleAuthentication.isAvailableAsync(')
			),
		'sign-in-with-apple'
	)
	assertUnmet(
		result,
		/expo-apple-authentication is installed but nothing in apps\/mobile\/ presents its sheet/
	)
})

test('sign-in-with-apple counts a login SDK or an expo-auth-session provider as a third-party login', () => {
	const withoutApple = (root) => {
		rmSync(join(root, LOGIN))
		editJson(root, `${MOBILE}/package.json`, (pkg) => {
			delete pkg.dependencies['expo-apple-authentication']
		})
	}
	const sdk = checkMonorepo((root) => {
		withoutApple(root)
		editJson(root, `${MOBILE}/package.json`, (pkg) => {
			pkg.dependencies['@react-native-google-signin/google-signin'] = '1.0.0'
		})
	}, 'sign-in-with-apple')
	assertUnmet(sdk, /@react-native-google-signin\/google-signin is offered/)
	const provider = checkMonorepo((root) => {
		withoutApple(root)
		write(
			root,
			`${MOBILE}/lib/google.ts`,
			"import * as Google from 'expo-auth-session/providers/google'\n\nexport const useGoogle = Google.useAuthRequest\n"
		)
	}, 'sign-in-with-apple')
	assertUnmet(
		provider,
		/expo-auth-session\/providers\/google in apps\/mobile\/lib\/google\.ts is offered/
	)
})

test('mock-data-dev-only passes mock data behind the __DEV__ loader, and an app with none', () => {
	assertMet(checkMonorepo(unchanged, 'mock-data-dev-only'))
	const none = checkMonorepo((root) => {
		for (const file of ['lib/mockData.ts', 'lib/devPlaceholders.ts', 'hooks/useItems.ts']) {
			rmSync(join(root, MOBILE, file))
		}
	}, 'mock-data-dev-only')
	assertMet(none)
	assert.match(none.detail, /no mock data module/)
	assertMet(
		checkMonorepo(
			(root) =>
				edit(root, `${MOBILE}/app/settings.tsx`, (text) => `// Dark mode: coming soon.\n${text}`),
			'mock-data-dev-only'
		)
	)
})

test('mock-data-dev-only fails mock data imported anywhere but the loader', () => {
	const result = checkMonorepo(
		(root) =>
			write(
				root,
				`${MOBILE}/app/demo.tsx`,
				"import { demoItems } from '@/lib/mockData'\n\nexport const items = demoItems\n"
			),
		'mock-data-dev-only'
	)
	assertUnmet(
		result,
		/apps\/mobile\/app\/demo\.tsx references apps\/mobile\/lib\/mockData\.ts directly/
	)
})

test('mock-data-dev-only fails a loader that would bundle mock data into a release build', () => {
	const statically = checkMonorepo(
		(root) =>
			write(
				root,
				`${MOBILE}/lib/devPlaceholders.ts`,
				"import * as mock from './mockData'\n\nexport const devPlaceholders = __DEV__ ? mock : null\n"
			),
		'mock-data-dev-only'
	)
	assertUnmet(statically, /imports mock data statically, so every build bundles it/)
	const unguarded = checkMonorepo(
		(root) =>
			write(
				root,
				`${MOBILE}/lib/devPlaceholders.ts`,
				"export const devPlaceholders = require('./mockData')\n"
			),
		'mock-data-dev-only'
	)
	assertUnmet(unguarded, /requires mock data outside an if \(__DEV__\) block/)
})

test('mock-data-dev-only fails placeholder copy on a screen or in a locale file', () => {
	const screen = checkMonorepo(
		(root) =>
			edit(root, `${MOBILE}/app/settings.tsx`, (text) =>
				text.replace('<Text>Delete account</Text>', '<Text>Delete account (coming soon)</Text>')
			),
		'mock-data-dev-only'
	)
	assertUnmet(screen, /placeholder copy .* in apps\/mobile\/app\/settings\.tsx:\d+/)
	const locale = checkMonorepo(
		(root) => write(root, `${MOBILE}/locales/en.json`, { title: 'Lorem ipsum dolor sit amet' }),
		'mock-data-dev-only'
	)
	assertUnmet(locale, /apps\/mobile\/locales\/en\.json:2/)
})

// ── This repo, copied: the template-web checks, one mutation at a time ─────────
//
// Copied, not referenced, so a test can break one thing without touching the
// real repo. A test runs once this repo meets every standard it exercises;
// while one of them is still excepted in standards-exceptions.json it is
// skipped, and it switches on by itself the day that entry is deleted. The
// mutations are written against this monorepo's layout; if one no longer
// matches the file it edits, edit() fails loudly rather than test nothing.

const EXCEPTIONS = loadExceptions(REPO_ROOT)
const EXCEPTED_IDS = new Set(
	[...Object.keys(EXCEPTIONS.pending), ...Object.keys(EXCEPTIONS.divergences)].map((key) =>
		key.slice(key.lastIndexOf(':') + 1)
	)
)

function fixtureTest(name, ids, fn) {
	const excepted = ids.filter((id) => EXCEPTED_IDS.has(id))
	const skip = excepted.length > 0 ? `still excepted: ${excepted.join(', ')}` : false
	test(name, { skip }, fn)
}

function createRepoFixture() {
	const root = mkdtempSync(join(tmpdir(), 'check-standards-'))
	const listed = spawnSync(
		'git',
		[
			'-C',
			REPO_ROOT,
			'ls-files',
			'-z',
			'--cached',
			'--others',
			'--exclude-standard',
			'--',
			'.',
			':!:.claude/worktrees'
		],
		{ encoding: 'utf8' }
	)
	for (const path of listed.stdout.split('\0').filter(Boolean)) {
		if (!existsSync(join(REPO_ROOT, path))) continue
		mkdirSync(dirname(join(root, path)), { recursive: true })
		cpSync(join(REPO_ROOT, path), join(root, path))
	}
	// Shared, not copied: the tool checks need eslint and tsc resolvable from
	// the fixture. A real directory of per-package links rather than one link
	// to the whole tree, because git refuses to evaluate a path "beyond a
	// symbolic link" — and the ignore check probes node_modules/x.js.
	mkdirSync(join(root, 'node_modules'))
	for (const entry of readdirSync(join(REPO_ROOT, 'node_modules'))) {
		linkNodeModule(join(REPO_ROOT, 'node_modules', entry), join(root, 'node_modules', entry))
	}
	git(root, 'init', '-q')
	git(root, 'add', '-A')
	// `git add` on Windows records hooks as 100644. Unix clones need 100755.
	for (const hook of ['.githooks/commit-msg', '.githooks/pre-commit', '.githooks/pre-push']) {
		if (!existsSync(join(root, hook))) continue
		git(root, 'update-index', '--chmod=+x', hook)
	}
	return root
}

// Mutations that add a file the index must know about call `git add`
// themselves; a blanket re-add here would undo an index-only mutation such
// as `update-index --chmod=-x`.
function withFixture(mutate, ids) {
	const root = createRepoFixture()
	try {
		mutate(root)
		const { results } = runStandardsChecks({ root, ids })
		return Object.fromEntries(
			results.map((result) => [
				result.workspace ? `${result.workspace}:${result.id}` : result.id,
				result
			])
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

fixtureTest(
	'a fixture copied from this repo passes every check, so later failures are the mutation',
	CHECKS.map((check) => check.id),
	() => {
		const results = withFixture(() => {})
		const failed = Object.values(results).filter((result) => !result.ok)
		assert.deepEqual(
			failed.map((result) => `${result.id}: ${result.detail}`),
			[]
		)
	}
)

fixtureTest('agents-md fails when AGENTS.md is missing', ['agents-md'], () => {
	const results = withFixture((root) => rmSync(join(root, 'AGENTS.md')), ['agents-md'])
	assert.equal(results['agents-md'].ok, false)
	assert.match(results['agents-md'].detail, /AGENTS\.md is missing/)
})

fixtureTest(
	'structured-logger rejects a missing dependency, implementation or test coverage',
	['structured-logger'],
	() => {
		const results = withFixture(
			(root) => {
				edit(root, `${WEB}/package.json`, (text) => {
					const pkg = JSON.parse(text)
					delete pkg.dependencies.pino
					delete pkg.scripts?.test
					return JSON.stringify(pkg)
				})
				edit(root, 'package.json', (text) => {
					const pkg = JSON.parse(text)
					pkg.scripts.test = 'node --test scripts/*.test.mjs'
					return JSON.stringify(pkg)
				})
				rmSync(join(root, WEB, 'src/server/lib/logger/logger.ts'))
				writeFileSync(join(root, WEB, 'src/server/lib/logger/redact.test.mts'), '')
			},
			['structured-logger']
		)
		const result = results[`${WEB}:structured-logger`]
		assert.equal(result.ok, false)
		assert.match(result.detail, /pino is not a runtime dependency/)
		assert.match(result.detail, /logger\.ts is missing/)
		assert.match(result.detail, /redact\.test\.mts contains no contract tests/)
		assert.match(result.detail, /test script must discover/)
	}
)

fixtureTest(
	'structured-logger rejects a replacement engine and an unwired Pino import ban',
	['structured-logger'],
	() => {
		const results = withFixture(
			(root) => {
				writeFileSync(
					join(root, WEB, 'src/server/lib/logger/logger.ts'),
					'export const log = console\n'
				)
				edit(root, 'eslint.config.mjs', (text) =>
					text.replace("'pino', 'pino/**'", "'other-logger'")
				)
			},
			['structured-logger']
		)
		const result = results[`${WEB}:structured-logger`]
		assert.equal(result.ok, false)
		assert.match(result.detail, /must construct the shared Pino logger/)
		assert.match(result.detail, /must ban pino/)
	}
)

fixtureTest(
	'logging lint boundaries survive each dependency-specific exemption',
	['structured-logger'],
	async () => {
		const eslint = new ESLint({ cwd: REPO_ROOT })
		for (const filePath of [
			`${WEB}/src/lib/env.ts`,
			`${WEB}/src/server/db/client.ts`,
			`${WEB}/src/lib/supabase/server.ts`,
			`${WEB}/src/server/lib/logger/index.ts`,
			`${WEB}/src/server/lib/logger/logger.ts`
		]) {
			const [result] = await eslint.lintText("import pino from 'pino'\npino()\n", { filePath })
			assert.equal(
				result.messages.some((message) => message.ruleId === 'no-restricted-imports'),
				filePath !== `${WEB}/src/server/lib/logger/logger.ts`,
				filePath
			)
		}
		const [client] = await eslint.lintText(
			"'use client'\nimport { log } from '@/server/lib/logger'\nlog.info('test')\n",
			{ filePath: `${WEB}/src/components/logger-probe.tsx` }
		)
		assert.ok(client.messages.some((message) => message.ruleId === 'no-restricted-syntax'))
		const [consoleCall] = await eslint.lintText("console.error('test')\n", {
			filePath: `${WEB}/src/server/logger-probe.ts`
		})
		assert.ok(consoleCall.messages.some((message) => message.ruleId === 'no-console'))
	}
)

fixtureTest(
	'agents-md-links-resolve refuses to pass on an index that links to nothing',
	['agents-md-links-resolve'],
	() => {
		const results = withFixture(
			(root) =>
				writeFileSync(join(root, 'AGENTS.md'), '# Repo\n\n## Engineering rules\n\nNone yet.\n'),
			['agents-md-links-resolve']
		)
		assert.equal(results['agents-md-links-resolve'].ok, false)
		assert.match(results['agents-md-links-resolve'].detail, /links to nothing/)
	}
)

fixtureTest('agents-md-links-resolve names a dangling link', ['agents-md-links-resolve'], () => {
	const results = withFixture(
		(root) =>
			edit(root, 'AGENTS.md', (text) => `${text}\n- [Ghost](docs/rules/does-not-exist.md)\n`),
		['agents-md-links-resolve']
	)
	assert.equal(results['agents-md-links-resolve'].ok, false)
	assert.match(results['agents-md-links-resolve'].detail, /does-not-exist\.md/)
})

fixtureTest('rules-all-linked names a rule nothing points at', ['rules-all-linked'], () => {
	const results = withFixture(
		(root) => writeFileSync(join(root, 'docs/rules/orphan.md'), '# Orphan\n'),
		['rules-all-linked']
	)
	assert.equal(results['rules-all-linked'].ok, false)
	assert.match(results['rules-all-linked'].detail, /orphan\.md/)
})

fixtureTest('rules-core-set names the missing core rule', ['rules-core-set'], () => {
	const results = withFixture(
		(root) => rmSync(join(root, 'docs/rules/commits.md')),
		['rules-core-set']
	)
	assert.equal(results['rules-core-set'].ok, false)
	assert.match(results['rules-core-set'].detail, /commits\.md/)
})

fixtureTest(
	'per-tool-entry-points fails when CLAUDE.md restates the rules instead of importing them',
	['per-tool-entry-points'],
	() => {
		const results = withFixture(
			(root) => writeFileSync(join(root, 'CLAUDE.md'), '# Rules\n\nUse Prisma. Never use any.\n'),
			['per-tool-entry-points']
		)
		assert.equal(results['per-tool-entry-points'].ok, false)
		assert.match(results['per-tool-entry-points'].detail, /CLAUDE\.md does not contain/)
	}
)

fixtureTest(
	'per-tool-entry-points fails when an optional per-tool file exists without the import',
	['per-tool-entry-points'],
	() => {
		const results = withFixture(
			(root) => writeFileSync(join(root, 'GEMINI.md'), '# Gemini\n\nSome restated rules.\n'),
			['per-tool-entry-points']
		)
		assert.equal(results['per-tool-entry-points'].ok, false)
		assert.match(results['per-tool-entry-points'].detail, /GEMINI\.md exists but/)
	}
)

fixtureTest(
	'commit-msg-hook fails when the hook is not executable on disk',
	['commit-msg-hook'],
	() => {
		const results = withFixture(
			(root) => {
				const hook = join(root, '.githooks/commit-msg')
				if (process.platform === 'win32') {
					writeFileSync(hook, readFileSync(hook, 'utf8').replace(/^#!/, '#'))
				} else {
					chmodSync(hook, 0o644)
				}
			},
			['commit-msg-hook']
		)
		assert.equal(results['commit-msg-hook'].ok, false)
		assert.match(results['commit-msg-hook'].detail, /not executable/)
	}
)

fixtureTest(
	'commit-msg-hook fails when the hook is executable locally but not in the git index',
	['commit-msg-hook'],
	() => {
		const results = withFixture(
			(root) => git(root, 'update-index', '--chmod=-x', '.githooks/commit-msg'),
			['commit-msg-hook']
		)
		assert.equal(results['commit-msg-hook'].ok, false)
		assert.match(results['commit-msg-hook'].detail, /100644 in the git index/)
	}
)

fixtureTest(
	'commit-msg-hook fails when the hook does not call the shared script',
	['commit-msg-hook'],
	() => {
		const results = withFixture(
			(root) => {
				writeFileSync(join(root, '.githooks/commit-msg'), '#!/usr/bin/env sh\nexit 0\n')
				chmodSync(join(root, '.githooks/commit-msg'), 0o755)
			},
			['commit-msg-hook']
		)
		assert.equal(results['commit-msg-hook'].ok, false)
		assert.match(
			results['commit-msg-hook'].detail,
			/does not call scripts\/check-commit-message\.mjs/
		)
	}
)

fixtureTest('secrets-scan fails when the scanner script is gone', ['secrets-scan'], () => {
	const results = withFixture(
		(root) => rmSync(join(root, 'scripts/check-secrets.mjs')),
		['secrets-scan']
	)
	assert.equal(results['secrets-scan'].ok, false)
	assert.match(results['secrets-scan'].detail, /check-secrets\.mjs is missing/)
})

fixtureTest(
	'secrets-scan fails when the pre-commit hook does not call the scanner',
	['secrets-scan'],
	() => {
		const results = withFixture(
			(root) => {
				writeFileSync(join(root, '.githooks/pre-commit'), '#!/usr/bin/env sh\nexit 0\n')
				chmodSync(join(root, '.githooks/pre-commit'), 0o755)
			},
			['secrets-scan']
		)
		assert.equal(results['secrets-scan'].ok, false)
		assert.match(results['secrets-scan'].detail, /does not call scripts\/check-secrets\.mjs/)
	}
)

fixtureTest(
	'secrets-scan fails when the pre-commit hook is executable locally but not in the git index',
	['secrets-scan'],
	() => {
		const results = withFixture(
			(root) => git(root, 'update-index', '--chmod=-x', '.githooks/pre-commit'),
			['secrets-scan']
		)
		assert.equal(results['secrets-scan'].ok, false)
		assert.match(results['secrets-scan'].detail, /100644 in the git index/)
	}
)

fixtureTest('secrets-scan fails when CI stops running check:secrets', ['secrets-scan'], () => {
	const results = withFixture(
		(root) =>
			edit(root, '.github/workflows/ci.yml', (text) =>
				text.replace(/^.*\b(?:npm run|pnpm) check:secrets\b.*\n/gm, '')
			),
		['secrets-scan']
	)
	assert.equal(results['secrets-scan'].ok, false)
	assert.match(results['secrets-scan'].detail, /never runs check:secrets/)
})

fixtureTest(
	'hooks-path-installed fails when prepare no longer points git at .githooks',
	['hooks-path-installed'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, 'package.json', (text) => {
					const pkg = JSON.parse(text)
					delete pkg.scripts.prepare
					return JSON.stringify(pkg, null, '\t')
				}),
			['hooks-path-installed']
		)
		assert.equal(results['hooks-path-installed'].ok, false)
	}
)

fixtureTest(
	'package-scripts names the missing gate and requires --max-warnings=0 on lint',
	['package-scripts'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, 'package.json', (text) => {
					const pkg = JSON.parse(text)
					delete pkg.scripts['check:env']
					return JSON.stringify(pkg, null, '\t')
				}),
			['package-scripts']
		)
		assert.equal(results['package-scripts'].ok, false)
		assert.match(results['package-scripts'].detail, /check:env/)

		const warnings = withFixture(
			(root) =>
				edit(root, 'package.json', (text) => {
					const pkg = JSON.parse(text)
					pkg.scripts.lint = 'eslint .'
					return JSON.stringify(pkg, null, '\t')
				}),
			['package-scripts']
		)
		assert.equal(warnings['package-scripts'].ok, false)
		assert.match(warnings['package-scripts'].detail, /max-warnings=0/)
	}
)

fixtureTest('ci-gates-every-pr names the gate CI stopped running', ['ci-gates-every-pr'], () => {
	const results = withFixture(
		(root) =>
			edit(root, '.github/workflows/ci.yml', (text) =>
				text.replace(/^.*\b(?:npm run|npm|pnpm) test\b.*\n/gm, '')
			),
		['ci-gates-every-pr']
	)
	assert.equal(results['ci-gates-every-pr'].ok, false)
	assert.match(results['ci-gates-every-pr'].detail, /never runs: test$/)
})

fixtureTest(
	'ci-gates-every-pr does not count a gate that only appears in a comment',
	['ci-gates-every-pr'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, '.github/workflows/ci.yml', (text) =>
					text.replace(/^(\s*)(.*\b(?:npm run|npm|pnpm) test\b.*)$/gm, '$1# $2')
				),
			['ci-gates-every-pr']
		)
		assert.equal(results['ci-gates-every-pr'].ok, false)
		assert.match(results['ci-gates-every-pr'].detail, /never runs: test$/)
	}
)

fixtureTest(
	'ci-gates-every-pr fails when the workflow does not trigger on pull requests',
	['ci-gates-every-pr'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, '.github/workflows/ci.yml', (text) =>
					text.replace(/^(\s*)pull_request:.*$/m, '$1workflow_dispatch:')
				),
			['ci-gates-every-pr']
		)
		assert.equal(results['ci-gates-every-pr'].ok, false)
		assert.match(results['ci-gates-every-pr'].detail, /pull_request/)
	}
)

const LOCAL_REVIEW = '.claude/skills/local-review/SKILL.md'
const CI_YML = '.github/workflows/ci.yml'

/** A new root script, so a test can add a gate to one side only. */
function addScript(root, name) {
	editJson(root, 'package.json', (pkg) => {
		pkg.scripts[name] = `node scripts/${name.replace(':', '-')}.mjs`
	})
}

fixtureTest(
	"local-review-mirrors-ci passes when the skill runs the check job's gates in its order",
	['local-review-mirrors-ci'],
	() => {
		const results = withFixture(() => {}, ['local-review-mirrors-ci'])
		assertMet(results['local-review-mirrors-ci'])
	}
)

fixtureTest(
	'local-review-mirrors-ci fails when a CI gate is missing from the skill',
	['local-review-mirrors-ci'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, LOCAL_REVIEW, (text) =>
					text.replace(/^.*\b(?:npm run|pnpm) check:env\b.*\n/gm, '')
				),
			['local-review-mirrors-ci']
		)
		assertUnmet(results['local-review-mirrors-ci'], /does not run: check:env\b/)
	}
)

fixtureTest(
	"local-review-mirrors-ci fails when CI's check job gains a gate the skill does not run",
	['local-review-mirrors-ci'],
	() => {
		const results = withFixture(
			(root) => {
				addScript(root, 'check:links')
				edit(root, CI_YML, (text) =>
					text.replace(
						/^( +)- name: Tests\n( +)run: npm test\n/m,
						'$&\n$1- name: Check links\n$2run: npm run check:links\n'
					)
				)
			},
			['local-review-mirrors-ci']
		)
		assertUnmet(results['local-review-mirrors-ci'], /does not run: check:links\b/)
	}
)

fixtureTest(
	"local-review-mirrors-ci fails when the skill runs CI's gates in another order",
	['local-review-mirrors-ci'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, LOCAL_REVIEW, (text) =>
					text.replace(
						/^(npm run typecheck\b.*)\n(npm run lint\b.*)$/m,
						(_, typecheck, lint) => `${lint}\n${typecheck}`
					)
				),
			['local-review-mirrors-ci']
		)
		assertUnmet(
			results['local-review-mirrors-ci'],
			/out of order: check:secrets, check:template, lint, typecheck,/,
			/job runs check:secrets, check:template, typecheck, lint,/
		)
	}
)

fixtureTest(
	'local-review-mirrors-ci fails when the skill runs a gate no CI job runs',
	['local-review-mirrors-ci'],
	() => {
		const results = withFixture(
			(root) => {
				addScript(root, 'check:links')
				edit(root, LOCAL_REVIEW, (text) =>
					text.replace(/^npm run web:build\b.*$/m, '$&\nnpm run check:links')
				)
			},
			['local-review-mirrors-ci']
		)
		assertUnmet(
			results['local-review-mirrors-ci'],
			/runs check:links, which \.github\/workflows\/ci\.yml never runs/
		)
	}
)

fixtureTest(
	'local-review-mirrors-ci fails when ci.yml has no check job to mirror',
	['local-review-mirrors-ci'],
	() => {
		const results = withFixture(
			(root) => edit(root, CI_YML, (text) => text.replace(/^ {2}check:$/m, '  gates:')),
			['local-review-mirrors-ci']
		)
		assertUnmet(results['local-review-mirrors-ci'], /has no "check" job/)
	}
)

fixtureTest(
	'eslint-effective-rules reads the resolved config, so a later block overriding the rule is caught',
	['eslint-effective-rules'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, 'eslint.config.mjs', (text) =>
					// A trailing block that flips the rule back off — last match wins.
					text.replace(
						/\n\]\)\s*$/,
						`,\n\t{ files: ['${WEB}/src/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } }\n])\n`
					)
				),
			['eslint-effective-rules']
		)
		assert.equal(results[`${WEB}:eslint-effective-rules`].ok, false)
		assert.match(results[`${WEB}:eslint-effective-rules`].detail, /no-explicit-any is not an error/)
		assert.equal(results[`${MOBILE}:eslint-effective-rules`].ok, true)
	}
)

fixtureTest('typescript-strict reads the resolved config', ['typescript-strict'], () => {
	const results = withFixture(
		(root) =>
			edit(root, `${WEB}/tsconfig.json`, (text) =>
				text.replace('"strict": true', '"strict": false')
			),
		['typescript-strict']
	)
	assert.equal(results[`${WEB}:typescript-strict`].ok, false)
	assert.match(results[`${WEB}:typescript-strict`].detail, /strict/)
	assert.equal(results[`${MOBILE}:typescript-strict`].ok, true)
})

fixtureTest('env-schema fails when the schema stops going through zod', ['env-schema'], () => {
	const results = withFixture(
		(root) => writeFileSync(join(root, WEB, 'src/lib/env.ts'), 'export const env = process.env\n'),
		['env-schema']
	)
	assert.equal(results[`${WEB}:env-schema`].ok, false)
	assert.match(results[`${WEB}:env-schema`].detail, /does not import zod/)
})

fixtureTest(
	'no-machine-local-state-tracked flags a tracked .vercel/project.json, even nested',
	['no-machine-local-state-tracked'],
	() => {
		const results = withFixture(
			(root) => {
				mkdirSync(join(root, 'nested/site/.vercel'), { recursive: true })
				writeFileSync(join(root, 'nested/site/.vercel/project.json'), '{"projectId":"prj_x"}\n')
				git(root, 'add', '-f', 'nested/site/.vercel/project.json')
			},
			['no-machine-local-state-tracked']
		)
		assert.equal(results['no-machine-local-state-tracked'].ok, false)
		assert.match(results['no-machine-local-state-tracked'].detail, /\.vercel/)
	}
)

fixtureTest(
	'no-machine-local-state-tracked allows .env.example and nothing else in the .env family',
	['no-machine-local-state-tracked'],
	() => {
		const results = withFixture(
			(root) => {
				writeFileSync(join(root, '.env.local'), 'FLAG=1\n')
				git(root, 'add', '-f', '.env.local')
			},
			['no-machine-local-state-tracked']
		)
		assert.equal(results['no-machine-local-state-tracked'].ok, false)
		assert.match(results['no-machine-local-state-tracked'].detail, /\.env\.local/)
	}
)

fixtureTest(
	'machine-local-state-ignored flags patterns that only match at the root',
	['machine-local-state-ignored'],
	() => {
		const results = withFixture(
			(root) =>
				writeFileSync(
					join(root, '.gitignore'),
					'/node_modules/\n/.vercel/\n.env\n.env.local\n.env.production\n.DS_Store\nsupabase/.temp/\n'
				),
			['machine-local-state-ignored']
		)
		assert.equal(results['machine-local-state-ignored'].ok, false)
		assert.match(
			results['machine-local-state-ignored'].detail,
			/nested\/dir\/\.vercel\/project\.json/
		)
		assert.match(results['machine-local-state-ignored'].detail, /nested\/node_modules\/x\.js/)
	}
)

fixtureTest(
	'session-logs-tracked fails when transcripts are gitignored',
	['session-logs-tracked'],
	() => {
		const results = withFixture(
			(root) => edit(root, '.gitignore', (text) => `${text}\n.claude-logs/\n`),
			['session-logs-tracked']
		)
		assert.equal(results['session-logs-tracked'].ok, false)
		assert.match(results['session-logs-tracked'].detail, /gitignored/)
	}
)

fixtureTest(
	'session-logs-tracked fails when Prettier is not told to skip the transcripts',
	['session-logs-tracked'],
	() => {
		const results = withFixture(
			(root) => writeFileSync(join(root, '.prettierignore'), 'dist/\n'),
			['session-logs-tracked']
		)
		assert.equal(results['session-logs-tracked'].ok, false)
		assert.match(results['session-logs-tracked'].detail, /\.prettierignore does not list/)
	}
)

fixtureTest(
	'session-logs-tracked names the one present log dir left out of prettierignore',
	['session-logs-tracked'],
	() => {
		const results = withFixture(
			(root) => edit(root, '.prettierignore', (text) => text.replace('.claude-logs/\n', '')),
			['session-logs-tracked']
		)
		assert.equal(results['session-logs-tracked'].ok, false)
		assert.match(results['session-logs-tracked'].detail, /does not list \.claude-logs\//)
	}
)

fixtureTest(
	'session-logs-tracked passes a Claude-only repo with no .codex-logs dir',
	['session-logs-tracked'],
	() => {
		const results = withFixture(
			(root) => {
				rmSync(join(root, '.codex-logs'), { recursive: true, force: true })
				edit(root, '.prettierignore', (text) => text.replace('.codex-logs/\n', ''))
			},
			['session-logs-tracked']
		)
		assert.equal(results['session-logs-tracked'].ok, true, results['session-logs-tracked'].detail)
	}
)

test('git-backed checks fail, not skip, outside a git repository', () => {
	const root = mkdtempSync(join(tmpdir(), 'check-standards-nogit-'))
	try {
		const { results } = runStandardsChecks({
			root,
			ids: ['no-machine-local-state-tracked', 'machine-local-state-ignored', 'session-logs-tracked']
		})
		assert.equal(results.length, 3)
		for (const result of results) {
			assert.equal(result.ok, false)
			assert.match(result.detail, /not a git repository/)
		}
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

fixtureTest(
	'the CLI exits 1 and reports the failure as JSON when a standard is unmet',
	['readme'],
	() => {
		const root = createRepoFixture()
		try {
			rmSync(join(root, 'README.md'))
			let stdout
			let status = 0
			try {
				stdout = execFileSync(process.execPath, [SCRIPT, '--root', root, '--json'], {
					encoding: 'utf8',
					stdio: ['ignore', 'pipe', 'pipe'],
					maxBuffer: 16 * 1024 * 1024
				})
			} catch (error) {
				stdout = error.stdout
				status = error.status
			}
			assert.equal(status, 1)
			const report = JSON.parse(stdout)
			assert.equal(report.isMet, false)
			const readme = report.results.find((result) => result.id === 'readme')
			assert.equal(readme.ok, false)
			assert.equal(readme.status, 'unmet')
			assert.ok(existsSync(join(root, 'package.json')), 'the fixture is otherwise intact')
		} finally {
			rmSync(root, { recursive: true, force: true })
		}
	}
)

fixtureTest(
	'prisma-only-data-path fails when @prisma/client drops out of the restricted-imports group',
	['prisma-only-data-path'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, 'eslint.config.mjs', (text) => text.replace(/\s*'@prisma\/client',/, '')),
			['prisma-only-data-path']
		)
		assert.equal(results[`${WEB}:prisma-only-data-path`].ok, false)
		assert.match(results[`${WEB}:prisma-only-data-path`].detail, /does not ban: @prisma\/client/)
	}
)

fixtureTest(
	'supabase-auth-only fails when a wrapper hands out the full client',
	['supabase-auth-only'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, `${WEB}/src/lib/supabase/server.ts`, (text) =>
					text.replace(': Promise<AuthOnlySupabaseClient>', '')
				),
			['supabase-auth-only']
		)
		assert.equal(results[`${WEB}:supabase-auth-only`].ok, false)
		assert.match(
			results[`${WEB}:supabase-auth-only`].detail,
			/server\.ts does not return AuthOnlySupabaseClient/
		)
	}
)

fixtureTest(
	'supabase-auth-only fails when the auth-only type is widened to a data path',
	['supabase-auth-only'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, `${WEB}/src/lib/supabase/auth-only.ts`, (text) =>
					text.replace("'auth' | 'storage'>", "'auth' | 'storage' | 'from'>")
				),
			['supabase-auth-only']
		)
		assert.equal(results[`${WEB}:supabase-auth-only`].ok, false)
		assert.match(results[`${WEB}:supabase-auth-only`].detail, /exposes from\/rpc/)
	}
)

fixtureTest('rls-check-wired fails when the check script is gone', ['rls-check-wired'], () => {
	const results = withFixture(
		(root) => rmSync(join(root, 'scripts/check-rls.mjs')),
		['rls-check-wired']
	)
	assert.equal(results[`${WEB}:rls-check-wired`].ok, false)
	assert.match(results[`${WEB}:rls-check-wired`].detail, /check-rls\.mjs is missing/)
})

fixtureTest(
	'rls-check-wired fails when CI runs the check before the migrations are applied',
	['rls-check-wired'],
	() => {
		const results = withFixture(
			(root) =>
				edit(root, '.github/workflows/ci.yml', (text) =>
					text.replace(
						/^.*\brun: (?:npm ci|pnpm install)\b.*$/m,
						(line) => `${line}\n      - run: npm run check:rls`
					)
				),
			['rls-check-wired']
		)
		assert.equal(results[`${WEB}:rls-check-wired`].ok, false)
		assert.match(results[`${WEB}:rls-check-wired`].detail, /before the migrations are applied/)
	}
)

test('rls-no-policies is met by an RLS check that exempts no table', () => {
	const rlsCheck = (tables) =>
		`export const RLS_EXEMPT_TABLES = []\nexport const APP_READ_TABLES = ${tables}\n`
	assertMet(
		checkMonorepo(
			(root) => write(root, 'scripts/check-rls.mjs', rlsCheck('[]')),
			'rls-no-policies',
			WEB
		)
	)
	assertMet(
		checkMonorepo(
			(root) => write(root, 'scripts/check-rls.mjs', 'export const RLS_EXEMPT_TABLES = []\n'),
			'rls-no-policies',
			WEB
		)
	)
	assertUnmet(
		checkMonorepo(
			(root) => write(root, 'scripts/check-rls.mjs', rlsCheck("['profiles', 'items']")),
			'rls-no-policies',
			WEB
		),
		/still lets profiles, items keep RLS policies and grants/
	)
	// The map form: each table to its owner column.
	assertMet(
		checkMonorepo(
			(root) => write(root, 'scripts/check-rls.mjs', rlsCheck('{}')),
			'rls-no-policies',
			WEB
		)
	)
	assertUnmet(
		checkMonorepo(
			(root) =>
				write(
					root,
					'scripts/check-rls.mjs',
					rlsCheck("{\n\tprofiles: 'id',\n\titems: 'user_id'\n}")
				),
			'rls-no-policies',
			WEB
		),
		/still lets profiles, items keep RLS policies and grants/
	)
	assertUnmet(checkMonorepo(unchanged, 'rls-no-policies', WEB), /check-rls\.mjs is missing/)
})
