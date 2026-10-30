#!/usr/bin/env node
// Checks that the engineering standards in docs/STANDARDS.md are actually
// wired into this repo — the deterministic half of "was the standardisation
// applied": the files exist, the hook is executable, CI runs every gate on a
// pull request, the lint and TypeScript config that is *in effect* (not just
// written down) enforces what the rules say, nothing machine-local is
// tracked. No network, no model, the same answer on every run.
//
// Usage: node scripts/check-standards.mjs [--root <dir>] [--json]
//
// --root points it at another checkout. The failures are the to-do list for
// bringing that repo onto the standards — see docs/STANDARDS.md, "Bringing an
// existing repo onto the standards".
//
// Every check that scans text asserts it found something before it judges
// what it found. The migrated repo's check:env once passed for weeks by matching
// zero variables; a check that can pass by matching nothing is not a check.
//
// Workspace mode (template-monorepo addition, to be offered back to
// template-web): a monorepo says which of its workspaces are apps, and what
// kind, in standards.config.json —
//
//   { "workspaces": [{ "path": "apps/web", "kind": "next" }, { "path": "apps/mobile", "kind": "expo" }] }
//
// Repo-level standards (agent docs, hooks, commits, secrets, Prettier,
// gitignore, session logs, CI, local-review) run once, at the root. A `next`
// workspace runs the app-level standards with their paths resolved inside it
// (apps/web/src/lib/env.ts, ...), asking ESLint and tsc about the workspace's
// files from the root, where the one eslint.config.mjs lives. An `expo`
// workspace runs the mobile standards instead: an app on a phone has no Node
// server, so Pino, Prisma and server/db must not exist there at all. Without
// the file the repo is one Next.js app at its root: template-web's layout,
// checked exactly as before.
//
// Exceptions (plays-dashboard addition, offered back to template-web): a repo
// being brought onto the standards lists what it has not met yet in
// scripts/standards-exceptions.json. `pending` maps a check id to the phase
// that will close it, `divergences` maps one to the written reason this repo
// differs on purpose. Both print as `~` and don't fail. An exception whose
// check now passes DOES fail, so the list can only shrink: that is the
// ratchet. A key is a check id (every workspace that runs it) or
// `<workspace>:<id>` (one workspace). A divergence whose key names no check is
// a repo-wide decision (npm, not pnpm): it is printed, never judged, and it
// cannot excuse a check. `androidPermissions` names the broad Android
// permissions the app genuinely needs, each with its reason.
//
// Exit codes: 0 every standard met or excepted, 1 otherwise (or the config is
// unreadable).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const AGENTS_FILE = 'AGENTS.md'
const RULES_DIR = 'docs/rules'
const README_FILE = 'README.md'

// The rules every repo carries whatever its stack — the engineering-discipline
// half that applied in full to the migrated repo, a repo sharing none of this
// template's framework choices. Stack-specific rules (database, auth, ...)
// are covered by the bidirectional link check rather than named here.
const CORE_RULES = [
	'code-quality.md',
	'commits.md',
	'deployment.md',
	'logging.md',
	'migrations.md',
	'pull-requests.md'
]

// Each imports AGENTS.md rather than restating it. Only CLAUDE.md is required;
// the others are checked if present.
const REQUIRED_ENTRY_POINT = 'CLAUDE.md'
const OPTIONAL_ENTRY_POINTS = ['GEMINI.md', 'QWEN.md', '.cursor/rules/project.mdc']
const AGENTS_IMPORT_LINE = /^@AGENTS\.md\s*$/m

const HOOK = '.githooks/commit-msg'
const COMMIT_MESSAGE_SCRIPT = 'scripts/check-commit-message.mjs'
const HOOKS_PATH_SETTING = 'core.hooksPath .githooks'

const PRE_COMMIT_HOOK = '.githooks/pre-commit'
const SECRETS_SCRIPT = 'scripts/check-secrets.mjs'

const REQUIRED_SCRIPTS = [
	'lint',
	'typecheck',
	'format',
	'format:check',
	'test',
	'check:env',
	'check:standards',
	'check:rls'
]
const CI_GATES = [
	'lint',
	'typecheck',
	'format:check',
	'check:env',
	'test',
	'check:standards',
	'check:rls'
]
const CI_WORKFLOW = '.github/workflows/ci.yml'
// The ci.yml job whose gates the local-review skill runs, in the same order. The
// database gates (the migrations job) need a replayed database, so the skill runs
// them after these, in a block of their own.
const CI_GATE_JOB = 'check'
const LOCAL_REVIEW_SKILL = '.claude/skills/local-review/SKILL.md'

// Repo-level tooling: one script at the root serves every workspace.
const ENV_CHECK_SCRIPT = 'scripts/check-env-vars.mjs'
const RLS_CHECK_SCRIPT = 'scripts/check-rls.mjs'

// Workspace-relative: `next` workspaces resolve these inside themselves.
const ENV_SCHEMA = 'src/lib/env.ts'
const ENV_EXAMPLE = '.env.example'
const LOGGER_DIR = 'src/server/lib/logger'
const LOGGER_TESTS = ['logger.test.mts', 'redact.test.mts', 'context.test.mts']
const LOGGER_REDACT = `${LOGGER_DIR}/redact.ts`
const SUPABASE_AUTH_ONLY_TYPE = 'src/lib/supabase/auth-only.ts'
const SUPABASE_WRAPPERS = ['src/lib/supabase/server.ts', 'src/lib/supabase/secret-key.ts']
// One representative import from each ban list in eslint.config.mjs — enough
// to prove the group in effect is that one, without restating it here.
const DATA_ACCESS_MARKERS = ['@prisma/client', 'pg']
const SUPABASE_MARKERS = ['@supabase/supabase-js', '@supabase/ssr']

const PRETTIER_CONFIGS = [
	'.prettierrc',
	'.prettierrc.json',
	'prettier.config.js',
	'prettier.config.mjs'
]
const PRETTIER_IGNORE = '.prettierignore'
// One per agent that writes a committed transcript: Claude Code to
// .claude-logs/, Codex to .codex-logs/. Each is optional on its own (a
// Claude-only repo has no .codex-logs/), but at least one must exist, and
// every one that does must be tracked, unignored and formatting-exempt.
const SESSION_LOG_DIRS = ['.claude-logs', '.codex-logs']

// Machine-local by construction. Each is probed at the root and nested,
// because a pattern that catches one and misses the other is how
// one repo came to track a nested site/.vercel/project.json.
const MUST_BE_IGNORED = [
	'.env',
	'.env.local',
	'.env.production',
	'.vercel/project.json',
	'nested/dir/.vercel/project.json',
	'node_modules/x.js',
	'nested/node_modules/x.js',
	'.DS_Store',
	'nested/.DS_Store',
	'supabase/.temp/project-ref'
]
const MUST_NOT_BE_TRACKED = [
	{ label: 'a .vercel/ directory', pattern: /(^|\/)\.vercel\// },
	{ label: 'supabase CLI state (supabase/.temp/)', pattern: /(^|\/)supabase\/\.temp\// },
	{ label: 'node_modules/', pattern: /(^|\/)node_modules\// },
	{ label: '.DS_Store', pattern: /(^|\/)\.DS_Store$/ },
	{
		label:
			'a populated env file (.env, .env.local, .env.*.local, .env.development, .env.production)',
		pattern: /(^|\/)\.env(\.local|\..+\.local|\.development|\.production)?$/
	}
]
const MAX_LISTED_HITS = 3

// `pnpm lint`, `npm run lint`, `yarn lint`, `bun run lint` all name the same
// package.json script; this pulls the script name out of any of them.
const SCRIPT_INVOCATION = /\b(?:pnpm|npm|yarn|bun)\b(?:\s+run)?\s+([a-z][a-z0-9:_-]*)/g

// ── Workspace mode ────────────────────────────────────────────────────────────

const CONFIG_FILE = 'standards.config.json'
const EXCEPTIONS_FILE = 'scripts/standards-exceptions.json'
const WORKSPACE_KINDS = ['next', 'expo']
// No standards.config.json: one Next.js app at the root, template-web's layout.
const SINGLE_APP = [{ path: '.', kind: 'next' }]

// The file each kind asks ESLint about: an ordinary source file, so the config
// in effect for it is the config in effect for the app's code.
const ESLINT_PROBE = { next: ENV_SCHEMA, expo: 'lib/env.ts' }
const ESLINT_RULES = ['@typescript-eslint/no-explicit-any', 'no-console', 'no-restricted-imports']

// ── Mobile (`kind: expo`) ─────────────────────────────────────────────────────

const MOBILE_ENV_SCHEMA = 'lib/env.ts'
const MOBILE_SUPABASE_CLIENT = 'lib/supabase.ts'
const MOBILE_LOGGER_ENTRIES = ['lib/logger.ts', 'lib/logger/index.ts']
const EXPO_DYNAMIC_CONFIGS = ['app.config.ts', 'app.config.js', 'app.config.mjs', 'app.config.cjs']
const EAS_CONFIG = 'eas.json'
const STORE_REVIEW_SKILL = '.claude/skills/store-review/SKILL.md'
const SHIP_SKILL = '.claude/skills/ship/SKILL.md'

// Everything EXPO_PUBLIC_ is inlined into the bundle anyone can unzip. A name
// carrying one of these words says the value must never be there.
const FORBIDDEN_PUBLIC_ENV_WORDS = ['SECRET', 'SERVICE_ROLE', 'PRIVATE', 'WEBHOOK']
// What makes a variable name a credential: the words the web logger redacts
// (apps/web/src/server/lib/logger/redact.ts).
const CREDENTIAL_WORDS = new Set([
	'authorization',
	'cookie',
	'credential',
	'credentials',
	'key',
	'passphrase',
	'passwd',
	'password',
	'pwd',
	'secret',
	'signature',
	'token'
])

// Each installed module that can ask for an iOS permission, the Info.plist key
// the request needs, and the config-plugin option that sets it. `false` is
// Expo's documented opt-out (the key is removed, the Android permission
// blocked), so it counts as a decision rather than a gap.
const PERMISSION_MODULES = {
	'expo-image-picker': [
		{ key: 'NSPhotoLibraryUsageDescription', option: 'photosPermission' },
		{ key: 'NSCameraUsageDescription', option: 'cameraPermission' },
		{ key: 'NSMicrophoneUsageDescription', option: 'microphonePermission' }
	],
	'expo-camera': [
		{ key: 'NSCameraUsageDescription', option: 'cameraPermission' },
		{ key: 'NSMicrophoneUsageDescription', option: 'microphonePermission' }
	],
	'expo-media-library': [
		{ key: 'NSPhotoLibraryUsageDescription', option: 'photosPermission' },
		{ key: 'NSPhotoLibraryAddUsageDescription', option: 'savePhotosPermission' }
	],
	'expo-av': [{ key: 'NSMicrophoneUsageDescription', option: 'microphonePermission' }],
	'expo-audio': [{ key: 'NSMicrophoneUsageDescription', option: 'microphonePermission' }],
	'expo-location': [
		{ key: 'NSLocationWhenInUseUsageDescription', option: 'locationWhenInUsePermission' }
	],
	'expo-contacts': [{ key: 'NSContactsUsageDescription', option: 'contactsPermission' }],
	'expo-calendar': [
		{ key: 'NSCalendarsUsageDescription', option: 'calendarPermission' },
		{ key: 'NSRemindersUsageDescription', option: 'remindersPermission' }
	],
	'expo-tracking-transparency': [
		{ key: 'NSUserTrackingUsageDescription', option: 'userTrackingPermission' }
	],
	'expo-local-authentication': [{ key: 'NSFaceIDUsageDescription', option: 'faceIDPermission' }],
	'expo-sensors': [{ key: 'NSMotionUsageDescription', option: 'motionPermission' }],
	'react-native-ble-plx': [
		{ key: 'NSBluetoothAlwaysUsageDescription', option: 'bluetoothAlwaysPermission' }
	],
	'react-native-vision-camera': [
		{ key: 'NSCameraUsageDescription', option: 'cameraPermissionText' }
	]
}
// What Expo writes when a module's plugin is given no string. App Review
// rejects it under 5.1.1: it says what is accessed, not why.
const GENERIC_PURPOSE_STRING = /^Allow (?:\$\(PRODUCT_NAME\)|this app) to\b/i

// The ads and attribution SDKs of the store-review rule table, by npm name.
// Any one of them means App Tracking Transparency before it starts.
const ADS_AND_ATTRIBUTION_SDKS = [
	'react-native-google-mobile-ads',
	'react-native-admob-native-ads',
	'expo-ads-admob',
	'expo-ads-facebook',
	'react-native-fbads',
	'react-native-fbsdk-next',
	'react-native-applovin-max',
	'react-native-unity-ads',
	'ironsource-mediation',
	'react-native-ironsource',
	'react-native-appsflyer',
	'react-native-adjust',
	'react-native-branch',
	'singular-react-native',
	'react-native-tiktok-business-sdk'
]
const TRACKING_REQUEST = /\b(?:requestTrackingPermissionsAsync|useTrackingPermissions)\s*\(/

const IAP_SDKS = [
	'react-native-purchases',
	'react-native-purchases-ui',
	'react-native-iap',
	'expo-iap',
	'expo-in-app-purchases'
]
const PURCHASE_CALL =
	/\b(?:purchasePackage|purchaseStoreProduct|purchaseProduct|purchaseSubscriptionOption|requestPurchase|requestSubscription|purchaseItemAsync|purchase)\s*\(/
const RESTORE_CALL = /\b(?:restorePurchases|restoreTransactions|getAvailablePurchases|restore)\s*\(/
// A navigation whose argument names the document: `router.push('/terms')`,
// `Linking.openURL(PRIVACY_URL)`, `<Link href="/privacy">`.
const NAVIGATION =
	/(?:router\.(?:push|navigate|replace)|Linking\.openURL|openBrowserAsync)\s*\(([^)]{0,200})\)|\bhref\s*=\s*(\{[^}]{0,200}\}|['"][^'"]*['"])/g

// The web route that deletes an account: `/api/delete-account` (builds from before the
// app moved onto /api/app/v1), `/api/app/v1/account`, or that route by its @app/contract
// name, the way the app's API client calls it: `api('deleteAccount')`
// (apps/mobile/lib/api.ts), or a Supabase edge function named delete-account
// (`supabase.functions.invoke('delete-account')`, plays that predate the API).
const DELETE_ACCOUNT_ENDPOINT =
	/\/api\/(?:delete-account|app\/v\d+\/account)(?![\w-])|\bapi\(\s*['"]deleteAccount['"]|\bfunctions\.invoke\(\s*['"]delete-account['"]/
const DELETE_ACCOUNT_LABEL = /\bdelete\s+(?:my\s+|your\s+)?account\b/i

// Apple 4.8: an app that offers a third-party login (Google, Facebook, …)
// offers Sign in with Apple too, and on iOS that means Apple's native sheet,
// not the web OAuth page. What counts as offering a third-party login: a
// Supabase sign-in naming one of these providers, a login SDK, or an
// expo-auth-session provider.
const SUPABASE_SIGN_IN = /\bsignInWith(?:OAuth|IdToken)\s*\(/
const THIRD_PARTY_OAUTH_PROVIDER =
	/['"`](google|facebook|github|twitter|discord|azure|linkedin|linkedin_oidc|gitlab|bitbucket|slack|slack_oidc|spotify|twitch|notion|zoom|kakao|keycloak|figma|workos)['"`]/g
const APPLE_OAUTH_PROVIDER = /['"`]apple['"`]/
const THIRD_PARTY_LOGIN_SDKS = [
	'@react-native-google-signin/google-signin',
	'react-native-fbsdk-next',
	'expo-google-app-auth',
	'expo-facebook'
]
const THIRD_PARTY_LOGIN_IMPORT = /^expo-auth-session\/providers\/(?!apple\b)\w+/
const NATIVE_APPLE_SIGN_IN = [
	{ name: 'expo-apple-authentication', call: /\bsignInAsync\s*\(/ },
	{ name: '@invertase/react-native-apple-authentication', call: /\bperformRequest\s*\(/ }
]

// Apple 2.1: placeholder content in a submitted build. mockData.ts fills the
// screens during development; one loader may read it, and only inside
// `if (__DEV__)`, which Metro folds away so a release bundle never contains it.
const MOCK_DATA_FILE = /(?:^|\/)mockData\.[cm]?[jt]sx?$/
const MOCK_DATA_LOADER = 'lib/devPlaceholders.ts'
const PLACEHOLDER_COPY = /\blorem ipsum\b|\bcoming soon\b/i

// Google Play's Photo and Video Permissions policy: broad media and storage
// access only for apps whose core purpose needs it.
const BROAD_ANDROID_PERMISSIONS = new Set(
	[
		'READ_EXTERNAL_STORAGE',
		'WRITE_EXTERNAL_STORAGE',
		'MANAGE_EXTERNAL_STORAGE',
		'READ_MEDIA_IMAGES',
		'READ_MEDIA_VIDEO',
		'READ_MEDIA_AUDIO',
		'READ_MEDIA_VISUAL_USER_SELECTED'
	].map((name) => `android.permission.${name}`)
)
// `expo prebuild` starts every AndroidManifest.xml from this template, and it
// declares READ_ and WRITE_EXTERNAL_STORAGE: android.permissions only ever
// adds, so removing a permission means blocking it.
const EXPO_MANIFEST_TEMPLATE = 'build/plugins/withAndroidBaseMods.js'

const SERVER_ONLY_PACKAGE = /^(?:pino|pino-.+|prisma|@prisma\/.+)$/
const SERVER_ONLY_IMPORT = /^(?:pino|@prisma\/client)(?:\/|$)/
const SERVER_ONLY_DIRS = ['prisma', 'server/db', 'src/server/db', 'lib/server/db']

const SOURCE_FILE = /\.[cm]?[jt]sx?$/
const NOT_APP_SOURCE =
	/(?:^|\/)(?:__tests__|__mocks__|scripts)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/
// Native projects and build output at a workspace's root are not its source.
const WORKSPACE_ROOT_SKIP = new Set(['ios', 'android', 'dist', 'build', 'coverage', 'web-build'])
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']

function pass(detail = null) {
	return { ok: true, detail }
}

function fail(detail) {
	return { ok: false, detail }
}

function failIfAny(problems) {
	return problems.length > 0 ? fail(problems.join('; ')) : pass()
}

function parseJson(text) {
	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}

function listed(items) {
	const shown = items.slice(0, MAX_LISTED_HITS).join(', ')
	return items.length > MAX_LISTED_HITS
		? `${shown} and ${items.length - MAX_LISTED_HITS} more`
		: shown
}

function firstLine(error) {
	const stderr = typeof error?.stderr === 'string' ? error.stderr.trim().split('\n')[0] : ''
	return stderr || String(error?.message ?? error).split('\n')[0]
}

export function loadWorkspaces(root) {
	const file = join(root, CONFIG_FILE)
	if (!existsSync(file)) return SINGLE_APP
	let parsed
	try {
		parsed = JSON.parse(readFileSync(file, 'utf8'))
	} catch (error) {
		throw new Error(`${CONFIG_FILE} is not valid JSON: ${error.message}`)
	}
	const entries = parsed?.workspaces
	if (!Array.isArray(entries) || entries.length === 0) {
		throw new Error(`${CONFIG_FILE} lists no "workspaces"`)
	}
	const seen = new Set()
	return entries.map((entry, index) => {
		const where = `${CONFIG_FILE} workspaces[${index}]`
		if (!WORKSPACE_KINDS.includes(entry?.kind)) {
			throw new Error(
				`${where} has kind ${JSON.stringify(entry?.kind)}; expected one of: ${WORKSPACE_KINDS.join(', ')}`
			)
		}
		if (typeof entry.path !== 'string' || entry.path.trim() === '') {
			throw new Error(`${where} has no "path"`)
		}
		const path =
			entry.path
				.trim()
				.replace(/^\.\/+/, '')
				.replace(/\/+$/, '') || '.'
		if (path.startsWith('/') || path.split('/').includes('..')) {
			throw new Error(`${where} path "${entry.path}" must be inside the repo`)
		}
		if (!existsSync(join(root, path, 'package.json'))) {
			throw new Error(`${where} path "${path}" has no package.json`)
		}
		if (seen.has(path)) throw new Error(`${where} lists "${path}" twice`)
		seen.add(path)
		return { path, kind: entry.kind }
	})
}

function createWorkspace(read, { path, kind }) {
	const rel = (file) => (path === '.' ? file : `${path}/${file}`)
	const rawPackage = read(rel('package.json'))
	return {
		path,
		kind,
		rel,
		packageJson: rawPackage == null ? null : parseJson(rawPackage)
	}
}

function createContext(rootArg) {
	const root = resolve(rootArg)
	const has = (path) => existsSync(join(root, path))
	const read = (path) => (has(path) ? readFileSync(join(root, path), 'utf8') : null)
	const git = (...args) =>
		spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
	const isGitRepo = git('rev-parse', '--is-inside-work-tree').status === 0
	const trackedFiles = isGitRepo ? git('ls-files', '-z').stdout.split('\0').filter(Boolean) : []

	let packageJson = null
	const rawPackage = read('package.json')
	if (rawPackage != null) packageJson = parseJson(rawPackage)

	const workspaces = loadWorkspaces(root).map((spec) => createWorkspace(read, spec))

	return {
		root,
		has,
		read,
		git,
		isGitRepo,
		trackedFiles,
		packageJson,
		workspaces,
		exceptions: loadExceptions(root),
		memo: new Map()
	}
}

function memoised(ctx, key, compute) {
	if (!ctx.memo.has(key)) ctx.memo.set(key, compute())
	return ctx.memo.get(key)
}

function scriptsInvokedIn(text) {
	return new Set(scriptsInvokedInOrder(text))
}

function scriptsInvokedInOrder(text) {
	// YAML and Markdown both comment with `#`; a comment that mentions
	// `pnpm lint` is not a gate.
	const withoutComments = text.replace(/^\s*#.*$/gm, '').replace(/\s#.*$/gm, '')
	return [...withoutComments.matchAll(SCRIPT_INVOCATION)].map((match) => match[1])
}

function workflowJob(workflow, id) {
	// The lines of one job under `jobs:`: from its key to the next line indented no
	// deeper than the key (the next job, or a comment introducing it). Job keys sit
	// at the indent of the first line under `jobs:`, so a nested key of the same name
	// is not the job. Enough YAML for a workflow this repo writes; no such job is null.
	const lines = workflow.split('\n')
	const indentOf = (line) => line.length - line.trimStart().length
	const isContent = (line) => line.trim() !== '' && !line.trimStart().startsWith('#')
	const jobsAt = lines.findIndex((line) => /^jobs:\s*(#.*)?$/.test(line))
	if (jobsAt === -1) return null
	const firstJob = lines.slice(jobsAt + 1).find(isContent)
	if (firstJob == null) return null
	const jobIndent = indentOf(firstJob)
	const start = lines.findIndex(
		(line, i) =>
			i > jobsAt && indentOf(line) === jobIndent && new RegExp(`^\\s*${id}:\\s*(#.*)?$`).test(line)
	)
	if (start === -1) return null
	const end = lines.findIndex(
		(line, i) => i > start && line.trim() !== '' && indentOf(line) <= jobIndent
	)
	return lines.slice(start + 1, end === -1 ? lines.length : end).join('\n')
}

function uniqueInOrder(values) {
	return [...new Set(values)]
}

function fencedCodeIn(markdown) {
	// Only the ``` blocks: a skill that *mentions* `pnpm check:env` in prose
	// is not a skill that runs it.
	return [...markdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]).join('\n')
}

function ruleLinksIn(agentsText) {
	// Matches `docs/rules/<file>.md` wherever it appears — a Markdown link
	// target or backticked prose both count as "AGENTS.md points at it".
	return new Set(
		[...agentsText.matchAll(/docs\/rules\/([a-z0-9-]+\.md)/g)].map((match) => match[1])
	)
}

function ruleFilesIn(ctx) {
	if (!ctx.has(RULES_DIR)) return []
	return readdirSync(join(ctx.root, RULES_DIR))
		.filter((name) => name.endsWith('.md'))
		.sort()
}

function isExecutable(ctx, path) {
	// Windows file systems carry no execute bit (Node reports one only for .exe-like
	// names), so there the index mode is the only real answer.
	if (process.platform === 'win32') return indexMode(ctx, path) === '100755'
	const EXECUTE_BITS = 0o111
	return (statSync(join(ctx.root, path)).mode & EXECUTE_BITS) !== 0
}

function indexMode(ctx, path) {
	// `git ls-files -s` prints "<mode> <object> <stage>\t<path>". The index
	// mode is what a fresh clone gets; a hook that is +x on one laptop and
	// 100644 in git is a hook nobody else has.
	const out = ctx.git('ls-files', '-s', '--', path).stdout.trim()
	return out.split(' ')[0] || null
}

function isIgnored(ctx, path) {
	return ctx.git('check-ignore', '-q', '--', path).status === 0
}

function runBinary(ctx, name, args) {
	// Windows installs a .cmd shim, and Node refuses to spawn one without a shell.
	const windows = process.platform === 'win32'
	const bin = join(ctx.root, 'node_modules', '.bin', windows ? `${name}.cmd` : name)
	if (!existsSync(bin)) {
		return {
			error: `${name} is not installed under node_modules — run the package manager's install first`
		}
	}
	try {
		return {
			stdout: execFileSync(bin, args, {
				shell: windows,
				cwd: ctx.root,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe']
			})
		}
	} catch (error) {
		return { error: `${name} ${args.join(' ')} failed: ${firstLine(error)}` }
	}
}

function severityOf(setting) {
	const level = Array.isArray(setting) ? setting[0] : setting
	if (level === 2 || level === 'error') return 'error'
	if (level === 1 || level === 'warn') return 'warn'
	return 'off'
}

// ESLint is asked once per run, in one child process, for everything any check
// needs: the config in effect for each workspace's probe file and for every
// mobile source file, and whether a Supabase import is banned where it must be.
// Flat config resolves a rule by last match wins, so a rule can be written
// down and still be off — only the resolved config says what is enforced.
const ESLINT_SNAPSHOT_SCRIPT = [
	"import { createRequire } from 'node:module'",
	"import { join } from 'node:path'",
	"import { pathToFileURL } from 'node:url'",
	'const chunks = []',
	'for await (const chunk of process.stdin) chunks.push(chunk)',
	"const { root, configs, lint, rules } = JSON.parse(Buffer.concat(chunks).toString('utf8'))",
	'const say = (value) => process.stdout.write(JSON.stringify(value))',
	'let entry = null',
	"try { entry = createRequire(join(root, 'package.json')).resolve('eslint') } catch {}",
	'if (entry == null) {',
	"  say({ error: 'eslint is not installed under node_modules — run the package manager install first' })",
	'} else {',
	'  try {',
	'    const { ESLint } = await import(pathToFileURL(entry).href)',
	'    const eslint = new ESLint({ cwd: root })',
	'    const out = { configs: {}, lint: {} }',
	'    for (const file of configs) {',
	'      const config = await eslint.calculateConfigForFile(join(root, file))',
	'      const all = config?.rules ?? {}',
	'      out.configs[file] = config',
	'        ? Object.fromEntries(rules.filter((rule) => rule in all).map((rule) => [rule, all[rule]]))',
	'        : null',
	'    }',
	'    for (const probe of lint) {',
	'      const [result] = await eslint.lintText(probe.text, { filePath: join(root, probe.file) })',
	'      out.lint[probe.key] = (result?.messages ?? []).map((message) => message.ruleId)',
	'    }',
	'    say(out)',
	'  } catch (error) {',
	"    say({ error: 'eslint could not resolve the config in effect: ' + String(error?.message ?? error).split('\\n')[0] })",
	'  }',
	'}'
].join('\n')

const SUPABASE_IMPORT_PROBE =
	"import { createClient } from '@supabase/supabase-js'\nexport const probe = createClient\n"

function supabaseImportProbes(ctx, ws) {
	// One probe file per top-level source directory the app actually has
	// (app/, components/, hooks/, lib/, ...), plus the one file allowed the
	// import.
	const prefix = ws.path === '.' ? '' : `${ws.path}/`
	const dirs = [
		...new Set(sourceFiles(ctx, ws).map((file) => file.slice(prefix.length).split('/')[0]))
	]
	return dirs.map((dir) => ws.rel(`${dir}/__standards_probe__.tsx`))
}

function eslintSnapshot(ctx) {
	return memoised(ctx, 'eslint', () => {
		const configs = new Set()
		const lint = []
		for (const ws of ctx.workspaces) {
			configs.add(ws.rel(ESLINT_PROBE[ws.kind]))
			if (ws.kind !== 'expo') continue
			for (const file of sourceFiles(ctx, ws)) configs.add(file)
			for (const file of [...supabaseImportProbes(ctx, ws), ws.rel(MOBILE_SUPABASE_CLIENT)]) {
				lint.push({ key: `supabase:${file}`, file, text: SUPABASE_IMPORT_PROBE })
			}
		}
		const result = spawnSync(
			process.execPath,
			['--input-type=module', '--eval', ESLINT_SNAPSHOT_SCRIPT],
			{
				cwd: ctx.root,
				input: JSON.stringify({ root: ctx.root, configs: [...configs], lint, rules: ESLINT_RULES }),
				encoding: 'utf8',
				maxBuffer: 64 * 1024 * 1024
			}
		)
		if (result.error) return { error: `eslint could not run: ${result.error.message}` }
		const out = parseJson(result.stdout)
		if (out == null) {
			const reason = (result.stderr ?? '').trim().split('\n')[0] || `exit ${result.status}`
			return { error: `eslint printed no result: ${reason}` }
		}
		return out
	})
}

function effectiveEslintRules(ctx, file) {
	// The *resolved* config for an ordinary source file, not the config file.
	const snapshot = eslintSnapshot(ctx)
	if (snapshot.error) return { error: snapshot.error }
	const rules = snapshot.configs?.[file]
	if (rules == null) {
		return { error: `ESLint applies no config to ${file} — it is ignored or no block matches it` }
	}
	return { rules }
}

function restrictedImportGroups(rules) {
	// Every pattern the effective no-restricted-imports rule bans, flattened.
	// Null when the rule is not an error at all.
	const entry = rules['no-restricted-imports']
	if (!Array.isArray(entry) || severityOf(entry) !== 'error') return null
	const groups = []
	for (const option of entry.slice(1)) {
		for (const pattern of option?.patterns ?? []) {
			if (typeof pattern === 'string') groups.push(pattern)
			else groups.push(...(pattern.group ?? []))
		}
	}
	return groups
}

function requireGit(ctx) {
	return ctx.isGitRepo
		? null
		: fail(`${ctx.root} is not a git repository, so tracked-file checks cannot run`)
}

function rootScriptReaches(script, ws) {
	// `npm run check:env --workspaces`, or one naming this workspace by package
	// name or path (`--workspace=@app/web`, `-w apps/web`).
	if (/(?:^|\s)(?:--workspaces|-ws)\b/.test(script)) return true
	const targets = [...script.matchAll(/(?:--workspace(?:=|\s+)|(?:^|\s)-w\s+)(\S+)/g)].map(
		(match) => match[1].replace(/^['"]|['"]$/g, '').replace(/^\.\//, '')
	)
	return targets.some((target) => target === ws.packageJson?.name || target === ws.path)
}

function envCheckProblems(ctx, ws) {
	// `check:env` at the root is the gate. In a monorepo a workspace either owns
	// its check (its package.json runs its own scripts/check-env-vars.mjs, and
	// the root script reaches the workspace), or one root script covers every
	// workspace (it names this one, or reads standards.config.json).
	const rootScript = ctx.packageJson?.scripts?.['check:env']
	const own = ws.path === '.' ? undefined : ws.packageJson?.scripts?.['check:env']
	if (typeof own === 'string') {
		const problems = []
		if (!own.includes(ENV_CHECK_SCRIPT)) {
			problems.push(`${ws.rel('package.json')} "check:env" does not run ${ENV_CHECK_SCRIPT}`)
		} else if (!ctx.has(ws.rel(ENV_CHECK_SCRIPT))) {
			problems.push(`${ws.rel(ENV_CHECK_SCRIPT)} is missing`)
		}
		if (typeof rootScript !== 'string' || !rootScriptReaches(rootScript, ws)) {
			problems.push(
				`the root "check:env" never runs ${ws.path}'s (use --workspaces, or --workspace=${ws.packageJson?.name ?? ws.path})`
			)
		}
		return problems
	}
	if (ws.path !== '.' && typeof rootScript === 'string' && rootScriptReaches(rootScript, ws)) {
		return [
			`${ws.rel('package.json')} has no "check:env" script, and the root one only runs each workspace's`
		]
	}
	const problems = []
	if (!ctx.has(ENV_CHECK_SCRIPT)) problems.push(`${ENV_CHECK_SCRIPT} is missing`)
	if (typeof rootScript !== 'string' || !rootScript.includes(ENV_CHECK_SCRIPT)) {
		problems.push(`the "check:env" script does not run ${ENV_CHECK_SCRIPT}`)
	} else if (ws.path !== '.') {
		const source = ctx.read(ENV_CHECK_SCRIPT) ?? ''
		if (!source.includes(ws.path) && !source.includes(CONFIG_FILE)) {
			problems.push(
				`${ENV_CHECK_SCRIPT} never looks at ${ws.path}/ (name it, or read the workspaces from ${CONFIG_FILE})`
			)
		}
	}
	return problems
}

// ── Workspace files ──────────────────────────────────────────────────────────

function workspaceFiles(ctx, ws) {
	// Every file in the workspace: no node_modules, no dot-directories, and
	// no native project or build output at its root.
	return memoised(ctx, `files:${ws.path}`, () => {
		const files = []
		const walk = (dir) => {
			let entries
			try {
				entries = readdirSync(join(ctx.root, dir), { withFileTypes: true })
			} catch {
				return
			}
			for (const entry of entries) {
				if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
				if (dir === ws.path && WORKSPACE_ROOT_SKIP.has(entry.name)) continue
				const path = dir === '.' ? entry.name : `${dir}/${entry.name}`
				if (entry.isDirectory()) walk(path)
				else if (entry.isFile()) files.push(path)
			}
		}
		walk(ws.path)
		return files.sort()
	})
}

function sourceFiles(ctx, ws) {
	// What ends up in the app: code in the workspace's directories, not its
	// root-level tooling config (metro, babel, jest), tests or declarations.
	const prefix = ws.path === '.' ? '' : `${ws.path}/`
	return workspaceFiles(ctx, ws).filter((file) => {
		const inner = file.slice(prefix.length)
		return inner.includes('/') && SOURCE_FILE.test(inner) && !NOT_APP_SOURCE.test(inner)
	})
}

function stripComments(source) {
	// Good enough to stop a comment that *mentions* a call from counting as
	// one. `://` is spared so a URL in a string survives.
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')
}

// The "Delete account" label in the screen's code, or behind a t('<namespace>.<key>') whose
// English copy (<workspace>/locales/en/<namespace>.json, i18next's one-file-per-namespace
// layout) says it: a localized app keys the button 'settings.delete.action', not by the words.
const englishCopy = new Map()
function showsDeleteAccountLabel(ctx, ws, screen) {
	const code = codeOf(ctx, screen)
	if (DELETE_ACCOUNT_LABEL.test(code)) return true
	for (const [, key] of code.matchAll(/\bt\(\s*['"`]([\w-]+(?:\.[\w-]+)+)['"`]/g)) {
		const [namespace, ...path] = key.split('.')
		const file = join(ctx.root, ws.path, 'locales', 'en', `${namespace}.json`)
		if (!englishCopy.has(file)) {
			let parsed = null
			try {
				parsed = JSON.parse(readFileSync(file, 'utf8'))
			} catch {
				// no such namespace file: the key cannot be resolved here
			}
			englishCopy.set(file, parsed)
		}
		const value = path.reduce(
			(node, part) => (node == null ? node : node[part]),
			englishCopy.get(file)
		)
		if (typeof value === 'string' && DELETE_ACCOUNT_LABEL.test(value)) return true
	}
	return false
}

function codeOf(ctx, file) {
	return memoised(ctx, `code:${file}`, () => stripComments(ctx.read(file) ?? ''))
}

function parseJsonc(text) {
	if (text == null) return null
	return parseJson(
		text
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/^\s*\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1')
	)
}

const IMPORT_SPECIFIER =
	/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g

function importSpecifiers(code) {
	return [...code.matchAll(IMPORT_SPECIFIER)].map(
		(match) => match[1] ?? match[2] ?? match[3] ?? match[4]
	)
}

function pathAliases(ctx, ws) {
	// tsconfig `paths` of the `"@/*": ["./*"]` shape, which is what Expo and
	// Next both generate.
	return memoised(ctx, `aliases:${ws.path}`, () => {
		const paths = parseJsonc(ctx.read(ws.rel('tsconfig.json')))?.compilerOptions?.paths ?? {}
		const aliases = []
		for (const [pattern, targets] of Object.entries(paths)) {
			const target = Array.isArray(targets) ? targets[0] : null
			if (!pattern.endsWith('*') || typeof target !== 'string' || !target.endsWith('*')) continue
			aliases.push({
				prefix: pattern.slice(0, -1),
				target: target.slice(0, -1).replace(/^\.\//, '')
			})
		}
		return aliases
	})
}

function resolveLocalImport(ctx, ws, fromFile, specifier) {
	let base = null
	if (specifier.startsWith('./') || specifier.startsWith('../')) {
		base = posix.normalize(posix.join(posix.dirname(fromFile), specifier))
	} else {
		const alias = pathAliases(ctx, ws).find((candidate) => specifier.startsWith(candidate.prefix))
		if (alias) base = posix.normalize(ws.rel(alias.target + specifier.slice(alias.prefix.length)))
	}
	if (base == null) return null
	for (const suffix of RESOLVE_SUFFIXES) {
		const candidate = base + suffix
		if (ctx.has(candidate) && statSync(join(ctx.root, candidate)).isFile()) return candidate
	}
	return null
}

function reachesAny(ctx, ws, start, targets, maxDepth = 4) {
	// Follows the app's own imports from `start`: a screen that calls a hook
	// that calls the module that deletes the account still deletes it.
	const seen = new Set([start])
	let frontier = [start]
	for (let depth = 0; depth <= maxDepth && frontier.length > 0; depth += 1) {
		if (frontier.some((file) => targets.includes(file))) return true
		const next = []
		for (const file of frontier) {
			for (const specifier of importSpecifiers(codeOf(ctx, file))) {
				const resolved = resolveLocalImport(ctx, ws, file, specifier)
				if (resolved != null && !seen.has(resolved)) {
					seen.add(resolved)
					next.push(resolved)
				}
			}
		}
		frontier = next
	}
	return false
}

function screensOf(ctx, ws) {
	return sourceFiles(ctx, ws).filter((file) => file.startsWith(ws.rel('app/')))
}

function routeOf(ws, screen) {
	// expo-router: app/settings.tsx is /settings, app/(tabs)/profile.tsx is
	// /profile, app/detail/[id].tsx is /detail/[id].
	const inner = screen.slice(ws.rel('app/').length).replace(/\.[cm]?[jt]sx?$/, '')
	const segments = inner.split('/').filter((segment) => !/^\(.*\)$/.test(segment))
	if (segments.at(-1) === 'index') segments.pop()
	return `/${segments.join('/')}`
}

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isReachable(ctx, ws, screen) {
	// A tab is on screen; anything else is reachable when some other file
	// navigates to its route.
	if (screen.slice(ws.rel('app/').length).split('/').includes('(tabs)')) return true
	const route = routeOf(ws, screen)
	if (route === '/') return true
	const fixed = route.split('/[')[0]
	const link = new RegExp(
		`['"\`]${escapeRegExp(fixed)}${fixed === route ? '(?:[\'"`?#]|$)' : '/'}`,
		'm'
	)
	return sourceFiles(ctx, ws).some((file) => file !== screen && link.test(codeOf(ctx, file)))
}

// ── Expo app config and installed dependencies ───────────────────────────────

function expoConfig(ctx, ws) {
	// app.json as written; a dynamic app.config.* is resolved by `expo config`.
	return memoised(ctx, `expo-config:${ws.path}`, () => {
		const dynamic = EXPO_DYNAMIC_CONFIGS.find((file) => ctx.has(ws.rel(file)))
		if (dynamic) {
			const bin = [
				join(ctx.root, ws.path, 'node_modules', '.bin', 'expo'),
				join(ctx.root, 'node_modules', '.bin', 'expo')
			].find((candidate) => existsSync(candidate))
			if (!bin) {
				return {
					error: `${ws.rel(dynamic)} needs \`expo config\` to resolve, and expo is not installed`
				}
			}
			try {
				const stdout = execFileSync(bin, ['config', '--json', '--type', 'public'], {
					cwd: join(ctx.root, ws.path),
					encoding: 'utf8',
					stdio: ['ignore', 'pipe', 'pipe']
				})
				return { config: JSON.parse(stdout), source: ws.rel(dynamic) }
			} catch (error) {
				return { error: `expo config could not resolve ${ws.rel(dynamic)}: ${firstLine(error)}` }
			}
		}
		const file = ws.rel('app.json')
		const raw = ctx.read(file)
		if (raw == null) return { error: `${file} is missing` }
		const parsed = parseJson(raw)
		if (parsed == null || typeof parsed !== 'object') return { error: `${file} is not valid JSON` }
		return { config: parsed.expo ?? parsed, source: file }
	})
}

function expoApp(ctx, ws) {
	// The two things every mobile check reads, asserted to be there: the
	// workspace's dependencies (with expo among them, or this is not the app)
	// and its app config.
	const pkg = ws.packageJson
	if (pkg == null) return { error: `${ws.rel('package.json')} is missing or unparseable` }
	const deps = pkg.dependencies ?? {}
	if (!deps.expo) {
		return {
			error: `expo is not a dependency of ${ws.rel('package.json')} — is ${ws.path} an Expo app?`
		}
	}
	const { config, source, error } = expoConfig(ctx, ws)
	if (error) return { error }
	return { deps, config, source }
}

function resolvePackageDir(ctx, fromDir, name) {
	// Node's lookup, bounded by the repo: <dir>/node_modules/<name>, walking up.
	let dir = fromDir
	for (;;) {
		const candidate = join(dir, 'node_modules', name)
		if (existsSync(join(candidate, 'package.json'))) return candidate
		const parent = dirname(dir)
		if (dir === ctx.root || parent === dir || !parent.startsWith(ctx.root)) return null
		dir = parent
	}
}

function isNativePackage(dir) {
	try {
		return (
			existsSync(join(dir, 'ios')) ||
			existsSync(join(dir, 'android')) ||
			readdirSync(dir).some((file) => file.endsWith('.podspec'))
		)
	} catch {
		return false
	}
}

function nativeDependencies(ctx, ws) {
	// Every installed package with native code the app links, direct or
	// transitive (expo pulls in expo-file-system, react-native pulls in
	// boost): those are what ship privacy manifests and Android permissions.
	return memoised(ctx, `native:${ws.path}`, () => {
		const wsDir = join(ctx.root, ws.path)
		if (resolvePackageDir(ctx, wsDir, 'expo') == null) {
			return {
				error: `expo is not installed under node_modules, so what ${ws.path}'s dependencies ship cannot be read — run the package manager's install first`
			}
		}
		const seen = new Set()
		const packages = []
		const queue = Object.keys(ws.packageJson?.dependencies ?? {}).map((name) => [name, wsDir])
		while (queue.length > 0) {
			const [name, from] = queue.shift()
			const dir = resolvePackageDir(ctx, from, name)
			if (dir == null || seen.has(dir)) continue
			seen.add(dir)
			const pkg = parseJson(readFileSync(join(dir, 'package.json'), 'utf8'))
			for (const child of Object.keys(pkg?.dependencies ?? {})) queue.push([child, dir])
			if (isNativePackage(dir)) packages.push({ name, dir })
		}
		return { packages }
	})
}

function privacyManifestsIn(dir) {
	const found = []
	const walk = (current, depth) => {
		if (depth > 8) return
		let entries
		try {
			entries = readdirSync(current, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'android') {
				continue
			}
			const path = join(current, entry.name)
			if (entry.isDirectory()) walk(path, depth + 1)
			else if (entry.name === 'PrivacyInfo.xcprivacy') found.push(path)
		}
	}
	walk(dir, 0)
	return found
}

function usesPermissions(xml) {
	// <uses-permission android:name="..."/>, minus the ones a manifest removes.
	const names = []
	for (const match of xml.matchAll(/<uses-permission(?:-sdk-23)?\b([^>]*)>/g)) {
		if (/tools:node\s*=\s*["']remove["']/.test(match[1])) continue
		const name = match[1].match(/android:name\s*=\s*["']([^"']+)["']/)
		if (name) names.push(name[1])
	}
	return names
}

function androidPermissionName(name) {
	return name.includes('.') ? name : `android.permission.${name}`
}

function pluginOptions(config, name) {
	// undefined: the plugin is not listed. {}: listed without options.
	for (const entry of config.plugins ?? []) {
		if (entry === name) return {}
		if (Array.isArray(entry) && entry[0] === name) return entry[1] ?? {}
	}
	return undefined
}

function purposeString(config, plugin, option, key) {
	// Expo's order: an option of false removes the key, a string option sets
	// it, otherwise ios.infoPlist stands, otherwise Expo writes its generic
	// default.
	const fromPlugin = pluginOptions(config, plugin)?.[option]
	if (fromPlugin === false) return { ok: true, optedOut: true }
	const value = typeof fromPlugin === 'string' ? fromPlugin : config.ios?.infoPlist?.[key]
	if (typeof value !== 'string' || value.trim() === '') {
		return {
			ok: false,
			why: `is not set (the "${plugin}" plugin's ${option}, or ios.infoPlist.${key}), so Expo writes its generic default`
		}
	}
	if (GENERIC_PURPOSE_STRING.test(value.trim())) {
		return { ok: false, why: `is the generic "${value}" — say what this app does with it` }
	}
	return { ok: true }
}

function sensitiveWordsIn(code) {
	const list = code.match(/SENSITIVE_WORDS\s*=\s*new\s+Set\s*\(\s*\[([^\]]*)\]/)
	if (list == null) return null
	return [...list[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]).sort()
}

function loggerFiles(ctx, ws) {
	const entry = MOBILE_LOGGER_ENTRIES.map((file) => ws.rel(file)).find((file) => ctx.has(file))
	if (entry == null) return { entry: null, files: [] }
	if (!entry.endsWith('/index.ts')) return { entry, files: [entry] }
	const dir = entry.slice(0, -'index.ts'.length)
	return { entry, files: sourceFiles(ctx, ws).filter((file) => file.startsWith(dir)) }
}

// ── Checks ───────────────────────────────────────────────────────────────────
//
// `scope: 'repo'` runs once at the root: run(ctx). `scope: 'workspace'` runs
// in every configured workspace whose kind is in `kinds`: run(ctx, ws).

export const CHECKS = [
	{
		id: 'agents-md',
		scope: 'repo',
		title: 'AGENTS.md exists and indexes the engineering rules',
		run(ctx) {
			const text = ctx.read(AGENTS_FILE)
			if (text == null)
				return fail(`${AGENTS_FILE} is missing — it is the file every coding agent reads`)
			if (!/^##\s+Engineering rules\s*$/m.test(text)) {
				return fail(`${AGENTS_FILE} has no "## Engineering rules" section`)
			}
			return pass()
		}
	},
	{
		id: 'agents-md-links-resolve',
		scope: 'repo',
		title: 'every rule AGENTS.md links to exists',
		run(ctx) {
			const text = ctx.read(AGENTS_FILE)
			if (text == null) return fail(`${AGENTS_FILE} is missing`)
			const links = ruleLinksIn(text)
			if (links.size === 0) {
				return fail(
					`${AGENTS_FILE} links to nothing under ${RULES_DIR}/ — the rules index is empty`
				)
			}
			const dangling = [...links].filter((name) => !ctx.has(join(RULES_DIR, name)))
			if (dangling.length > 0) {
				return fail(`${AGENTS_FILE} links to rules that do not exist: ${dangling.join(', ')}`)
			}
			return pass()
		}
	},
	{
		id: 'rules-all-linked',
		scope: 'repo',
		title: 'every file in docs/rules/ is linked from AGENTS.md',
		run(ctx) {
			const files = ruleFilesIn(ctx)
			if (files.length === 0) return fail(`${RULES_DIR}/ has no rule files`)
			const text = ctx.read(AGENTS_FILE)
			if (text == null) return fail(`${AGENTS_FILE} is missing`)
			const links = ruleLinksIn(text)
			const orphans = files.filter((name) => !links.has(name))
			if (orphans.length > 0) {
				return fail(
					`rules nobody is pointed at: ${orphans.join(', ')} — link each from ${AGENTS_FILE} or delete it`
				)
			}
			return pass()
		}
	},
	{
		id: 'rules-core-set',
		scope: 'repo',
		title: 'the stack-agnostic core rules are present',
		run(ctx) {
			const missing = CORE_RULES.filter((name) => !ctx.has(join(RULES_DIR, name)))
			if (missing.length > 0) return fail(`missing from ${RULES_DIR}/: ${missing.join(', ')}`)
			return pass()
		}
	},
	{
		id: 'per-tool-entry-points',
		scope: 'repo',
		title: 'per-tool instruction files import AGENTS.md instead of restating it',
		run(ctx) {
			const problems = []
			const required = ctx.read(REQUIRED_ENTRY_POINT)
			if (required == null) problems.push(`${REQUIRED_ENTRY_POINT} is missing`)
			else if (!AGENTS_IMPORT_LINE.test(required)) {
				problems.push(`${REQUIRED_ENTRY_POINT} does not contain an "@AGENTS.md" line`)
			}
			for (const path of OPTIONAL_ENTRY_POINTS) {
				const text = ctx.read(path)
				if (text != null && !AGENTS_IMPORT_LINE.test(text)) {
					problems.push(`${path} exists but does not contain an "@AGENTS.md" line`)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'readme',
		scope: 'repo',
		title: 'README.md exists',
		run(ctx) {
			return ctx.has(README_FILE) ? pass() : fail(`${README_FILE} is missing`)
		}
	},
	{
		id: 'commit-msg-hook',
		scope: 'repo',
		title: 'the commit-msg hook exists, is executable, and runs the shared check',
		run(ctx) {
			if (!ctx.has(HOOK)) return fail(`${HOOK} is missing`)
			if (!isExecutable(ctx, HOOK)) return fail(`${HOOK} is not executable (chmod +x)`)
			if (ctx.isGitRepo) {
				const mode = indexMode(ctx, HOOK)
				if (mode != null && mode !== '100755') {
					return fail(
						`${HOOK} is ${mode} in the git index, so a fresh clone gets a non-executable hook — ` +
							`run: git update-index --chmod=+x ${HOOK}`
					)
				}
			}
			if (!ctx.read(HOOK).includes(COMMIT_MESSAGE_SCRIPT)) {
				return fail(`${HOOK} does not call ${COMMIT_MESSAGE_SCRIPT}`)
			}
			if (!ctx.has(COMMIT_MESSAGE_SCRIPT)) return fail(`${COMMIT_MESSAGE_SCRIPT} is missing`)
			return pass()
		}
	},
	{
		id: 'hooks-path-installed',
		scope: 'repo',
		title: 'the package install points git at .githooks',
		run(ctx) {
			const prepare = ctx.packageJson?.scripts?.prepare
			if (typeof prepare !== 'string' || !prepare.includes(HOOKS_PATH_SETTING)) {
				return fail(`package.json "prepare" script must run "git config ${HOOKS_PATH_SETTING}"`)
			}
			return pass()
		}
	},
	{
		id: 'ci-commits-job',
		scope: 'repo',
		title: 'CI re-runs the commit message check over every PR commit',
		run(ctx) {
			const text = ctx.read(CI_WORKFLOW)
			if (text == null) return fail(`${CI_WORKFLOW} is missing`)
			if (!text.includes(COMMIT_MESSAGE_SCRIPT) || !text.includes('--range')) {
				return fail(`${CI_WORKFLOW} never runs "${COMMIT_MESSAGE_SCRIPT} --range"`)
			}
			return pass()
		}
	},
	{
		id: 'secrets-scan',
		scope: 'repo',
		title: 'a secret scanner guards commits at the pre-commit hook and again in CI',
		run(ctx) {
			const problems = []
			if (!ctx.has(SECRETS_SCRIPT)) problems.push(`${SECRETS_SCRIPT} is missing`)
			// Same three properties as the commit-msg hook: present, executable on
			// disk, and 100755 in the index so a fresh clone gets a working hook.
			if (!ctx.has(PRE_COMMIT_HOOK)) {
				problems.push(`${PRE_COMMIT_HOOK} is missing`)
			} else {
				if (!isExecutable(ctx, PRE_COMMIT_HOOK)) {
					problems.push(`${PRE_COMMIT_HOOK} is not executable (chmod +x)`)
				}
				if (ctx.isGitRepo) {
					const mode = indexMode(ctx, PRE_COMMIT_HOOK)
					if (mode != null && mode !== '100755') {
						problems.push(
							`${PRE_COMMIT_HOOK} is ${mode} in the git index, so a fresh clone gets a ` +
								`non-executable hook — run: git update-index --chmod=+x ${PRE_COMMIT_HOOK}`
						)
					}
				}
				if (!(ctx.read(PRE_COMMIT_HOOK) ?? '').includes(SECRETS_SCRIPT)) {
					problems.push(`${PRE_COMMIT_HOOK} does not call ${SECRETS_SCRIPT}`)
				}
			}
			const script = ctx.packageJson?.scripts?.['check:secrets']
			if (typeof script !== 'string' || !script.includes(SECRETS_SCRIPT)) {
				problems.push(`the "check:secrets" script does not run ${SECRETS_SCRIPT}`)
			}
			// CI is the enforcement point a local `--no-verify` cannot skip.
			const workflow = ctx.read(CI_WORKFLOW)
			if (workflow == null) problems.push(`${CI_WORKFLOW} is missing`)
			else if (!scriptsInvokedIn(workflow).has('check:secrets')) {
				problems.push(`${CI_WORKFLOW} never runs check:secrets`)
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'package-scripts',
		scope: 'repo',
		title: 'package.json defines every gate script',
		run(ctx) {
			const scripts = ctx.packageJson?.scripts
			if (scripts == null || Object.keys(scripts).length === 0) {
				return fail('package.json has no "scripts" — or is missing or unparseable')
			}
			const missing = REQUIRED_SCRIPTS.filter((name) => typeof scripts[name] !== 'string')
			if (missing.length > 0) return fail(`package.json scripts missing: ${missing.join(', ')}`)
			if (
				!scripts.lint.includes('--max-warnings=0') &&
				!scripts.lint.includes('--max-warnings 0')
			) {
				return fail('the "lint" script must pass --max-warnings=0 so a warning fails the gate')
			}
			return pass()
		}
	},
	{
		id: 'ci-gates-every-pr',
		scope: 'repo',
		title: 'CI runs every gate on every pull request',
		run(ctx) {
			const text = ctx.read(CI_WORKFLOW)
			if (text == null) return fail(`${CI_WORKFLOW} is missing — nothing gates a branch`)
			const hasPullRequestTrigger =
				/^\s*pull_request\s*:/m.test(text) ||
				/^\s*on\s*:\s*pull_request\b/m.test(text) ||
				/^\s*on\s*:\s*\[[^\]]*\bpull_request\b/m.test(text)
			if (!hasPullRequestTrigger) return fail(`${CI_WORKFLOW} does not trigger on pull_request`)
			const invoked = scriptsInvokedIn(text)
			if (invoked.size === 0) {
				return fail(`${CI_WORKFLOW} invokes no package.json script at all`)
			}
			const missing = CI_GATES.filter((gate) => !invoked.has(gate))
			if (missing.length > 0) return fail(`${CI_WORKFLOW} never runs: ${missing.join(', ')}`)
			return pass()
		}
	},
	{
		id: 'local-review-mirrors-ci',
		scope: 'repo',
		title: `the local-review skill runs the gates of CI's ${CI_GATE_JOB} job, in the same order`,
		run(ctx) {
			// Both lists come from the files: the package.json scripts ci.yml's gate job runs,
			// in step order, and the scripts the skill's command blocks run, in order.
			const workflow = ctx.read(CI_WORKFLOW)
			if (workflow == null) return fail(`${CI_WORKFLOW} is missing`)
			const job = workflowJob(workflow, CI_GATE_JOB)
			if (job == null) return fail(`${CI_WORKFLOW} has no "${CI_GATE_JOB}" job to mirror`)
			const scripts = ctx.packageJson?.scripts ?? {}
			const isScript = (name) => typeof scripts[name] === 'string'
			// `npm ci` names no script, and is setup rather than a gate.
			const ciGates = uniqueInOrder(scriptsInvokedInOrder(job).filter(isScript))
			if (ciGates.length === 0) {
				return fail(`${CI_WORKFLOW}'s "${CI_GATE_JOB}" job runs no package.json script`)
			}

			const text = ctx.read(LOCAL_REVIEW_SKILL)
			if (text == null) return fail(`${LOCAL_REVIEW_SKILL} is missing`)
			const commands = fencedCodeIn(text)
			if (commands.trim() === '') {
				return fail(`${LOCAL_REVIEW_SKILL} has no fenced command block, so it runs nothing`)
			}
			const local = uniqueInOrder(scriptsInvokedInOrder(commands))

			const missing = ciGates.filter((gate) => !local.includes(gate))
			if (missing.length > 0) {
				return fail(
					`${LOCAL_REVIEW_SKILL} does not run: ${missing.join(', ')} — CI would be the first to`
				)
			}
			const localOrder = local.filter((gate) => ciGates.includes(gate))
			if (localOrder.join(' ') !== ciGates.join(' ')) {
				return fail(
					`${LOCAL_REVIEW_SKILL} runs CI's gates out of order: ${localOrder.join(', ')}; ` +
						`the "${CI_GATE_JOB}" job runs ${ciGates.join(', ')}`
				)
			}
			// A gate the skill runs that no CI job does: `npm run <name>`, or the command the
			// script stands for (the migrations job calls some scripts' commands directly).
			const invokedAnywhere = scriptsInvokedIn(workflow)
			const unenforced = local.filter(
				(name) => isScript(name) && !invokedAnywhere.has(name) && !workflow.includes(scripts[name])
			)
			if (unenforced.length > 0) {
				return fail(
					`${LOCAL_REVIEW_SKILL} runs ${unenforced.join(', ')}, which ${CI_WORKFLOW} never runs — add it to CI or drop it from the skill`
				)
			}
			return pass()
		}
	},
	{
		id: 'prettier-config',
		scope: 'repo',
		title: 'Prettier is configured and has an ignore file',
		run(ctx) {
			if (!PRETTIER_CONFIGS.some((path) => ctx.has(path))) {
				return fail(`no Prettier config (${PRETTIER_CONFIGS.join(', ')})`)
			}
			if (!ctx.has(PRETTIER_IGNORE)) return fail(`${PRETTIER_IGNORE} is missing`)
			return pass()
		}
	},
	{
		id: 'machine-local-state-ignored',
		scope: 'repo',
		title: '.gitignore covers machine-local state at the root and nested',
		run(ctx) {
			const notGit = requireGit(ctx)
			if (notGit) return notGit
			const leaking = MUST_BE_IGNORED.filter((path) => !isIgnored(ctx, path))
			if (leaking.length > 0) return fail(`.gitignore does not ignore: ${leaking.join(', ')}`)
			return pass()
		}
	},
	{
		id: 'no-machine-local-state-tracked',
		scope: 'repo',
		title: 'nothing machine-local is tracked',
		run(ctx) {
			const notGit = requireGit(ctx)
			if (notGit) return notGit
			if (ctx.trackedFiles.length === 0) return fail('git tracks no files at all')
			const problems = []
			for (const { label, pattern } of MUST_NOT_BE_TRACKED) {
				const hits = ctx.trackedFiles.filter((file) => pattern.test(file))
				if (hits.length > 0) {
					problems.push(`${label}: ${hits.slice(0, MAX_LISTED_HITS).join(', ')}`)
				}
			}
			return problems.length > 0 ? fail(`tracked — ${problems.join('; ')}`) : pass()
		}
	},
	{
		id: 'session-logs-tracked',
		scope: 'repo',
		title: 'session transcripts are tracked, kept, and exempt from formatting',
		run(ctx) {
			const notGit = requireGit(ctx)
			if (notGit) return notGit
			const problems = []
			const prettierIgnore = (ctx.read(PRETTIER_IGNORE) ?? '')
				.split('\n')
				.map((line) => line.trim().replace(/\/$/, ''))
			const present = SESSION_LOG_DIRS.filter((dir) => ctx.has(dir))
			if (present.length === 0) {
				problems.push(
					`no session-log directory exists (${SESSION_LOG_DIRS.map((dir) => `${dir}/`).join(' or ')})`
				)
			}
			let anyTracked = false
			for (const dir of present) {
				if (isIgnored(ctx, `${dir}/2026-01-01_00-00-00_probe.md`)) {
					problems.push(`${dir}/ is gitignored, so transcripts never ship with the branch`)
				}
				if (ctx.trackedFiles.some((file) => file.startsWith(`${dir}/`))) anyTracked = true
				// Transcripts are verbatim records. The first one committed fails
				// `format:check` unless Prettier is told to leave the directory alone.
				if (!prettierIgnore.includes(dir)) {
					problems.push(`${PRETTIER_IGNORE} does not list ${dir}/`)
				}
			}
			if (present.length > 0 && !anyTracked) {
				problems.push(
					`no session-log directory has anything tracked — add a .gitkeep so the directory survives a clone`
				)
			}
			return failIfAny(problems)
		}
	},

	// ── App-level: Next.js workspaces ─────────────────────────────────────────

	{
		id: 'env-schema',
		scope: 'workspace',
		kinds: ['next'],
		title: 'environment variables go through one Zod schema, documented and checked',
		run(ctx, ws) {
			const problems = []
			const schemaPath = ws.rel(ENV_SCHEMA)
			const schema = ctx.read(schemaPath)
			if (schema == null) problems.push(`${schemaPath} is missing`)
			else if (!/from\s+['"]zod['"]/.test(schema)) {
				problems.push(`${schemaPath} does not import zod`)
			}
			if (!ctx.has(ws.rel(ENV_EXAMPLE))) problems.push(`${ws.rel(ENV_EXAMPLE)} is missing`)
			problems.push(...envCheckProblems(ctx, ws))
			return failIfAny(problems)
		}
	},
	{
		id: 'structured-logger',
		scope: 'workspace',
		kinds: ['next'],
		title: 'the shared Pino logger is import-restricted and its contract tests are wired',
		run(ctx, ws) {
			const problems = []
			const dir = ws.rel(LOGGER_DIR)
			if (!ws.packageJson?.dependencies?.pino) {
				problems.push(`pino is not a runtime dependency of ${ws.rel('package.json')}`)
			}
			for (const file of ['index.ts', 'logger.ts', 'redact.ts', 'context.ts', ...LOGGER_TESTS]) {
				if (!ctx.has(`${dir}/${file}`)) problems.push(`${dir}/${file} is missing`)
			}
			const source = ctx.read(`${dir}/logger.ts`) ?? ''
			if (!/^import\s+pino\s+from\s+['"]pino['"]/m.test(source) || !/\bpino\(/.test(source)) {
				problems.push(`${dir}/logger.ts must construct the shared Pino logger`)
			}
			for (const file of LOGGER_TESTS) {
				if (!/\btest\(/.test(ctx.read(`${dir}/${file}`) ?? '')) {
					problems.push(`${dir}/${file} contains no contract tests`)
				}
			}
			// The workspace's own test script, or the root's naming the workspace.
			const discovers = (script, glob) =>
				typeof script === 'string' && script.includes('--test') && script.includes(glob)
			if (
				!discovers(ws.packageJson?.scripts?.test, 'src/**/*.test.mts') &&
				!discovers(ctx.packageJson?.scripts?.test, ws.rel('src/**/*.test.mts'))
			) {
				problems.push(
					`the test script must discover ${ws.rel('src/**/*.test.mts')}, including logger contracts`
				)
			}
			const probe = ws.rel(ESLINT_PROBE[ws.kind])
			const { rules, error } = effectiveEslintRules(ctx, probe)
			if (error) problems.push(error)
			else {
				const groups = restrictedImportGroups(rules) ?? []
				if (!groups.includes('pino') || !groups.includes('pino/**')) {
					problems.push(`no-restricted-imports for ${probe} must ban pino and pino/**`)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'eslint-effective-rules',
		scope: 'workspace',
		kinds: ['next', 'expo'],
		title: 'the ESLint config in effect forbids `any` and console output in app code',
		run(ctx, ws) {
			const probe = ws.rel(ESLINT_PROBE[ws.kind])
			const { rules, error } = effectiveEslintRules(ctx, probe)
			if (error) return fail(error)
			const problems = []
			if (severityOf(rules['@typescript-eslint/no-explicit-any']) !== 'error') {
				problems.push('@typescript-eslint/no-explicit-any is not an error')
			}
			if (severityOf(rules['no-console']) !== 'error') problems.push('no-console is not an error')
			return problems.length > 0 ? fail(`for ${probe}: ${problems.join('; ')}`) : pass()
		}
	},
	{
		id: 'typescript-strict',
		scope: 'workspace',
		kinds: ['next', 'expo'],
		title: 'TypeScript runs in strict mode',
		run(ctx, ws) {
			const tsconfig = ws.rel('tsconfig.json')
			if (!ctx.has(tsconfig)) return fail(`${tsconfig} is missing`)
			const result = runBinary(ctx, 'tsc', ['--showConfig', '-p', tsconfig])
			if (result.error) return fail(result.error)
			const config = parseJson(result.stdout)
			if (config == null) return fail('tsc --showConfig did not print a config')
			return config?.compilerOptions?.strict === true
				? pass()
				: fail(`compilerOptions.strict is not true in the resolved ${tsconfig}`)
		}
	},
	{
		id: 'prisma-only-data-path',
		scope: 'workspace',
		kinds: ['next'],
		title: 'the ESLint config in effect makes Prisma the only data path',
		run(ctx, ws) {
			const probe = ws.rel(ESLINT_PROBE[ws.kind])
			const { rules, error } = effectiveEslintRules(ctx, probe)
			if (error) return fail(error)
			const groups = restrictedImportGroups(rules)
			if (groups == null) return fail(`no-restricted-imports is not an error for ${probe}`)
			const missing = DATA_ACCESS_MARKERS.filter((marker) => !groups.includes(marker))
			if (missing.length > 0) {
				return fail(
					`no-restricted-imports for ${probe} does not ban: ${missing.join(', ')} — only ` +
						`${ws.rel('src/server/db/client.ts')} may construct the Prisma client, and raw drivers nowhere`
				)
			}
			return pass()
		}
	},
	{
		id: 'supabase-auth-only',
		scope: 'workspace',
		kinds: ['next'],
		title: 'Supabase clients are typed to their auth surface and the SDK is import-restricted',
		run(ctx, ws) {
			const probe = ws.rel(ESLINT_PROBE[ws.kind])
			const { rules, error } = effectiveEslintRules(ctx, probe)
			if (error) return fail(error)
			const problems = []
			const groups = restrictedImportGroups(rules) ?? []
			const missing = SUPABASE_MARKERS.filter((marker) => !groups.includes(marker))
			if (missing.length > 0) {
				problems.push(`no-restricted-imports for ${probe} does not ban: ${missing.join(', ')}`)
			}
			const typePath = ws.rel(SUPABASE_AUTH_ONLY_TYPE)
			const typeSource = ctx.read(typePath)
			if (typeSource == null) {
				problems.push(`${typePath} is missing`)
			} else {
				const pick = typeSource.match(/Pick<\s*SupabaseClient(?:<[^>]*>)?\s*,\s*([^>]+)>/)
				if (pick == null) {
					problems.push(`${typePath} does not define a Pick<SupabaseClient, ...> type`)
				} else if (/'(from|rpc)'/.test(pick[1])) {
					problems.push(`${typePath} exposes from/rpc — that is a data path`)
				}
			}
			for (const wrapper of SUPABASE_WRAPPERS.map((file) => ws.rel(file))) {
				const source = ctx.read(wrapper)
				if (source == null) {
					problems.push(`${wrapper} is missing`)
				} else if (
					!/export\s+(?:async\s+)?function\s+\w+\([^)]*\)\s*:\s*(?:Promise<)?AuthOnlySupabaseClient/.test(
						source
					)
				) {
					problems.push(`${wrapper} does not return AuthOnlySupabaseClient`)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'rls-check-wired',
		scope: 'workspace',
		kinds: ['next'],
		title: 'the RLS check exists and CI runs it after the migrations are applied',
		run(ctx) {
			if (!ctx.has(RLS_CHECK_SCRIPT)) return fail(`${RLS_CHECK_SCRIPT} is missing`)
			const script = ctx.packageJson?.scripts?.['check:rls']
			if (typeof script !== 'string' || !script.includes(RLS_CHECK_SCRIPT)) {
				return fail(`the "check:rls" script does not run ${RLS_CHECK_SCRIPT}`)
			}
			const workflow = ctx.read(CI_WORKFLOW)
			if (workflow == null) return fail(`${CI_WORKFLOW} is missing`)
			const deployAt = workflow.indexOf('migrate deploy')
			const checkAt = workflow.search(/\b(?:pnpm|npm run|yarn|bun run)\s+check:rls\b/)
			if (deployAt === -1) return fail(`${CI_WORKFLOW} never runs prisma migrate deploy`)
			if (checkAt === -1) return fail(`${CI_WORKFLOW} never runs check:rls`)
			if (checkAt < deployAt) {
				return fail(`${CI_WORKFLOW} runs check:rls before the migrations are applied`)
			}
			return pass()
		}
	},
	{
		// This repo's own: the mobile app once read five tables directly, so the
		// security migration came in two stages and the RLS check lists the
		// tables it still lets keep a policy (APP_READ_TABLES). The standard is met
		// when that list is empty: RLS on, no policies, nothing granted, everywhere.
		id: 'rls-no-policies',
		scope: 'workspace',
		kinds: ['next'],
		title: 'the RLS check exempts no table from "no policies, nothing granted"',
		run(ctx) {
			const source = ctx.read(RLS_CHECK_SCRIPT)
			if (source == null) return fail(`${RLS_CHECK_SCRIPT} is missing`)
			// A list of names, or a map of each name to its owner column.
			const declared = source.match(
				/export\s+const\s+APP_READ_TABLES\s*=\s*(?:\[([^\]]*)\]|\{([^}]*)\})/
			)
			if (declared == null) return pass()
			const tables =
				declared[1] != null
					? [...declared[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
					: [...declared[2].matchAll(/['"]?([\w$]+)['"]?\s*:/g)].map((match) => match[1])
			return tables.length === 0
				? pass()
				: fail(
						`${RLS_CHECK_SCRIPT} still lets ${tables.join(', ')} keep RLS policies and grants ` +
							`(APP_READ_TABLES); drop them in a migration once the app no longer reads them`
					)
		}
	},

	// ── App-level: Expo workspaces ────────────────────────────────────────────

	{
		id: 'mobile-no-server-code',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'the app carries no server runtime: no Pino, no Prisma, no server/db',
		run(ctx, ws) {
			const pkg = ws.packageJson
			if (pkg == null) return fail(`${ws.rel('package.json')} is missing or unparseable`)
			const problems = []
			const serverPackages = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
				(name) => SERVER_ONLY_PACKAGE.test(name)
			)
			if (serverPackages.length > 0) {
				problems.push(
					`${ws.rel('package.json')} depends on ${serverPackages.join(', ')} — a phone runs no Node server; the app reaches data through the web API`
				)
			}
			const files = workspaceFiles(ctx, ws)
			const source = sourceFiles(ctx, ws)
			if (source.length === 0) problems.push(`found no source files under ${ws.path}/`)
			const serverDirs = SERVER_ONLY_DIRS.map((dir) => ws.rel(dir)).filter((dir) => ctx.has(dir))
			if (serverDirs.length > 0)
				problems.push(`server-only directories exist: ${listed(serverDirs)}`)
			const schemas = files.filter((file) => file.endsWith('.prisma'))
			if (schemas.length > 0) problems.push(`Prisma schemas exist: ${listed(schemas)}`)
			const importers = source.filter((file) =>
				importSpecifiers(codeOf(ctx, file)).some((specifier) => SERVER_ONLY_IMPORT.test(specifier))
			)
			if (importers.length > 0) problems.push(`imports Pino or Prisma: ${listed(importers)}`)
			return failIfAny(problems)
		}
	},
	{
		id: 'mobile-env-schema',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'the app reads its env through one Zod schema of static EXPO_PUBLIC_* reads',
		run(ctx, ws) {
			const problems = []
			const schemaPath = ws.rel(MOBILE_ENV_SCHEMA)
			if (!ctx.has(schemaPath)) {
				problems.push(`${schemaPath} is missing`)
			} else {
				const code = codeOf(ctx, schemaPath)
				if (!/from\s+['"]zod['"]/.test(code)) problems.push(`${schemaPath} does not import zod`)
				const names = [...code.matchAll(/\bprocess\.env\.([A-Za-z_$][\w$]*)/g)].map(
					(match) => match[1]
				)
				if (names.length === 0) {
					problems.push(`${schemaPath} reads no process.env.EXPO_PUBLIC_* variable at all`)
				}
				const notPublic = [...new Set(names.filter((name) => !name.startsWith('EXPO_PUBLIC_')))]
				if (notPublic.length > 0) {
					problems.push(
						`${schemaPath} reads ${notPublic.join(', ')} — only EXPO_PUBLIC_* is inlined into the app, anything else is undefined there`
					)
				}
			}
			// Expo inlines process.env.EXPO_PUBLIC_X only for that exact static
			// member access. process.env[key], destructuring or passing
			// process.env around works in dev and is undefined in a release build.
			const source = sourceFiles(ctx, ws)
			if (source.length === 0) problems.push(`found no source files under ${ws.path}/`)
			const dynamic = []
			for (const file of source) {
				codeOf(ctx, file)
					.split('\n')
					.forEach((line, index) => {
						if (/\bprocess\.env\b(?!\s*\.\s*[A-Za-z_$])/.test(line)) {
							dynamic.push(`${file}:${index + 1}`)
						}
					})
			}
			if (dynamic.length > 0) {
				problems.push(
					`dynamic process.env access, undefined in a release build: ${listed(dynamic)} — read each variable as process.env.EXPO_PUBLIC_NAME`
				)
			}
			problems.push(...envCheckProblems(ctx, ws))
			return failIfAny(problems)
		}
	},
	{
		id: 'mobile-no-secrets-in-bundle',
		scope: 'workspace',
		kinds: ['expo'],
		title:
			'nothing secret is named EXPO_PUBLIC_, and no eas.json profile sets app env or credentials',
		run(ctx, ws) {
			const problems = []
			const scanned = [
				...sourceFiles(ctx, ws),
				...[ENV_EXAMPLE, 'app.json', EAS_CONFIG, ...EXPO_DYNAMIC_CONFIGS]
					.map((file) => ws.rel(file))
					.filter((file) => ctx.has(file))
			]
			const names = new Map()
			for (const file of scanned) {
				for (const match of (ctx.read(file) ?? '').matchAll(/\bEXPO_PUBLIC_[A-Z0-9_]+/g)) {
					if (!names.has(match[0])) names.set(match[0], file)
				}
			}
			if (names.size === 0) {
				problems.push(
					`found no EXPO_PUBLIC_* variable anywhere in ${ws.path}/ — nothing was judged, which is not the same as nothing wrong`
				)
			}
			for (const [name, file] of names) {
				const word = FORBIDDEN_PUBLIC_ENV_WORDS.find((candidate) =>
					name.slice('EXPO_PUBLIC_'.length).includes(candidate)
				)
				if (word) {
					problems.push(
						`${name} (${file}) is inlined into the app for anyone to read — a ${word} value belongs on the server`
					)
				}
			}
			// A build profile's env overrides the EAS environment variable of the
			// same name, and EAS passes "$VAR" there through as that literal string.
			// So an app variable or a credential in it ships whatever the file says,
			// a placeholder or a reference, instead of the real value. Whatever the
			// value, the name has no place there.
			const easPath = ws.rel(EAS_CONFIG)
			const easRaw = ctx.read(easPath)
			if (easRaw != null) {
				const eas = parseJson(easRaw)
				if (eas == null) problems.push(`${easPath} is not valid JSON`)
				const overriding = []
				for (const [profile, definition] of Object.entries(eas?.build ?? {})) {
					for (const name of Object.keys(definition?.env ?? {})) {
						if (name.startsWith('EXPO_PUBLIC_') || isCredentialName(name)) {
							overriding.push(`build.${profile}.env.${name}`)
						}
					}
				}
				if (overriding.length > 0) {
					problems.push(
						`${easPath} sets ${listed(overriding)} in a build profile's env, which overrides the EAS environment variable and passes $VAR literally — ` +
							'set it with `eas env:set --environment <environment>` and delete it from eas.json (docs/rules/secrets.md)'
					)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'mobile-logger',
		scope: 'workspace',
		kinds: ['expo'],
		title:
			'a mobile logger (console in dev, Sentry breadcrumbs in release) and no console elsewhere',
		run(ctx, ws) {
			const problems = []
			const { entry, files: moduleFiles } = loggerFiles(ctx, ws)
			if (entry == null) {
				problems.push(
					`no mobile logger: ${MOBILE_LOGGER_ENTRIES.map((file) => ws.rel(file)).join(' or ')} is missing`
				)
			} else {
				const code = moduleFiles.map((file) => codeOf(ctx, file)).join('\n')
				if (
					!/from\s+['"]@sentry\/react-native['"]/.test(code) ||
					!/\baddBreadcrumb\s*\(/.test(code)
				) {
					problems.push(
						`${entry} leaves no Sentry breadcrumbs (import @sentry/react-native, call addBreadcrumb), so a release build logs nowhere`
					)
				}
				if (!/\b__DEV__\b/.test(code) || !/\bconsole\.\w+\s*\(/.test(code)) {
					problems.push(`${entry} does not print to the console in development (__DEV__ → console)`)
				}
				const words = sensitiveWordsIn(code)
				const web = ctx.workspaces.find((candidate) => candidate.kind === 'next')
				if (words == null) {
					problems.push(`${entry} has no SENSITIVE_WORDS redaction list`)
				} else if (web == null) {
					if (words.length === 0)
						problems.push(`${entry} redacts nothing: SENSITIVE_WORDS is empty`)
				} else {
					const redactPath = web.rel(LOGGER_REDACT)
					const webWords = sensitiveWordsIn(codeOf(ctx, redactPath))
					if (webWords == null) {
						problems.push(
							`cannot compare redaction lists: ${redactPath} has no SENSITIVE_WORDS list`
						)
					} else {
						const onlyWeb = webWords.filter((word) => !words.includes(word))
						const onlyMobile = words.filter((word) => !webWords.includes(word))
						if (onlyWeb.length > 0 || onlyMobile.length > 0) {
							problems.push(
								`${entry} and ${redactPath} redact different words` +
									(onlyWeb.length > 0 ? `; only the web redacts: ${onlyWeb.join(', ')}` : '') +
									(onlyMobile.length > 0 ? `; only the app redacts: ${onlyMobile.join(', ')}` : '')
							)
						}
					}
				}
			}
			// Every source file but the logger itself: no-console as an error. An
			// `allow` list is accepted only in env.ts, which reports a bad boot
			// config before the logger can load.
			const checked = sourceFiles(ctx, ws).filter((file) => !moduleFiles.includes(file))
			if (checked.length === 0) problems.push(`found no source files under ${ws.path}/`)
			const snapshot = eslintSnapshot(ctx)
			if (snapshot.error) {
				problems.push(snapshot.error)
			} else {
				const off = []
				const loosened = []
				for (const file of checked) {
					const setting = snapshot.configs?.[file]?.['no-console']
					if (severityOf(setting) !== 'error') off.push(file)
					else if (
						Array.isArray(setting) &&
						setting[1]?.allow?.length > 0 &&
						file !== ws.rel(MOBILE_ENV_SCHEMA)
					) {
						loosened.push(file)
					}
				}
				if (off.length > 0) {
					problems.push(
						`no-console is not an error in ${off.length} source file(s): ${listed(off)}`
					)
				}
				if (loosened.length > 0) {
					problems.push(`no-console allows some console methods in: ${listed(loosened)}`)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'mobile-auth-only',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'the app’s Supabase client is typed to auth, and the SDK is import-banned elsewhere',
		run(ctx, ws) {
			const problems = []
			const clientPath = ws.rel(MOBILE_SUPABASE_CLIENT)
			if (!ctx.has(clientPath)) {
				problems.push(`${clientPath} is missing`)
			} else {
				const code = codeOf(ctx, clientPath)
				const pick = code.match(/Pick<\s*SupabaseClient(?:<[^>]*>)?\s*,\s*([^>]+)>/)
				if (pick == null) {
					problems.push(
						`${clientPath} does not type the client as Pick<SupabaseClient, 'auth'>, so .from() and .rpc() still typecheck`
					)
				} else {
					const exposed = [...pick[1].matchAll(/['"](\w+)['"]/g)]
						.map((match) => match[1])
						.filter((member) => ['from', 'rpc', 'schema'].includes(member))
					if (exposed.length > 0) {
						problems.push(`${clientPath} exposes ${exposed.join(', ')} — that is a data path`)
					}
					const aliases = [...code.matchAll(/\btype\s+(\w+)\s*=\s*Pick<\s*SupabaseClient\b/g)].map(
						(match) => match[1]
					)
					const annotation = code.match(/export\s+const\s+supabase\s*:\s*([^=]+?)\s*=/)?.[1]
					if (annotation == null) {
						problems.push(`${clientPath} exports no \`supabase\` annotated with its auth-only type`)
					} else if (!annotation.startsWith('Pick<') && !aliases.includes(annotation)) {
						problems.push(
							`${clientPath} exports \`supabase\` as ${annotation}, not its auth-only type`
						)
					}
				}
			}
			const probes = supabaseImportProbes(ctx, ws)
			if (probes.length === 0) problems.push(`found no source directories under ${ws.path}/`)
			const snapshot = eslintSnapshot(ctx)
			if (snapshot.error) {
				problems.push(snapshot.error)
			} else {
				const bans = (file) =>
					(snapshot.lint?.[`supabase:${file}`] ?? []).includes('no-restricted-imports')
				const open = probes.filter((file) => !bans(file)).map((file) => dirname(file))
				if (open.length > 0) {
					problems.push(
						`@supabase/supabase-js can be imported in ${listed(open)} — no-restricted-imports must ban it everywhere but ${clientPath}`
					)
				}
				if (ctx.has(clientPath) && bans(clientPath)) {
					problems.push(`${clientPath} itself may not import @supabase/supabase-js`)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'ota-configured',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'OTA updates: expo-updates, a fingerprint runtime, a channel on every release profile',
		run(ctx, ws) {
			const app = expoApp(ctx, ws)
			if (app.error) return fail(app.error)
			const { deps, config, source } = app
			const problems = []
			if (!deps['expo-updates']) {
				problems.push(`expo-updates is not a dependency of ${ws.rel('package.json')}`)
			}
			if (typeof config.updates?.url !== 'string' || !config.updates.url.startsWith('https://')) {
				problems.push(`${source} has no updates.url, so a build never looks for an update`)
			}
			if (config.runtimeVersion === undefined) {
				problems.push(`${source} has no runtimeVersion — set { "policy": "fingerprint" }`)
			}
			for (const [where, value] of [
				['runtimeVersion', config.runtimeVersion],
				['ios.runtimeVersion', config.ios?.runtimeVersion],
				['android.runtimeVersion', config.android?.runtimeVersion]
			]) {
				if (value !== undefined && value?.policy !== 'fingerprint') {
					problems.push(
						`${source} ${where} is ${JSON.stringify(value)}, not { "policy": "fingerprint" } — an update could reach a binary without the native code it needs`
					)
				}
			}
			const easPath = ws.rel(EAS_CONFIG)
			const easRaw = ctx.read(easPath)
			const eas = easRaw == null ? null : parseJson(easRaw)
			if (easRaw == null) problems.push(`${easPath} is missing`)
			else if (eas == null) problems.push(`${easPath} is not valid JSON`)
			else {
				const profiles = eas.build ?? {}
				const resolveProfile = (name, seen = new Set()) => {
					const own = profiles[name] ?? {}
					if (typeof own.extends !== 'string' || seen.has(name)) return own
					seen.add(name)
					return { ...resolveProfile(own.extends, seen), ...own }
				}
				const release = Object.keys(profiles).filter(
					(name) => resolveProfile(name).developmentClient !== true
				)
				if (release.length === 0) {
					problems.push(`${easPath} has no build profile that makes a release build`)
				}
				const unchannelled = release.filter((name) => {
					const channel = resolveProfile(name).channel
					return typeof channel !== 'string' || channel.trim() === ''
				})
				if (unchannelled.length > 0) {
					problems.push(
						`${easPath} build profiles without a channel (their builds never get an update): ${unchannelled.join(', ')}`
					)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'store-review-skill',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'the store-review skill exists, ship and local-review invoke it, CI runs check:store',
		run(ctx, ws) {
			const problems = []
			const skill = ctx.read(STORE_REVIEW_SKILL)
			if (skill == null) problems.push(`${STORE_REVIEW_SKILL} is missing`)
			else if (!/^name:\s*store-review\s*$/m.test(skill)) {
				problems.push(`${STORE_REVIEW_SKILL} has no "name: store-review" frontmatter`)
			}
			for (const path of [SHIP_SKILL, LOCAL_REVIEW_SKILL]) {
				const text = ctx.read(path)
				if (text == null) problems.push(`${path} is missing`)
				else if (!text.includes('store-review') || !text.includes(ws.path)) {
					problems.push(`${path} does not invoke store-review when ${ws.path}/ changed`)
				}
			}
			if (typeof ctx.packageJson?.scripts?.['check:store'] !== 'string') {
				problems.push('package.json has no "check:store" script')
			}
			const workflow = ctx.read(CI_WORKFLOW)
			if (workflow == null) problems.push(`${CI_WORKFLOW} is missing`)
			else if (!scriptsInvokedIn(workflow).has('check:store')) {
				problems.push(`${CI_WORKFLOW} never runs check:store`)
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'ios-purpose-strings',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'every installed module that asks for an iOS permission has a specific purpose string',
		run(ctx, ws) {
			const app = expoApp(ctx, ws)
			if (app.error) return fail(app.error)
			const installed = Object.keys(PERMISSION_MODULES).filter((name) => name in app.deps)
			if (installed.length === 0) return pass('no installed module asks for an iOS permission')
			const problems = []
			for (const name of installed) {
				for (const { key, option } of PERMISSION_MODULES[name]) {
					const verdict = purposeString(app.config, name, option, key)
					if (!verdict.ok) problems.push(`${name}: ${key} ${verdict.why}`)
				}
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'ios-privacy-manifest',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'ios.privacyManifests declares every required-reason API the dependencies use',
		run(ctx, ws) {
			const app = expoApp(ctx, ws)
			if (app.error) return fail(app.error)
			const problems = []
			const declared = new Set()
			const entries = app.config.ios?.privacyManifests?.NSPrivacyAccessedAPITypes
			if (!Array.isArray(entries) || entries.length === 0) {
				problems.push(`${app.source} has no ios.privacyManifests.NSPrivacyAccessedAPITypes`)
			} else {
				entries.forEach((entry, index) => {
					const category = entry?.NSPrivacyAccessedAPIType
					const reasons = entry?.NSPrivacyAccessedAPITypeReasons
					if (
						typeof category !== 'string' ||
						!category.startsWith('NSPrivacyAccessedAPICategory')
					) {
						problems.push(`NSPrivacyAccessedAPITypes[${index}] names no API category`)
					} else if (!Array.isArray(reasons) || reasons.length === 0) {
						problems.push(`${category} gives no NSPrivacyAccessedAPITypeReasons`)
					} else {
						declared.add(category)
					}
				})
			}
			// What the installed SDKs declare in their own PrivacyInfo.xcprivacy.
			// CocoaPods links them statically, so the app's manifest must carry it.
			const native = nativeDependencies(ctx, ws)
			if (native.error) return fail([...problems, native.error].join('; '))
			const needed = new Map()
			let manifests = 0
			for (const { name, dir } of native.packages) {
				for (const file of privacyManifestsIn(dir)) {
					manifests += 1
					const text = readFileSync(file, 'utf8')
					for (const category of new Set(
						text.match(/NSPrivacyAccessedAPICategory[A-Za-z]+/g) ?? []
					)) {
						const users = needed.get(category) ?? []
						if (!users.includes(name)) users.push(name)
						needed.set(category, users)
					}
				}
			}
			if (manifests === 0) {
				problems.push(
					'no installed dependency ships a PrivacyInfo.xcprivacy (react-native does), so the dependencies were not read'
				)
			}
			const missing = [...needed].filter(([category]) => !declared.has(category))
			if (missing.length > 0) {
				problems.push(
					`${app.source} does not declare ${missing
						.map(([category, users]) => `${category} (used by ${listed(users)})`)
						.join(', ')}`
				)
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'android-permissions-minimal',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'the Android build requests no broad storage or media permission it has not justified',
		run(ctx, ws) {
			const app = expoApp(ctx, ws)
			if (app.error) return fail(app.error)
			const problems = []
			const sources = new Map()
			const add = (permission, from) => {
				const name = androidPermissionName(permission)
				sources.set(name, [...(sources.get(name) ?? []), from])
			}
			for (const permission of app.config.android?.permissions ?? []) {
				add(permission, `${app.source} android.permissions`)
			}
			// The manifest the build starts from: a committed native project, or
			// Expo's prebuild template.
			const nativeManifest = ws.rel('android/app/src/main/AndroidManifest.xml')
			if (ctx.trackedFiles.includes(nativeManifest)) {
				for (const permission of usesPermissions(ctx.read(nativeManifest) ?? '')) {
					add(permission, nativeManifest)
				}
			} else {
				const expoDir = resolvePackageDir(ctx, join(ctx.root, ws.path), 'expo')
				const pluginsDir =
					(expoDir && resolvePackageDir(ctx, expoDir, '@expo/config-plugins')) ??
					resolvePackageDir(ctx, join(ctx.root, ws.path), '@expo/config-plugins')
				const template = pluginsDir ? join(pluginsDir, EXPO_MANIFEST_TEMPLATE) : null
				const permissions =
					template && existsSync(template) ? usesPermissions(readFileSync(template, 'utf8')) : []
				if (permissions.length === 0) {
					problems.push(
						`could not read the AndroidManifest template expo prebuild starts from (@expo/config-plugins/${EXPO_MANIFEST_TEMPLATE}) — install dependencies, or update this check for the Expo version`
					)
				}
				for (const permission of permissions) add(permission, "Expo's prebuild template")
			}
			// Every native dependency's own manifest is merged into the app's.
			const native = nativeDependencies(ctx, ws)
			if (native.error) problems.push(native.error)
			for (const { name, dir } of native.packages ?? []) {
				const manifest = join(dir, 'android', 'src', 'main', 'AndroidManifest.xml')
				if (!existsSync(manifest)) continue
				for (const permission of usesPermissions(readFileSync(manifest, 'utf8'))) {
					add(permission, name)
				}
			}
			const blocked = new Set(
				(app.config.android?.blockedPermissions ?? []).map(androidPermissionName)
			)
			const allowed = Object.fromEntries(
				Object.entries(ctx.exceptions.androidPermissions ?? {}).map(([name, reason]) => [
					androidPermissionName(name),
					reason
				])
			)
			const broad = [...sources].filter(
				([name]) => BROAD_ANDROID_PERMISSIONS.has(name) && !blocked.has(name)
			)
			for (const [name, from] of broad) {
				if (name in allowed) continue
				problems.push(
					`${name} is requested (${[...new Set(from)].join(', ')}) — list it in android.blockedPermissions, or justify it in ${EXCEPTIONS_FILE} androidPermissions`
				)
			}
			const stale = Object.keys(allowed).filter(
				(name) => !broad.some(([requested]) => requested === name)
			)
			if (stale.length > 0) {
				problems.push(
					`${EXCEPTIONS_FILE} androidPermissions lists ${stale.join(', ')}, which the build does not request — delete the entry`
				)
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'att-when-tracking',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'an ads or attribution SDK comes with the App Tracking Transparency prompt',
		run(ctx, ws) {
			const app = expoApp(ctx, ws)
			if (app.error) return fail(app.error)
			const trackers = ADS_AND_ATTRIBUTION_SDKS.filter((name) => name in app.deps)
			if (trackers.length === 0) {
				return pass(
					'no ads or attribution SDK is a dependency, so there is no tracking to ask about'
				)
			}
			const problems = []
			if (!app.deps['expo-tracking-transparency']) {
				problems.push(
					`${trackers.join(', ')} ${trackers.length > 1 ? 'are dependencies' : 'is a dependency'}, expo-tracking-transparency is not`
				)
			}
			const verdict = purposeString(
				app.config,
				'expo-tracking-transparency',
				'userTrackingPermission',
				'NSUserTrackingUsageDescription'
			)
			if (verdict.optedOut) problems.push('NSUserTrackingUsageDescription is switched off')
			else if (!verdict.ok) problems.push(`NSUserTrackingUsageDescription ${verdict.why}`)
			const asks = sourceFiles(ctx, ws).some((file) => TRACKING_REQUEST.test(codeOf(ctx, file)))
			if (!asks) {
				problems.push(
					`nothing in ${ws.path}/ calls requestTrackingPermissionsAsync — the prompt must come before the SDK starts`
				)
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'account-deletion-in-app',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'a reachable screen deletes the account from inside the app',
		run(ctx, ws) {
			const screens = screensOf(ctx, ws)
			if (screens.length === 0) return fail(`found no screens under ${ws.rel('app/')}`)
			const deleters = sourceFiles(ctx, ws).filter((file) =>
				DELETE_ACCOUNT_ENDPOINT.test(codeOf(ctx, file))
			)
			if (deleters.length === 0) {
				return fail(
					`nothing in ${ws.path}/ calls the account-deletion route (/api/delete-account, /api/app/v1/account, or api('deleteAccount'))`
				)
			}
			const offering = screens.filter(
				(screen) =>
					showsDeleteAccountLabel(ctx, ws, screen) && reachesAny(ctx, ws, screen, deleters)
			)
			if (offering.length === 0) {
				return fail(
					`no screen under ${ws.rel('app/')} shows a "Delete account" action wired to ${listed(deleters)}`
				)
			}
			if (!offering.some((screen) => isReachable(ctx, ws, screen))) {
				return fail(
					`${listed(offering)} deletes the account, but nothing navigates to ${offering.map((screen) => routeOf(ws, screen)).join(', ')}`
				)
			}
			return pass()
		}
	},
	{
		id: 'paywall-legal-links',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'the paywall links to the Terms of Use and the Privacy Policy and can restore',
		run(ctx, ws) {
			const app = expoApp(ctx, ws)
			if (app.error) return fail(app.error)
			const sdks = IAP_SDKS.filter((name) => name in app.deps)
			if (sdks.length === 0)
				return pass('no in-app purchase SDK is a dependency, so there is no paywall')
			const paywalls = screensOf(ctx, ws).filter((screen) =>
				PURCHASE_CALL.test(codeOf(ctx, screen))
			)
			if (paywalls.length === 0) {
				return fail(
					`${sdks.join(', ')} is a dependency, but no screen under ${ws.rel('app/')} calls a purchase — the paywall cannot be found to judge`
				)
			}
			const problems = []
			for (const screen of paywalls) {
				const code = codeOf(ctx, screen)
				const targets = [...code.matchAll(NAVIGATION)].map((match) => match[1] ?? match[2])
				const missing = []
				if (
					!/terms\s+of\s+(?:use|service)|\bEULA\b/i.test(code) ||
					!targets.some((target) => /terms|eula/i.test(target))
				) {
					missing.push('Terms of Use (EULA) link')
				}
				if (!/privacy\s+policy/i.test(code) || !targets.some((target) => /privacy/i.test(target))) {
					missing.push('Privacy Policy link')
				}
				if (!RESTORE_CALL.test(code)) missing.push('Restore purchases action')
				if (missing.length > 0) problems.push(`${screen} has no ${missing.join(', no ')}`)
			}
			return failIfAny(problems)
		}
	},
	{
		id: 'sign-in-with-apple',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'a third-party login comes with Sign in with Apple, natively on iOS',
		run(ctx, ws) {
			const app = expoApp(ctx, ws)
			if (app.error) return fail(app.error)
			const source = sourceFiles(ctx, ws)
			if (source.length === 0) return fail(`found no source files under ${ws.path}/`)
			const offered = THIRD_PARTY_LOGIN_SDKS.filter((name) => name in app.deps)
			const webApple = []
			for (const file of source) {
				const code = codeOf(ctx, file)
				const providerImports = importSpecifiers(code).filter((specifier) =>
					THIRD_PARTY_LOGIN_IMPORT.test(specifier)
				)
				if (providerImports.length > 0) offered.push(`${providerImports.join(', ')} in ${file}`)
				if (!SUPABASE_SIGN_IN.test(code)) continue
				const providers = [
					...new Set([...code.matchAll(THIRD_PARTY_OAUTH_PROVIDER)].map((m) => m[1]))
				]
				if (providers.length > 0) offered.push(`${providers.join(', ')} sign-in in ${file}`)
				// signInWithIdToken({ provider: 'apple' }) is how the native sheet's
				// token is exchanged; only signInWithOAuth is the web page.
				if (/\bsignInWithOAuth\s*\(/.test(code) && APPLE_OAUTH_PROVIDER.test(code)) {
					webApple.push(file)
				}
			}
			if (offered.length === 0) return pass('no third-party login is offered')
			const native = NATIVE_APPLE_SIGN_IN.find(
				({ name, call }) =>
					name in app.deps &&
					source.some((file) => {
						const code = codeOf(ctx, file)
						const imports = importSpecifiers(code)
						return (
							imports.some((specifier) => specifier === name || specifier.startsWith(`${name}/`)) &&
							call.test(code)
						)
					})
			)
			if (native) return pass()
			const problems = [
				`${listed(offered)} is offered, so Apple 4.8 needs Sign in with Apple beside it, natively on iOS`
			]
			const installed = NATIVE_APPLE_SIGN_IN.find(({ name }) => name in app.deps)
			problems.push(
				installed
					? `${installed.name} is installed but nothing in ${ws.path}/ presents its sheet`
					: 'expo-apple-authentication is not a dependency'
			)
			if (webApple.length > 0) {
				problems.push(
					`Apple sign-in in ${listed(webApple)} goes through the web OAuth page, not Apple's native sheet`
				)
			}
			problems.push(
				"fix: add expo-apple-authentication, show its AppleAuthenticationButton on iOS, and pass the credential's identityToken to supabase.auth.signInWithIdToken({ provider: 'apple' }) (a store build)"
			)
			return fail(problems.join('; '))
		}
	},
	{
		id: 'mock-data-dev-only',
		scope: 'workspace',
		kinds: ['expo'],
		title: 'mock data and placeholder copy stay out of release builds',
		run(ctx, ws) {
			const source = sourceFiles(ctx, ws)
			if (source.length === 0) return fail(`found no source files under ${ws.path}/`)
			const problems = []
			const mocks = source.filter((file) => MOCK_DATA_FILE.test(file))
			const loader = ws.rel(MOCK_DATA_LOADER)
			const loadsMock = (file, specifier) =>
				mocks.includes(resolveLocalImport(ctx, ws, file, specifier))
			if (mocks.length > 0) {
				const referrers = source.filter(
					(file) =>
						!mocks.includes(file) &&
						file !== loader &&
						importSpecifiers(codeOf(ctx, file)).some((specifier) => loadsMock(file, specifier))
				)
				if (referrers.length > 0) {
					problems.push(
						`${listed(referrers)} reference${referrers.length > 1 ? '' : 's'} ${listed(mocks)} directly — only ${loader} may, inside if (__DEV__)`
					)
				}
				if (ctx.has(loader)) {
					const code = codeOf(ctx, loader)
					const staticImports = [
						...code.matchAll(/^\s*import\s+(?!type\b)[^;]*?\bfrom\s*['"]([^'"]+)['"]/gm)
					].filter((match) => loadsMock(loader, match[1]))
					if (staticImports.length > 0) {
						problems.push(
							`${loader} imports mock data statically, so every build bundles it — require it inside if (__DEV__)`
						)
					}
					const guard = code.search(/\bif\s*\(\s*__DEV__\s*\)/)
					const unguarded = [...code.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].filter(
						(match) => loadsMock(loader, match[1]) && (guard === -1 || match.index < guard)
					)
					if (unguarded.length > 0) {
						problems.push(`${loader} requires mock data outside an if (__DEV__) block`)
					}
				}
			}
			// Copy ships from source and from locale files alike.
			const prefix = ws.path === '.' ? '' : `${ws.path}/`
			const locales = workspaceFiles(ctx, ws).filter(
				(file) => file.endsWith('.json') && file.slice(prefix.length).includes('/')
			)
			const placeholders = []
			for (const file of [...source, ...locales]) {
				if (mocks.includes(file) || file === loader) continue
				const text = file.endsWith('.json') ? (ctx.read(file) ?? '') : codeOf(ctx, file)
				text.split('\n').forEach((line, index) => {
					if (PLACEHOLDER_COPY.test(line)) placeholders.push(`${file}:${index + 1}`)
				})
			}
			if (placeholders.length > 0) {
				problems.push(`placeholder copy ("coming soon", "lorem ipsum") in ${listed(placeholders)}`)
			}
			if (problems.length > 0) return fail(problems.join('; '))
			return mocks.length > 0 ? pass() : pass('no mock data module')
		}
	}
]

function isCredentialName(name) {
	// SENTRY_AUTH_TOKEN, apiKey and x-api-key all reduce to words; any one of
	// the logger's redaction words makes the name a credential.
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(/[^A-Za-z0-9]+/)
		.some((word) => CREDENTIAL_WORDS.has(word.toLowerCase()))
}

export function runStandardsChecks({ root = process.cwd(), ids = null } = {}) {
	const ctx = createContext(root)
	const selected = ids == null ? CHECKS : CHECKS.filter((check) => ids.includes(check.id))
	const planned = []
	for (const check of selected.filter((candidate) => candidate.scope === 'repo')) {
		planned.push({ check, ws: null })
	}
	for (const ws of ctx.workspaces) {
		for (const check of selected) {
			if (check.scope === 'workspace' && check.kinds.includes(ws.kind)) planned.push({ check, ws })
		}
	}
	const results = planned.map(({ check, ws }) => {
		let outcome
		try {
			outcome = check.run(ctx, ws)
		} catch (error) {
			outcome = fail(`check crashed: ${error.message}`)
		}
		return {
			id: check.id,
			workspace: ws?.path ?? null,
			kind: ws?.kind ?? null,
			title: check.title,
			ok: outcome.ok,
			detail: outcome.detail ?? null
		}
	})
	return {
		root: ctx.root,
		workspaces: ctx.workspaces.map(({ path, kind }) => ({ path, kind })),
		results
	}
}

export function loadExceptions(root) {
	const path = join(root, EXCEPTIONS_FILE)
	if (!existsSync(path)) return { pending: {}, divergences: {}, androidPermissions: {} }
	const parsed = JSON.parse(readFileSync(path, 'utf8'))
	return {
		pending: parsed.pending ?? {},
		divergences: parsed.divergences ?? {},
		androidPermissions: parsed.androidPermissions ?? {}
	}
}

// `readme` excuses readme wherever it runs; `apps/web:env-schema` excuses it
// in that workspace only.
export function exceptionKeyMatches(key, result) {
	const split = key.lastIndexOf(':')
	if (split === -1) return result.id === key
	return result.workspace === key.slice(0, split) && result.id === key.slice(split + 1)
}

// Each result gains a status: 'met', 'unmet', 'pending', 'divergence', or
// 'stale' (excepted but met, so the exception must go or be narrowed).
// `unknown` is a pending key that names no check that ran; `declared` is a
// divergence that names no check, a repo-wide decision printed as is.
export function applyExceptions(results, { pending = {}, divergences = {} } = {}) {
	const entries = [
		...Object.entries(pending).map(([key, note]) => ({ key, note, kind: 'pending' })),
		...Object.entries(divergences).map(([key, note]) => ({ key, note, kind: 'divergence' }))
	].map((entry) => ({
		...entry,
		matches: results.filter((result) => exceptionKeyMatches(entry.key, result))
	}))
	const unknown = entries
		.filter((entry) => entry.kind === 'pending' && entry.matches.length === 0)
		.map((entry) => entry.key)
	const declared = entries
		.filter((entry) => entry.kind === 'divergence' && entry.matches.length === 0)
		.map(({ key, note }) => ({ key, note }))
	const annotated = results.map((result) => {
		const entry = entries.find((candidate) => candidate.matches.includes(result))
		if (entry == null) return { ...result, status: result.ok ? 'met' : 'unmet' }
		if (result.ok) {
			const stillUnmet = entry.matches.filter((match) => !match.ok)
			const fix =
				stillUnmet.length > 0
					? `narrow it to ${stillUnmet.map((match) => `"${match.workspace ? `${match.workspace}:` : ''}${match.id}"`).join(', ')}`
					: 'delete the entry'
			return {
				...result,
				status: 'stale',
				detail: `met, but "${entry.key}" is still listed as ${entry.kind} in ${EXCEPTIONS_FILE} — ${fix}`
			}
		}
		return { ...result, status: entry.kind, note: entry.note }
	})
	return { annotated, unknown, declared }
}

// Only the exceptions for the checks that ran: a run of a subset (check:store
// runs the store checks) must not read every other pending entry as unknown.
function exceptionsFor(exceptions, ids) {
	if (ids == null) return exceptions
	const selected = ([key]) => ids.includes(key.slice(key.lastIndexOf(':') + 1))
	return {
		...exceptions,
		pending: Object.fromEntries(Object.entries(exceptions.pending).filter(selected)),
		divergences: Object.fromEntries(Object.entries(exceptions.divergences).filter(selected))
	}
}

export function evaluateStandards({ root = process.cwd(), ids = null } = {}) {
	const { root: resolvedRoot, workspaces, results } = runStandardsChecks({ root, ids })
	const { annotated, unknown, declared } = applyExceptions(
		results,
		exceptionsFor(loadExceptions(resolvedRoot), ids)
	)
	const blocking = annotated.filter(
		(result) => result.status === 'unmet' || result.status === 'stale'
	)
	return {
		root: resolvedRoot,
		workspaces,
		isMet: blocking.length === 0 && unknown.length === 0,
		unknown,
		declared,
		results: annotated
	}
}

function main() {
	const args = process.argv.slice(2)
	const rootIndex = args.indexOf('--root')
	const root = rootIndex === -1 ? process.cwd() : args[rootIndex + 1]
	if (rootIndex !== -1 && !root) {
		console.error('Usage: check-standards.mjs [--root <dir>] [--json]')
		process.exit(1)
	}
	const isJsonOutput = args.includes('--json')

	let report
	try {
		report = evaluateStandards({ root })
	} catch (error) {
		console.error(`check-standards: ${error.message}`)
		process.exit(1)
	}

	if (isJsonOutput) {
		console.log(JSON.stringify(report, null, 2))
		process.exit(report.isMet ? 0 : 1)
	}

	const { results, declared, unknown } = report
	const MARK = { met: '✓', unmet: '✗', stale: '✗', pending: '~', divergence: '~' }
	const width = Math.max(...results.map((result) => result.id.length), 0)
	console.log(`Standards check — ${results.length} checks against ${report.root}`)
	const scopes = [
		{ label: 'Repository', workspace: null },
		...report.workspaces.map((ws) => ({
			label: ws.path === '.' ? `App at the root (${ws.kind})` : `${ws.path} (${ws.kind})`,
			workspace: ws.path
		}))
	]
	for (const scope of scopes) {
		const rows = results.filter((result) => result.workspace === scope.workspace)
		if (rows.length === 0) continue
		console.log(`\n${scope.label}`)
		for (const result of rows) {
			console.log(`  ${MARK[result.status]} ${result.id.padEnd(width)}  ${result.title}`)
			if (result.status === 'pending' || result.status === 'divergence') {
				console.log(`      ${result.status}: ${result.note}`)
			} else if (result.detail) {
				console.log(`      ${result.detail}`)
			}
		}
	}
	if (declared.length > 0) {
		console.log(`\nDivergences by design (${EXCEPTIONS_FILE})`)
		for (const { key, note } of declared) console.log(`  ~ ${key.padEnd(width)}  ${note}`)
	}
	for (const key of unknown) {
		console.log(`\n  ✗ ${key}  listed as pending in ${EXCEPTIONS_FILE}, but no such check ran`)
	}
	console.log('')
	const count = (status) => results.filter((result) => result.status === status).length
	const summary =
		`${count('met')} of ${results.length} standards met, ${count('pending')} pending, ` +
		`${count('divergence')} excepted as divergences.`
	if (!report.isMet) {
		console.error(
			`${summary} ${count('unmet')} unmet and ${count('stale')} stale — ` +
				`docs/STANDARDS.md says what each one means and how to meet it.`
		)
		process.exit(1)
	}
	console.log(summary)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main()
}
