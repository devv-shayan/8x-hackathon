#!/usr/bin/env node
/**
 * check-events — the gate that stops an event from being fired into a void.
 *
 * An event name that is not in the registry is rejected by /api/track with a 400
 * and disappears. Nothing surfaces anywhere a person would see, so the failure
 * mode is a number that reads as zero for months. Real plays have lost their
 * main funnel step exactly this way. This script makes that a build failure.
 *
 * It checks, across web and mobile:
 *   ERROR   an event is fired but not registered
 *   ERROR   a discriminator is declared for an event that does not exist
 *   ERROR   a Play Events API call uses a non-canonical event name
 *   WARN    an event is registered but never fired
 *
 * "Registered but never fired" is a warning, not an error: registering names
 * ahead of the UI that fires them is a legitimate pattern — it means the
 * whitelist is ready and no beacon 400s the day the screen lands.
 *
 * Run: npm run check:events
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Where the registries live. Missing files are skipped, so the same script
 *  works in the monorepo template and the web-only template. */
const WEB_REGISTRY = firstExisting([
	'apps/web/src/lib/analytics/events.ts',
	'lib/analytics/events.ts'
])
const MOBILE_REGISTRY = firstExisting(['apps/mobile/lib/analytics.ts'])
const PLAY_EVENTS_CLIENT = firstExisting([
	'apps/web/src/lib/plays/events.ts',
	'lib/plays/events.ts'
])
const TRACK_ROUTE = firstExisting(['apps/web/src/app/api/track/route.ts', 'app/api/track/route.ts'])

const SOURCE_DIRS = ['apps/web', 'apps/mobile', 'app', 'components', 'lib', 'contexts', 'hooks']
const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/
const SKIP_DIR = /(^|\/)(node_modules|\.next|\.expo|build|dist|coverage|ios|android)(\/|$)/

const errors = []
const warnings = []

// ── Collect what is registered ───────────────────────────────────────────────

const webRegistered = WEB_REGISTRY ? registryNames(read(WEB_REGISTRY)) : new Set()
const mobileRegistered = MOBILE_REGISTRY ? registryNames(read(MOBILE_REGISTRY)) : new Set()

/**
 * `GROUP.key` → the event name it resolves to, so a call site that passes a
 * registry constant (the preferred form) counts as firing that event. Without
 * this, every constant call site reads as "registered but never fired" and the
 * warning becomes noise nobody looks at.
 */
const webConstants = WEB_REGISTRY ? registryConstants(read(WEB_REGISTRY)) : new Map()

/** The canonical Play Events names, parsed from the client's union type so the
 *  two can't drift. */
const playCanonical = PLAY_EVENTS_CLIENT
	? registryNames(
			between(
				read(PLAY_EVENTS_CLIENT),
				'export type PlayEventName',
				'export type PlayEventEnvelope'
			)
		)
	: new Set()

if (!WEB_REGISTRY && !MOBILE_REGISTRY) {
	console.error(
		'check-events: no event registry found. Expected apps/web/src/lib/analytics/events.ts or lib/analytics/events.ts'
	)
	process.exit(1)
}

// ── Collect what is fired ────────────────────────────────────────────────────

/**
 * Emitters, and which registry each one's first string argument must be in.
 *
 * Only STRING LITERALS are checked. A call passing a registry constant
 * (`gaEvent(FUNNEL_EVENTS.pricingView)`) is correct by construction — the value
 * came from the registry — so there is nothing to verify.
 */
const EMITTERS = [
	{ re: /\bgaEvent\(\s*['"]([a-z0-9_]+)['"]/g, registry: 'web' },
	{ re: /\brecordUserEvent\(\s*[^,]+,\s*['"]([a-z0-9_]+)['"]/g, registry: 'web' },
	{ re: /\btrackPlayEvent\(\s*['"]([a-z0-9_]+)['"]/g, registry: 'play' },
	{ re: /\bplayEvent\(\s*['"]([a-z0-9_]+)['"]/g, registry: 'play' },
	{ re: /(?<![.\w])track\(\s*['"]([a-z0-9_]+)['"]/g, registry: 'mobile' }
]

/**
 * Call sites that pass a registry constant rather than a literal:
 * `gaEvent(FUNNEL_EVENTS.pricingView)`. Resolved through `webConstants`, and
 * correct by construction — the value came from the registry — so these only
 * mark an event as fired, they are never errors.
 */
const CONSTANT_CALLS = [
	// gaEvent(GROUP.key, …) and recordUserEvent(userId, GROUP.key, …)
	/\b(?:gaEvent|recordUserEvent|track)\(\s*(?:[^,()]*,\s*)?([A-Z][A-Z0-9_]*\.\w+)/g,
	// <TrackEvent name={GROUP.key} />
	/name=\{\s*([A-Z][A-Z0-9_]*\.\w+)\s*\}/g
]

const firedWeb = new Set()
const firedMobile = new Set()

for (const file of sourceFiles()) {
	const src = read(file)
	const rel = relative(ROOT, file)
	const isMobile = rel.startsWith('apps/mobile')

	for (const re of CONSTANT_CALLS) {
		re.lastIndex = 0
		let c
		while ((c = re.exec(src)) !== null) {
			const resolved = webConstants.get(c[1])
			if (resolved) (isMobile ? firedMobile : firedWeb).add(resolved)
		}
	}

	for (const { re, registry } of EMITTERS) {
		re.lastIndex = 0
		let m
		while ((m = re.exec(src)) !== null) {
			const name = m[1]
			const line = src.slice(0, m.index).split('\n').length

			if (registry === 'play') {
				if (!playCanonical.has(name)) {
					errors.push(
						`${rel}:${line}  "${name}" is not a canonical Play Events name.\n` +
							`    The platform only offers flows for names it recognises, so a local\n` +
							`    synonym means no email flow ever fires. See docs/EVENTS.md.`
					)
				}
				continue
			}

			// The mobile `track()` and any web emitter both resolve against their own
			// registry. Route by file location, not by the emitter name, so a shared
			// helper checked into the wrong app is still caught.
			if (isMobile || registry === 'mobile') {
				firedMobile.add(name)
				if (MOBILE_REGISTRY && !mobileRegistered.has(name)) {
					errors.push(
						`${rel}:${line}  "${name}" is fired but not in the mobile EventName union.\n` +
							`    Add it to ${relative(ROOT, MOBILE_REGISTRY)} before firing it.`
					)
				}
			} else {
				firedWeb.add(name)
				if (WEB_REGISTRY && !webRegistered.has(name)) {
					errors.push(
						`${rel}:${line}  "${name}" is fired but not registered.\n` +
							`    /api/track will reject it with a 400 and the data is gone silently.\n` +
							`    Add it to ${relative(ROOT, WEB_REGISTRY)} first — use the \`events\` skill.`
					)
				}
			}
		}
	}
}

// ── Discriminators must name real events ─────────────────────────────────────

if (TRACK_ROUTE) {
	const block = between(read(TRACK_ROUTE), 'EVENT_DISCRIMINATORS', '}\n')
	for (const name of block.matchAll(/^\s*([a-z0-9_]+)\s*:/gm)) {
		if (!webRegistered.has(name[1])) {
			errors.push(
				`${relative(ROOT, TRACK_ROUTE)}  EVENT_DISCRIMINATORS declares "${name[1]}", which is not a registered event.\n` +
					`    Either the event was renamed and this entry was left behind, or the\n` +
					`    event was never registered — in which case its beacon is being 400'd.`
			)
		}
	}
}

// ── Registered but never fired ───────────────────────────────────────────────

for (const name of webRegistered) {
	if (!firedWeb.has(name)) warnings.push(`web:    "${name}" is registered but never fired`)
}
for (const name of mobileRegistered) {
	if (!firedMobile.has(name)) warnings.push(`mobile: "${name}" is registered but never fired`)
}

// ── Report ───────────────────────────────────────────────────────────────────

const counts = `${webRegistered.size} web + ${mobileRegistered.size} mobile events registered`

if (warnings.length) {
	console.log(`\n⚠  Registered but not yet fired (${warnings.length}):`)
	for (const w of warnings) console.log(`   ${w}`)
	console.log('   Fine while the UI that fires them is still being built.')
}

if (errors.length) {
	console.error(
		`\n✖ check-events failed — ${errors.length} problem${errors.length > 1 ? 's' : ''}:\n`
	)
	for (const e of errors) console.error(`   ${e}\n`)
	console.error(`   ${counts}\n`)
	process.exit(1)
}

console.log(`\n✓ check-events passed — ${counts}, every fired event registered.\n`)

// ── Helpers ──────────────────────────────────────────────────────────────────

function read(p) {
	// Checkouts on Windows are CRLF. The scanners match on `\n`, so a `\r`
	// left in place makes a block run to EOF and treats later keys (`data`,
	// `path`, `country`) as event names.
	return readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
}

function firstExisting(paths) {
	for (const p of paths) {
		const abs = join(ROOT, p)
		if (existsSync(abs)) return abs
	}
	return null
}

/**
 * The event names a registry declares.
 *
 * Parses the two shapes deliberately rather than sweeping up every string
 * literal in the file: an earlier version matched any snake_case literal, which
 * both missed single-word names (`logout`, `purchase` — reported as fired but
 * unregistered, a false failure) and swept in incidental strings from comments
 * and config.
 *
 *   object form (web):   someKey: 'event_name',
 *   union form (mobile): | 'event_name'
 */
function registryNames(src) {
	const out = new Set()
	// Object form: only inside `export const X = { … } as const`. Scoping to the
	// declaration is what keeps incidental config out — `persistence: 'memory'`
	// in the PostHog setup is a key/string pair too, and a looser match reported
	// it as a registered event.
	for (const value of registryConstants(src).values()) out.add(value)
	// Union form.
	for (const m of src.matchAll(/^\s*\|\s*['"]([a-z][a-z0-9_]*)['"]/gm)) out.add(m[1])
	return out
}

/**
 * `GROUP.key` → event name, for every `export const GROUP = { … } as const`.
 *
 * Lets a call site written the preferred way — `gaEvent(FUNNEL_EVENTS.pricingView)`
 * — be recognised as firing `pricing_view`.
 */
function registryConstants(src) {
	const out = new Map()
	const decl = /export const ([A-Z][A-Z0-9_]*)\s*=\s*\{([\s\S]*?)\n\}\s*as const/g
	for (const [, group, body] of src.matchAll(decl)) {
		for (const [, key, value] of body.matchAll(/^\s*(\w+)\s*:\s*['"]([a-z][a-z0-9_]*)['"]/gm)) {
			out.set(`${group}.${key}`, value)
		}
	}
	return out
}

/** The slice of `src` between the first occurrence of `start` and the next
 *  `end` after it. Used to read one declaration without parsing TypeScript. */
function between(src, start, end) {
	const i = src.indexOf(start)
	if (i === -1) return ''
	const j = src.indexOf(end, i + start.length)
	return src.slice(i, j === -1 ? undefined : j)
}

function* sourceFiles() {
	for (const dir of SOURCE_DIRS) {
		const abs = join(ROOT, dir)
		if (!existsSync(abs)) continue
		yield* walk(abs)
	}
}

function* walk(dir) {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry)
		if (SKIP_DIR.test(p)) continue
		let st
		try {
			st = statSync(p)
		} catch {
			continue // a broken symlink shouldn't fail the gate
		}
		if (st.isDirectory()) yield* walk(p)
		else if (SOURCE_EXT.test(p)) yield p
	}
}
