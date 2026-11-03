#!/usr/bin/env node
/**
 * Run every workspace typecheck at once.
 *
 * The root `typecheck` script used to start web, then mobile, then contract,
 * then brand, then pixel, each waiting for the one before it. The five
 * projects do not read each other's output. This runs the same `tsc --noEmit`
 * each workspace script runs, and fails if any of them fails.
 *
 * `tsc` is started through `node` on `typescript/bin/tsc`, not the `.bin`
 * shim. On Windows that shim is a `.cmd`, which Node will not spawn unless a
 * shell is used (see runBinary in check-standards.mjs). Concurrent `npm run`
 * is also avoided: several npm processes in this repo can fail on a file lock
 * while the code still typechecks.
 *
 * The pre-push hook keeps only the last 25 lines of a gate, so a failure
 * prints the failing compilers' own output and then one summary line.
 */

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const PROJECTS = [
	{ name: 'web', dir: 'apps/web', args: ['--noEmit'] },
	{ name: 'mobile', dir: 'apps/mobile', args: ['--noEmit'] },
	{ name: 'contract', dir: 'packages/contract', args: ['--noEmit', '-p', '.'] },
	{ name: 'brand', dir: 'packages/brand', args: ['--noEmit', '-p', '.'] },
	{ name: 'pixel', dir: 'packages/pixel', args: ['--noEmit', '-p', '.'] }
]

function runProject(project) {
	const cwd = join(ROOT, project.dir)
	let tsc
	try {
		tsc = createRequire(join(cwd, 'package.json')).resolve('typescript/bin/tsc')
	} catch (error) {
		return Promise.resolve({
			name: project.name,
			ok: false,
			out: `could not resolve typescript for ${project.dir}: ${error instanceof Error ? error.message : String(error)}\n`
		})
	}
	return new Promise((resolve) => {
		let out = ''
		let settled = false
		const finish = (result) => {
			if (settled) return
			settled = true
			resolve(result)
		}
		const child = spawn(process.execPath, [tsc, ...project.args], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe']
		})
		child.stdout.on('data', (chunk) => {
			out += chunk
		})
		child.stderr.on('data', (chunk) => {
			out += chunk
		})
		child.on('error', (error) => {
			finish({ name: project.name, ok: false, out: `${error.message}\n` })
		})
		child.on('close', (code, signal) => {
			const ok = code === 0 && signal == null
			finish({
				name: project.name,
				ok,
				out: ok ? '' : out || `tsc exited ${signal ?? code}\n`
			})
		})
	})
}

const results = await Promise.all(PROJECTS.map(runProject))
const failed = results.filter((result) => !result.ok)
if (failed.length > 0) {
	for (const result of failed) {
		process.stderr.write(result.out)
		if (!result.out.endsWith('\n')) process.stderr.write('\n')
	}
	process.stderr.write(`typecheck failed: ${failed.map((result) => result.name).join(', ')}\n`)
	process.exit(1)
}
