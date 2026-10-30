// What the fingerprint runtime version hashes from eas.json. Read by @expo/fingerprint
// wherever the runtime version is computed: `eas build`, `eas update`, and the native
// build phase of a local Xcode or Gradle build. See docs/rules/ota.md → "What changes the
// runtime version".
//
// By default @expo/fingerprint hashes eas.json byte for byte, so a Prettier reformat or a
// new `submit` setting (an App Store Connect app id, a Play track) gives the next update a
// runtime version no installed build has: it publishes cleanly and reaches nobody.
//
// So eas.json is hashed as data instead: every build profile and every `cli` setting, key
// order and whitespace ignored. Only `submit` is left out: it configures `eas submit`, the
// upload to the stores, and nothing in it reaches a binary. Any build profile change still
// changes the runtime version, including ones that only look non-native (an Xcode image,
// a Node version, a channel). Never add a .fingerprintignore entry for eas.json: it would
// hide those too.
const fs = require('fs')

/** JSON with object keys sorted, so key order never changes the hash. */
function stableStringify(value) {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
	if (value !== null && typeof value === 'object') {
		const entries = Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
		return `{${entries.join(',')}}`
	}
	return JSON.stringify(value)
}

// A missing or invalid eas.json throws here; @expo/fingerprint then ignores this file and
// hashes eas.json whole, which only ever makes the runtime version change more often.
const buildRelevant = JSON.parse(fs.readFileSync(require.resolve('./eas.json'), 'utf8'))
delete buildRelevant.submit

/** @type {import('@expo/fingerprint').Config} */
module.exports = {
	ignorePaths: ['eas.json'],
	extraSources: [
		{
			type: 'contents',
			id: 'eas.json:without-submit',
			contents: stableStringify(buildRelevant),
			reasons: ['easBuild']
		}
	]
}
