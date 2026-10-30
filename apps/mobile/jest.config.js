module.exports = {
	preset: 'jest-expo',
	// packages/brand has no runner of its own: its tests (the palette contrast
	// suite) run here, so `npm run mobile:test` — and CI — covers them.
	roots: ['<rootDir>', '<rootDir>/../../packages/brand'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1'
	},
	transformIgnorePatterns: [
		'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|posthog-react-native)'
	],
	// testPathPattern is a CLI flag, not a config key: Jest ignored it with a
	// validation warning and ran its defaults. testMatch is the config key, and
	// covers both places tests live: __tests__/ and *.test.ts(x) beside the code,
	// here and in packages/brand.
	testMatch: ['<rootDir>/**/*.test.[jt]s?(x)', '<rootDir>/../../packages/brand/**/*.test.[jt]s?(x)']
}
