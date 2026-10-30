import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// fingerprint.config.js decides which eas.json edits change the runtime version
// (docs/rules/ota.md). It may leave out `submit` and formatting, and nothing else:
// a build profile change that the runtime version missed would send an update to
// binaries that were built differently.

type HashSource = { type: string; id: string; contents: string; reasons: string[] }
type FingerprintConfig = { ignorePaths: string[]; extraSources: HashSource[] }

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the file @expo/fingerprint requires
const config: FingerprintConfig = require('../fingerprint.config.js')
const eas = JSON.parse(readFileSync(join(__dirname, '../eas.json'), 'utf8'))

describe('fingerprint.config.js', () => {
	it('ignores only eas.json, which it hashes as data instead', () => {
		expect(config.ignorePaths).toEqual(['eas.json'])
		expect(config.extraSources).toHaveLength(1)
		expect(config.extraSources[0]).toMatchObject({ type: 'contents', reasons: ['easBuild'] })
	})

	it('hashes every build profile and the cli block, and leaves out only submit', () => {
		const hashed = JSON.parse(config.extraSources[0].contents)
		const withoutSubmit = { ...eas }
		delete withoutSubmit.submit
		expect(hashed).toEqual(withoutSubmit)
		expect(Object.keys(hashed.build)).toEqual(expect.arrayContaining(Object.keys(eas.build)))
		expect(hashed.submit).toBeUndefined()
	})
})
