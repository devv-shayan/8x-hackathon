import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	findTemplateLeaks,
	isTemplateRepository,
	reasonToReject,
	TEMPLATE_PACKAGE_NAME
} from './check-template-clean.mjs'

const SCRIPT = fileURLToPath(new URL('./check-template-clean.mjs', import.meta.url))

const LOG = '.claude-logs/2026-09-24_10-00-00_abcd1234.md'

test('the template may keep the log directory README and .gitkeep', () => {
	assert.equal(reasonToReject('.claude-logs/README.md'), null)
	assert.equal(reasonToReject('.claude-logs/.gitkeep'), null)
	assert.equal(reasonToReject('.codex-logs/.gitkeep'), null)
})

test('a session log is rejected, from either agent and at any depth', () => {
	assert.match(reasonToReject(LOG), /session log/)
	assert.match(reasonToReject('.codex-logs/session.md'), /session log/)
	assert.match(reasonToReject('apps/web/.claude-logs/session.md'), /session log/)
	assert.match(reasonToReject('.claude-logs/archive/README.md'), /session log/)
})

test('anything under .claude/worktrees is rejected, including a gitlink to the directory', () => {
	assert.match(reasonToReject('.claude/worktrees/agent-1234'), /worktree/)
	assert.match(reasonToReject('.claude/worktrees/agent-1234/package.json'), /worktree/)
	assert.match(reasonToReject('.claude/worktrees'), /worktree/)
})

test('ordinary files are not rejected', () => {
	for (const path of [
		'README.md',
		'.claude/settings.json',
		'.claude/skills/events/SKILL.md',
		'docs/rules/secrets.md',
		'scripts/claude-logs.mjs'
	]) {
		assert.equal(reasonToReject(path), null, path)
	}
})

test('the template reports every leak', () => {
	const leaks = findTemplateLeaks({
		packageName: TEMPLATE_PACKAGE_NAME,
		trackedFiles: ['README.md', '.claude-logs/README.md', LOG, '.claude/worktrees/agent-1']
	})
	assert.deepEqual(
		leaks.map((leak) => leak.path),
		[LOG, '.claude/worktrees/agent-1']
	)
})

test('a play (renamed root package) is never checked', () => {
	const leaks = findTemplateLeaks({
		packageName: 'my-play',
		trackedFiles: [LOG, '.claude/worktrees/agent-1']
	})
	assert.deepEqual(leaks, [])
})

// ---------------------------------------------------------------------------
// The CLI, against a throwaway git repository. Files only need to be in the
// index (`git add`) for `git ls-files` to list them, so nothing is committed.
// ---------------------------------------------------------------------------

function repoWith({ name, files }) {
	const root = mkdtempSync(join(tmpdir(), 'template-clean-'))
	const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
	assert.equal(git('init', '-q').status, 0)
	writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
	for (const file of files) {
		mkdirSync(dirname(join(root, file)), { recursive: true })
		writeFileSync(join(root, file), 'x\n')
	}
	assert.equal(git('add', '-A').status, 0)
	return root
}

function runCheck(root, extra = ['--template']) {
	const env = { ...process.env }
	delete env.GITHUB_REPOSITORY
	return spawnSync(process.execPath, [SCRIPT, '--root', root, ...extra], { encoding: 'utf8', env })
}

test('a copy of the template is told apart from the template itself', () => {
	assert.equal(isTemplateRepository({ githubRepository: '8xsocial/template-monorepo' }), true)
	assert.equal(isTemplateRepository({ githubRepository: 'someone/my-play' }), false)
	assert.equal(
		isTemplateRepository({ originUrl: 'git@github.com:8xsocial/template-monorepo.git' }),
		true
	)
	assert.equal(
		isTemplateRepository({ originUrl: 'https://github.com/8xsocial/template-monorepo' }),
		true
	)
	assert.equal(isTemplateRepository({ originUrl: 'https://github.com/pair-7/my-play.git' }), false)
	assert.equal(isTemplateRepository({ originUrl: '' }), false)
})

test('CLI: an unrenamed copy with committed logs passes', () => {
	const root = repoWith({ name: TEMPLATE_PACKAGE_NAME, files: ['.claude-logs/README.md', LOG] })
	try {
		const result = runCheck(root, [])
		assert.equal(result.status, 0, result.stderr)
		assert.match(result.stdout, /a copy of the template/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('CLI: the template with only the README passes', () => {
	const root = repoWith({ name: TEMPLATE_PACKAGE_NAME, files: ['.claude-logs/README.md'] })
	try {
		const result = runCheck(root)
		assert.equal(result.status, 0, result.stderr)
		assert.match(result.stdout, /tracks no session logs/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('CLI: the template with a committed log fails and names it', () => {
	const root = repoWith({ name: TEMPLATE_PACKAGE_NAME, files: ['.claude-logs/README.md', LOG] })
	try {
		const result = runCheck(root)
		assert.equal(result.status, 1)
		assert.match(result.stderr, new RegExp(LOG.replaceAll('.', '\\.')))
		assert.match(result.stderr, /git rm -r --cached/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('CLI: a play with committed logs passes without looking', () => {
	const root = repoWith({ name: 'my-play', files: ['.claude-logs/README.md', LOG] })
	try {
		const result = runCheck(root)
		assert.equal(result.status, 0, result.stderr)
		assert.match(result.stdout, /not the template/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('CLI: the template outside a git checkout refuses to pass', () => {
	const root = mkdtempSync(join(tmpdir(), 'template-clean-'))
	writeFileSync(join(root, 'package.json'), JSON.stringify({ name: TEMPLATE_PACKAGE_NAME }))
	try {
		const result = runCheck(root)
		assert.equal(result.status, 2)
		assert.match(result.stderr, /no tracked files/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})
