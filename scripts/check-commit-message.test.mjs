import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCommitMessage } from './check-commit-message.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

test('accepts a well-formed conventional commit', () => {
	assert.equal(validateCommitMessage('feat(auth): add magic link sign-in').valid, true)
})

test('accepts a breaking-change marker', () => {
	assert.equal(validateCommitMessage('feat(api)!: drop v1 endpoints').valid, true)
})

test('accepts exempt merge/revert commits regardless of format', () => {
	assert.equal(validateCommitMessage("Merge branch 'main' into feature").valid, true)
})

test('rejects a missing type', () => {
	assert.equal(validateCommitMessage('update the login page').valid, false)
})

test('rejects a capitalized subject', () => {
	assert.equal(validateCommitMessage('fix(auth): Add missing redirect').valid, false)
})

test('rejects a trailing period', () => {
	assert.equal(validateCommitMessage('fix(auth): add missing redirect.').valid, false)
})

test('rejects a header over 72 characters', () => {
	const long = 'feat(auth): ' + 'a'.repeat(70)
	assert.equal(validateCommitMessage(long).valid, false)
})

test('accepts every curated scope, and no scope at all', () => {
	for (const scope of ['mobile', 'web', 'paywall', 'ota', 'store', 'deps']) {
		assert.equal(validateCommitMessage(`fix(${scope}): handle the empty state`).valid, true, scope)
	}
	assert.equal(validateCommitMessage('chore: bump the lockfile').valid, true)
})

test('rejects a scope outside the curated list', () => {
	assert.equal(validateCommitMessage('feat(search): add fuzzy matching').valid, false)
})

test('judges a nested scope by its first segment', () => {
	assert.equal(validateCommitMessage('fix(mobile/settings): align the rows').valid, true)
	assert.equal(validateCommitMessage('fix(search/index): rebuild on boot').valid, false)
})

test('accepts the merge commits GitHub writes', () => {
	// The merge button's commit, and the synthetic merge a pull_request
	// checkout sits on, which `--range origin/main..HEAD` includes.
	assert.equal(
		validateCommitMessage('Merge pull request #3 from acme/chore/prettier-eslint').valid,
		true
	)
	assert.equal(validateCommitMessage('Merge 1a2b3c4d into 5e6f7a8b').valid, true)
})

test('the cli judges the message when the script is invoked directly', () => {
	const dir = mkdtempSync(join(tmpdir(), 'commit-msg-'))
	const file = join(dir, 'msg')
	try {
		writeFileSync(file, 'fixes\n')
		const rejected = spawnSync(process.execPath, ['scripts/check-commit-message.mjs', file], {
			cwd: ROOT,
			encoding: 'utf8'
		})
		assert.equal(rejected.status, 1, rejected.stderr)
		assert.match(rejected.stderr, /Invalid commit message/)

		writeFileSync(file, 'fix(ci): run the commit message check on windows\n')
		const accepted = spawnSync(process.execPath, ['scripts/check-commit-message.mjs', file], {
			cwd: ROOT,
			encoding: 'utf8'
		})
		assert.equal(accepted.status, 0, accepted.stderr)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
