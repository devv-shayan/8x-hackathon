// The synthetic monorepo the standards and store-readiness tests build their
// fixtures from, and the helpers that edit one. Shared, so the two suites
// judge the same app. Not a test file itself: node --test runs *.test.mjs.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const WEB = 'apps/web'
export const MOBILE = 'apps/mobile'

export function write(root, path, content) {
	mkdirSync(dirname(join(root, path)), { recursive: true })
	writeFileSync(
		join(root, path),
		typeof content === 'string' ? content : `${JSON.stringify(content, null, '\t')}\n`
	)
}

// A mutation that changes nothing tests nothing, so it fails the test instead
// of letting it pass on the unmodified fixture.
export function edit(root, path, transform) {
	const before = readFileSync(join(root, path), 'utf8')
	const after = transform(before)
	assert.notEqual(after, before, `the mutation of ${path} changed nothing`)
	writeFileSync(join(root, path), after)
}

export function editJson(root, path, mutate) {
	const value = JSON.parse(readFileSync(join(root, path), 'utf8'))
	mutate(value)
	write(root, path, value)
}

// ── A synthetic monorepo: one Next.js workspace, one Expo workspace ───────────
//
// Built from nothing, so each mobile standard gets a fixture that meets it and
// one that does not, whatever state this repo's own app is in. Nothing in it is
// shaped like a credential: env values are $VAR references, REPLACE_WITH_*
// placeholders or loopback URLs.

const REDACTED_WORDS = "['authorization', 'cookie', 'key', 'password', 'token']"

export const PURPOSE = {
	photosPermission: 'Fixture opens your photo library when you pick a picture for your profile.',
	cameraPermission: 'Fixture uses the camera when you take a picture for your profile.',
	microphonePermission: 'Fixture records sound only while you film a video to upload.'
}

export function privacyManifest(categories) {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<plist version="1.0">',
		'<dict>',
		'\t<key>NSPrivacyAccessedAPITypes</key>',
		'\t<array>',
		...categories.flatMap((category) => [
			'\t\t<dict>',
			'\t\t\t<key>NSPrivacyAccessedAPIType</key>',
			`\t\t\t<string>${category}</string>`,
			'\t\t</dict>'
		]),
		'\t</array>',
		'</dict>',
		'</plist>',
		''
	].join('\n')
}

export function androidManifest(permissions) {
	return [
		'<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
		...permissions.map(
			(name) => `\t<uses-permission android:name="${name}" android:maxSdkVersion="32" />`
		),
		'</manifest>'
	].join('\n')
}

const FAKE_PACKAGES = {
	expo: { dependencies: { '@expo/config-plugins': '1.0.0' } },
	'@expo/config-plugins': {},
	'react-native': {},
	'expo-image-picker': {},
	'expo-updates': {},
	'react-native-purchases': {},
	'@sentry/react-native': {},
	'@supabase/supabase-js': {},
	'expo-apple-authentication': {},
	zod: {}
}

// A login offering Google on the web and Sign in with Apple natively (Apple
// 4.8). Tests rewrite it to take either away.
export const LOGIN_SCREEN = [
	"import * as AppleAuthentication from 'expo-apple-authentication'",
	"import { Platform, Pressable, Text } from 'react-native'",
	"import { supabase } from '@/lib/supabase'",
	'',
	'async function signInWithGoogle() {',
	"\tawait supabase.auth.signInWithOAuth({ provider: 'google' })",
	'}',
	'',
	'async function signInWithApple() {',
	'\tconst credential = await AppleAuthentication.signInAsync({',
	'\t\trequestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL]',
	'\t})',
	'\tif (credential.identityToken) {',
	"\t\tawait supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })",
	'\t}',
	'}',
	'',
	'export default function Login() {',
	'\treturn (',
	'\t\t<>',
	'\t\t\t<Pressable onPress={signInWithGoogle}>',
	'\t\t\t\t<Text>Continue with Google</Text>',
	'\t\t\t</Pressable>',
	"\t\t\t{Platform.OS === 'ios' && (",
	'\t\t\t\t<Pressable onPress={signInWithApple}>',
	'\t\t\t\t\t<Text>Sign in with Apple</Text>',
	'\t\t\t\t</Pressable>',
	'\t\t\t)}',
	'\t\t</>',
	'\t)',
	'}',
	''
].join('\n')

// lib/devPlaceholders.ts as the template writes it: the one file that loads
// mockData.ts, and only inside if (__DEV__).
export const PLACEHOLDER_LOADER = [
	"import type * as MockData from './mockData'",
	'',
	'let placeholders: typeof MockData | null = null',
	'if (__DEV__) {',
	"\tplaceholders = require('./mockData') as typeof MockData",
	'}',
	'',
	'export const devPlaceholders = placeholders',
	''
].join('\n')

const MONOREPO_FILES = {
	'package.json': {
		name: 'fixture',
		private: true,
		workspaces: ['apps/*'],
		scripts: {
			'check:env': 'node scripts/check-env-vars.mjs',
			'check:store': 'node scripts/check-store-readiness.mjs'
		}
	},
	'standards.config.json': {
		workspaces: [
			{ path: WEB, kind: 'next' },
			{ path: MOBILE, kind: 'expo' }
		]
	},
	'scripts/check-env-vars.mjs': '// Checks every workspace listed in standards.config.json.\n',
	'.github/workflows/ci.yml': [
		'on:',
		'  pull_request:',
		'jobs:',
		'  check:',
		'    runs-on: ubuntu-latest',
		'    steps:',
		'      - run: npm run check:store',
		''
	].join('\n'),
	'.claude/skills/store-review/SKILL.md': [
		'---',
		'name: store-review',
		'description: Review mobile changes before an OTA update or a store build.',
		'---',
		''
	].join('\n'),
	'.claude/skills/ship/SKILL.md': 'When apps/mobile changed, run the store-review skill first.\n',
	'.claude/skills/local-review/SKILL.md':
		'When apps/mobile changed, run the store-review skill first.\n',
	'eslint.config.mjs': [
		'// A plugin stand-in: the checks read which rules are in effect, not what they find.',
		"const typescript = { rules: { 'no-explicit-any': { create: () => ({}) } } }",
		'export default [',
		'\t{',
		"\t\tfiles: ['apps/**/*.{ts,tsx}'],",
		"\t\tplugins: { '@typescript-eslint': typescript },",
		"\t\trules: { '@typescript-eslint/no-explicit-any': 'error', 'no-console': 'error' }",
		'\t},',
		'\t{',
		"\t\tfiles: ['apps/mobile/**/*.{ts,tsx}'],",
		'\t\trules: {',
		"\t\t\t'no-restricted-imports': ['error', { patterns: [{ group: ['@supabase/*'], message: 'Auth only.' }] }]",
		'\t\t}',
		'\t},',
		"\t{ files: ['apps/mobile/lib/supabase.ts'], rules: { 'no-restricted-imports': 'off' } },",
		"\t{ files: ['apps/mobile/lib/logger.ts'], rules: { 'no-console': 'off' } },",
		"\t{ files: ['apps/mobile/lib/env.ts'], rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] } },",
		']',
		''
	].join('\n'),

	[`${WEB}/package.json`]: { name: '@fixture/web', private: true },
	[`${WEB}/tsconfig.json`]: { compilerOptions: { strict: true } },
	[`${WEB}/.env.example`]: '# The web app reads no variables yet.\n',
	[`${WEB}/src/lib/env.ts`]:
		"import { z } from 'zod'\n\nexport const env = z.object({}).parse({})\n",
	[`${WEB}/src/server/lib/logger/redact.ts`]: `export const SENSITIVE_WORDS = new Set(${REDACTED_WORDS})\n`,

	[`${MOBILE}/package.json`]: {
		name: '@fixture/mobile',
		private: true,
		dependencies: Object.fromEntries(Object.keys(FAKE_PACKAGES).map((name) => [name, '1.0.0']))
	},
	[`${MOBILE}/tsconfig.json`]: {
		compilerOptions: { strict: true, jsx: 'react-jsx', paths: { '@/*': ['./*'] } }
	},
	[`${MOBILE}/app.json`]: {
		expo: {
			name: 'Fixture',
			slug: 'fixture',
			runtimeVersion: { policy: 'fingerprint' },
			updates: { url: 'https://u.expo.dev/REPLACE_WITH_YOUR_EAS_PROJECT_ID' },
			ios: {
				privacyManifests: {
					NSPrivacyAccessedAPITypes: [
						{
							NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
							NSPrivacyAccessedAPITypeReasons: ['CA92.1']
						},
						{
							NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
							NSPrivacyAccessedAPITypeReasons: ['C617.1']
						}
					]
				}
			},
			android: {
				permissions: [],
				blockedPermissions: [
					'android.permission.READ_EXTERNAL_STORAGE',
					'android.permission.WRITE_EXTERNAL_STORAGE'
				]
			},
			plugins: [['expo-image-picker', PURPOSE]]
		}
	},
	// Profiles name their EAS environment, where the values live
	// (docs/rules/secrets.md). APP_VARIANT is neither an app variable nor a
	// credential, so an env block may carry it.
	[`${MOBILE}/eas.json`]: {
		build: {
			development: { developmentClient: true, environment: 'development' },
			preview: { channel: 'preview', environment: 'preview', env: { APP_VARIANT: 'preview' } },
			production: {
				extends: 'preview',
				channel: 'production',
				environment: 'production',
				autoIncrement: true
			}
		}
	},
	[`${MOBILE}/.env.example`]:
		'EXPO_PUBLIC_SUPABASE_URL=\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\nEXPO_PUBLIC_SITE_URL=\n',
	[`${MOBILE}/lib/env.ts`]: [
		"import { z } from 'zod'",
		'',
		'const schema = z.object({',
		'\tEXPO_PUBLIC_SUPABASE_URL: z.string().url(),',
		'\tEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),',
		'\tEXPO_PUBLIC_SITE_URL: z.string().url()',
		'})',
		'',
		'// Static member reads: the only form Expo inlines into a release build.',
		'export const env = schema.parse({',
		'\tEXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,',
		'\tEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,',
		'\tEXPO_PUBLIC_SITE_URL: process.env.EXPO_PUBLIC_SITE_URL',
		'})',
		''
	].join('\n'),
	[`${MOBILE}/lib/logger.ts`]: [
		"import * as Sentry from '@sentry/react-native'",
		'',
		`const SENSITIVE_WORDS = new Set(${REDACTED_WORDS})`,
		'',
		'export function log(message: string, fields: Record<string, unknown> = {}) {',
		'\tconst safe = Object.fromEntries(',
		'\t\tObject.entries(fields).filter(([name]) => !SENSITIVE_WORDS.has(name))',
		'\t)',
		'\tif (__DEV__) console.log(message, safe)',
		'\telse Sentry.addBreadcrumb({ message, data: safe })',
		'}',
		''
	].join('\n'),
	[`${MOBILE}/lib/supabase.ts`]: [
		"import { createClient, type SupabaseClient } from '@supabase/supabase-js'",
		"import { env } from './env'",
		'',
		"export type AuthOnlySupabaseClient = Pick<SupabaseClient, 'auth' | 'storage'>",
		'',
		'export const supabase: AuthOnlySupabaseClient = createClient(',
		'\tenv.EXPO_PUBLIC_SUPABASE_URL,',
		'\tenv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
		')',
		''
	].join('\n'),
	[`${MOBILE}/lib/account.ts`]: [
		"import { env } from './env'",
		'',
		'export async function deleteAccount(): Promise<void> {',
		"\tconst response = await fetch(env.EXPO_PUBLIC_SITE_URL + '/api/delete-account', {",
		"\t\tmethod: 'POST'",
		'\t})',
		"\tif (!response.ok) throw new Error('Your account was not deleted.')",
		'}',
		''
	].join('\n'),
	[`${MOBILE}/components/Row.tsx`]: 'export function Row() {\n\treturn null\n}\n',
	[`${MOBILE}/app/(auth)/login.tsx`]: LOGIN_SCREEN,
	[`${MOBILE}/lib/mockData.ts`]: "export const demoItems = [{ id: '1', title: 'Demo item' }]\n",
	[`${MOBILE}/lib/devPlaceholders.ts`]: PLACEHOLDER_LOADER,
	[`${MOBILE}/hooks/useItems.ts`]: [
		"import { devPlaceholders } from '@/lib/devPlaceholders'",
		'',
		'export const placeholderItems = devPlaceholders?.demoItems ?? []',
		''
	].join('\n'),
	[`${MOBILE}/app/(tabs)/profile.tsx`]: [
		"import { router } from 'expo-router'",
		"import { Pressable, Text } from 'react-native'",
		'',
		'export default function Profile() {',
		'\treturn (',
		"\t\t<Pressable onPress={() => router.push('/settings')}>",
		'\t\t\t<Text>Settings</Text>',
		'\t\t</Pressable>',
		'\t)',
		'}',
		''
	].join('\n'),
	[`${MOBILE}/app/settings.tsx`]: [
		"import { Pressable, Text } from 'react-native'",
		"import { deleteAccount } from '@/lib/account'",
		'',
		'export default function Settings() {',
		'\treturn (',
		'\t\t<Pressable onPress={() => deleteAccount()}>',
		'\t\t\t<Text>Delete account</Text>',
		'\t\t</Pressable>',
		'\t)',
		'}',
		''
	].join('\n'),
	[`${MOBILE}/app/upgrade.tsx`]: [
		"import { router } from 'expo-router'",
		"import { Text } from 'react-native'",
		"import Purchases, { type PurchasesPackage } from 'react-native-purchases'",
		'',
		'export default function Upgrade({ offer }: { offer: PurchasesPackage }) {',
		'\treturn (',
		'\t\t<>',
		'\t\t\t<Text onPress={() => Purchases.purchasePackage(offer)}>Subscribe</Text>',
		'\t\t\t<Text onPress={() => Purchases.restorePurchases()}>Restore purchases</Text>',
		"\t\t\t<Text onPress={() => router.push('/terms')}>Terms of Use</Text>",
		"\t\t\t<Text onPress={() => router.push('/privacy')}>Privacy Policy</Text>",
		'\t\t</>',
		'\t)',
		'}',
		''
	].join('\n'),

	'node_modules/@expo/config-plugins/build/plugins/withAndroidBaseMods.js': [
		'// The AndroidManifest.xml expo prebuild starts every app from.',
		'const template = `',
		androidManifest([
			'android.permission.INTERNET',
			'android.permission.READ_EXTERNAL_STORAGE',
			'android.permission.WRITE_EXTERNAL_STORAGE'
		]),
		'`',
		'module.exports = { template }',
		''
	].join('\n'),
	'node_modules/react-native/React-Core.podspec': '# fixture\n',
	'node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy': privacyManifest([
		'NSPrivacyAccessedAPICategoryUserDefaults',
		'NSPrivacyAccessedAPICategoryFileTimestamp'
	]),
	'node_modules/expo-image-picker/ios/ExpoImagePicker.podspec': '# fixture\n',
	'node_modules/expo-image-picker/android/src/main/AndroidManifest.xml': androidManifest([
		'android.permission.CAMERA',
		'android.permission.READ_EXTERNAL_STORAGE'
	])
}

export function createMonorepoFixture() {
	const root = mkdtempSync(join(tmpdir(), 'check-standards-monorepo-'))
	for (const [path, content] of Object.entries(MONOREPO_FILES)) write(root, path, content)
	for (const [name, extra] of Object.entries(FAKE_PACKAGES)) {
		write(root, `node_modules/${name}/package.json`, { name, version: '1.0.0', ...extra })
	}
	// The real ESLint and tsc, so the checks read a config genuinely in effect.
	for (const name of ['eslint', 'typescript']) {
		symlinkSync(join(REPO_ROOT, 'node_modules', name), join(root, 'node_modules', name))
	}
	mkdirSync(join(root, 'node_modules/.bin'))
	symlinkSync(
		join(REPO_ROOT, 'node_modules/typescript/bin/tsc'),
		join(root, 'node_modules/.bin/tsc')
	)
	return root
}
