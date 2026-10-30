#!/usr/bin/env node
// check:env — every environment variable an app reads is declared in its Zod
// schema and in its .env.example, and nothing is declared that nothing reads.
//
// From template-web's check-env-vars.mjs, which fails when a process.env.X
// reference in src/ isn't declared in both .env.example and the schema
// (an undeclared env var is a real bug that security
// audit flagged and never fixed; this check exists so that doesn't happen
// here). This copy also fails the other direction — a name declared in only
// one of the two files, or declared and read nowhere — because a stale entry
// is how a deployment carries a secret nothing uses, or a new clone sets up a
// variable for a feature that was removed.
//
// A monorepo: the workspaces and their kinds come from standards.config.json,
// the same file the standards checker reads, so a new app is checked the day
// it is listed there.
//
// Run: npm run check:env

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const CONFIG_FILE = 'standards.config.json'

// What each kind of workspace reads its environment through.
const KINDS = {
	// Next.js: any server or client module reads process.env.X; src/lib/env.ts
	// validates the whole set at boot (src/instrumentation.ts).
	next: {
		sourceDirs: ['src'],
		schema: 'src/lib/env.ts',
		// `NAME: z.string()…` inside the schema object.
		schemaEntry: /^\s*([A-Z][A-Z0-9_]*):\s*z\./gm,
		// The schema parses process.env whole; it is not a reader, and its
		// comments must not count as one.
		schemaIsReader: false,
		// Standard Node/Next.js runtime vars — always present, never app config.
		runtime: new Set(['NODE_ENV', 'NEXT_RUNTIME', 'VERCEL', 'VERCEL_ENV', 'CI']),
		// Declared, but read by something other than a process.env.X in src/.
		// Each needs its reason; an entry here is exempt from the unused check.
		readElsewhere: new Map([
			['LOG_LEVEL', 'the logger reads it through resolveThreshold(process.env)'],
			['DATABASE_URL', 'Prisma reads it through prisma/schema'],
			['DIRECT_URL', 'the Prisma CLI reads it for migrations']
		]),
		exampleOnly: new Map()
	},
	// Expo: only lib/env.ts touches process.env (ESLint enforces it), spelling
	// out each EXPO_PUBLIC_* name statically so Expo inlines it into the bundle.
	expo: {
		sourceDirs: ['app', 'components', 'contexts', 'hooks', 'lib'],
		schema: 'lib/env.ts',
		// `EXPO_PUBLIC_X: url.optional()` inside the schema object, not the
		// `EXPO_PUBLIC_X: process.env.EXPO_PUBLIC_X` lines that feed it.
		schemaEntry: /^\s*(EXPO_PUBLIC_[A-Z0-9_]+):\s*(?!process\.env)/gm,
		schemaIsReader: true,
		runtime: new Set(['NODE_ENV']),
		readElsewhere: new Map(),
		// Build-time variables: in .env.example for local builds, never in the
		// app's schema, because nothing inside the app reads them. Never
		// EXPO_PUBLIC_: they are secrets for the builder, not the bundle.
		exampleOnly: new Map([
			['SENTRY_AUTH_TOKEN', "Sentry's build plugin reads it to upload source maps"]
		])
	}
}

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx'])
const SKIP_DIR = new Set(['node_modules', '__tests__', 'ios', 'android', '.next', '.expo'])
const READ = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g
// `NAME=` at the start of a line. `# NAME=` counts as declared too: a variable
// left unset on purpose, because an empty value would override its default or
// shadow the name it falls back from.
const EXAMPLE_ENTRY = /^(?:# )?([A-Z][A-Z0-9_]*)=/gm

function walk(dir) {
	const files = []
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIR.has(entry) || entry.startsWith('.')) continue
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) files.push(...walk(path))
		else if (SOURCE_EXT.has(extname(path)) && !/\.test\.[jt]sx?$/.test(path)) files.push(path)
	}
	return files
}

function names(text, pattern) {
	return new Set([...text.matchAll(pattern)].map((match) => match[1]))
}

// A comment that mentions `process.env.X` is not a read. Crude but enough for
// this: block comments, and line comments that are not a URL's `://`.
function code(text) {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function checkWorkspace({ path, kind }) {
	const spec = KINDS[kind]
	if (spec == null) return [`${path}: unknown kind "${kind}" in ${CONFIG_FILE}`]
	const dir = join(ROOT, path)
	const schemaPath = join(dir, spec.schema)
	const examplePath = join(dir, '.env.example')
	const problems = []

	for (const [file, label] of [
		[schemaPath, spec.schema],
		[examplePath, '.env.example']
	]) {
		if (!existsSync(file)) problems.push(`${path}/${label} is missing`)
	}
	if (problems.length > 0) return problems

	const files = spec.sourceDirs
		.map((sub) => join(dir, sub))
		.filter((sub) => existsSync(sub))
		.flatMap(walk)
		.filter((file) => spec.schemaIsReader || file !== schemaPath)
	const used = new Set()
	for (const file of files) {
		for (const name of names(code(readFileSync(file, 'utf8')), READ)) used.add(name)
	}
	const inSchema = names(readFileSync(schemaPath, 'utf8'), spec.schemaEntry)
	const inExample = names(readFileSync(examplePath, 'utf8'), EXAMPLE_ENTRY)

	// A check that reads nothing passes. Make sure each input was found.
	for (const [count, what] of [
		[files.length, `no source files under ${spec.sourceDirs.join(', ')}`],
		[used.size, 'no process.env reads'],
		[inExample.size, 'no NAME= lines in .env.example'],
		[inSchema.size, `no entries in ${spec.schema}`]
	]) {
		if (count === 0) problems.push(`${path}: ${what} — refusing to pass`)
	}
	if (problems.length > 0) return problems

	const where = (name) =>
		`(in .env.example: ${inExample.has(name)}, in ${spec.schema}: ${inSchema.has(name)})`
	const app = [...used].filter((name) => !spec.runtime.has(name))
	const missing = app.filter((name) => !inExample.has(name) || !inSchema.has(name))
	const declared = new Set([...inExample, ...inSchema])
	const buildOnly = (name) => spec.exampleOnly.has(name) && !inSchema.has(name)
	const oneSided = [...declared].filter(
		(name) => (!inExample.has(name) || !inSchema.has(name)) && !buildOnly(name)
	)
	const unused = [...declared].filter(
		(name) => !used.has(name) && !spec.readElsewhere.has(name) && !buildOnly(name)
	)
	for (const name of spec.exampleOnly.keys()) {
		if (name.startsWith('EXPO_PUBLIC_')) {
			problems.push(`${path}: ${name} is build-only but named EXPO_PUBLIC_, so it ships in the app`)
		}
	}

	for (const name of missing) {
		problems.push(`${path}: ${name} is read but not declared ${where(name)}`)
	}
	for (const name of oneSided.filter((name) => !missing.includes(name))) {
		problems.push(`${path}: ${name} is declared in only one file ${where(name)}`)
	}
	for (const name of unused) {
		problems.push(
			`${path}: ${name} is declared but nothing reads it (remove it, or say where it is read in readElsewhere)`
		)
	}
	if (problems.length === 0) {
		console.log(
			`check-env ${path}: OK — ${app.length} variables read, ${declared.size} declared, all in ${spec.schema} and .env.example, none unused.`
		)
	}
	return problems
}

let workspaces
try {
	workspaces = JSON.parse(readFileSync(join(ROOT, CONFIG_FILE), 'utf8')).workspaces
} catch (error) {
	console.error(`check-env: cannot read ${CONFIG_FILE}: ${error.message}`)
	process.exit(1)
}
if (!Array.isArray(workspaces) || workspaces.length === 0) {
	console.error(`check-env: ${CONFIG_FILE} lists no workspaces — refusing to pass`)
	process.exit(1)
}

const problems = workspaces.flatMap(checkWorkspace)
if (problems.length > 0) {
	console.error(`\ncheck-env failed — ${problems.length} problem(s):`)
	for (const line of problems) console.error(`  - ${line}`)
	console.error(
		`\n  Declared means: the schema and .env.example both name it. See docs/ENV_SETUP.md.`
	)
	process.exit(1)
}
console.log(
	`check-env: ${workspaces.map((ws) => ws.path).join(', ')} checked (${relative(ROOT, join(ROOT, CONFIG_FILE))}).`
)
