#!/usr/bin/env node
// `npm run check:store`: the mechanical half of store review
// (docs/rules/store-review.md). The rules of the store-review table that can
// be decided by reading files, run against every Expo workspace in
// standards.config.json. The judgement half, reading the diff since the last
// store release, is the store-review skill (.claude/skills/store-review).
//
// Each rule here is a standard in scripts/check-standards.mjs, and this runs
// that implementation: one check, whether it is asked for as a standard or
// before a release. scripts/standards-exceptions.json applies the same way: a
// rule listed as pending prints `~` and passes, and a rule met while still
// listed fails, so the list only shrinks.
//
// Usage: node scripts/check-store-readiness.mjs [--root <dir>] [--json] [--strict]
//
// --strict fails pending rules too. CI runs without it, so a gap the template
// knowingly carries doesn't turn every pull request red. Before a store build
// or a submission, the store-review skill runs it with --strict: App Review
// doesn't read the exceptions file.
//
// Exit codes: 0 ready (every rule met, or pending without --strict), 1 not
// ready, or the config is unreadable.

import { pathToFileURL } from 'node:url'
import { CHECKS, evaluateStandards } from './check-standards.mjs'

// Each rule with the guideline App Review or Play enforces it under. The id is
// the standard's, in check-standards.mjs.
export const STORE_RULES = [
	{ id: 'ios-purpose-strings', guideline: 'Apple 5.1.1' },
	{ id: 'ios-privacy-manifest', guideline: 'Apple privacy manifests' },
	{ id: 'android-permissions-minimal', guideline: 'Play photo and video permissions' },
	{ id: 'att-when-tracking', guideline: 'Apple 5.1.2' },
	{ id: 'account-deletion-in-app', guideline: 'Apple 5.1.1(v), Play' },
	{ id: 'paywall-legal-links', guideline: 'Apple 3.1.2' },
	{ id: 'sign-in-with-apple', guideline: 'Apple 4.8' },
	{ id: 'mock-data-dev-only', guideline: 'Apple 2.1' }
]

export function checkStoreReadiness({ root = process.cwd(), strict = false } = {}) {
	const ids = STORE_RULES.map((rule) => rule.id)
	const missing = ids.filter(
		(id) => !CHECKS.some((check) => check.id === id && check.kinds?.includes('expo'))
	)
	if (missing.length > 0) {
		throw new Error(`check-standards.mjs has no expo standard named ${missing.join(', ')}`)
	}
	const report = evaluateStandards({ root, ids })
	const apps = report.workspaces.filter((ws) => ws.kind === 'expo')
	const guideline = Object.fromEntries(STORE_RULES.map((rule) => [rule.id, rule.guideline]))
	const results = report.results.map((result) => ({ ...result, guideline: guideline[result.id] }))
	// A run that judged nothing is not a pass.
	const problems = []
	if (apps.length === 0) {
		problems.push('standards.config.json lists no expo workspace, so there is no app to review')
	} else if (results.length !== ids.length * apps.length) {
		problems.push(`expected ${ids.length * apps.length} results, got ${results.length}`)
	}
	const blocking = results.filter(
		(result) =>
			result.status === 'unmet' ||
			result.status === 'stale' ||
			(strict && result.status === 'pending')
	)
	return {
		root: report.root,
		strict,
		apps,
		isReady: problems.length === 0 && blocking.length === 0 && report.unknown.length === 0,
		problems,
		unknown: report.unknown,
		results
	}
}

function main() {
	const args = process.argv.slice(2)
	const rootIndex = args.indexOf('--root')
	const root = rootIndex === -1 ? process.cwd() : args[rootIndex + 1]
	if (rootIndex !== -1 && !root) {
		console.error('Usage: check-store-readiness.mjs [--root <dir>] [--json] [--strict]')
		process.exit(1)
	}
	const strict = args.includes('--strict')

	let report
	try {
		report = checkStoreReadiness({ root, strict })
	} catch (error) {
		console.error(`check-store-readiness: ${error.message}`)
		process.exit(1)
	}

	if (args.includes('--json')) {
		console.log(JSON.stringify(report, null, 2))
		process.exit(report.isReady ? 0 : 1)
	}

	const MARK = { met: '✓', unmet: '✗', stale: '✗', pending: strict ? '✗' : '~', divergence: '~' }
	const idWidth = Math.max(...STORE_RULES.map((rule) => rule.id.length))
	const guidelineWidth = Math.max(...STORE_RULES.map((rule) => rule.guideline.length))
	console.log(
		`Store readiness${strict ? ' (strict)' : ''}: ${STORE_RULES.length} rules against ${report.root}`
	)
	for (const app of report.apps) {
		console.log(`\n${app.path}`)
		for (const result of report.results.filter((candidate) => candidate.workspace === app.path)) {
			console.log(
				`  ${MARK[result.status]} ${result.id.padEnd(idWidth)}  ${result.guideline.padEnd(guidelineWidth)}  ${result.title}`
			)
			if (result.status === 'pending' || result.status === 'divergence') {
				console.log(`      ${result.status}: ${result.note}`)
			}
			if (result.detail) console.log(`      ${result.detail}`)
		}
	}
	for (const problem of report.problems) console.log(`\n  ✗ ${problem}`)
	for (const key of report.unknown) {
		console.log(
			`\n  ✗ ${key}  listed as pending in scripts/standards-exceptions.json, but no such rule ran`
		)
	}
	console.log('')
	const count = (status) => report.results.filter((result) => result.status === status).length
	const summary = `${count('met')} of ${report.results.length} store rules met, ${count('pending')} pending.`
	if (!report.isReady) {
		console.error(
			`${summary} Not ready${strict && count('pending') > 0 ? ': with --strict, pending rules block a store build too' : ''}. ` +
				'docs/rules/store-review.md says what each rule needs; the store-review skill does the rest.'
		)
		process.exit(1)
	}
	console.log(`${summary} The judgement half is the store-review skill.`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main()
}
