/**
 * Demo content for development builds, and nothing at all in a release build.
 *
 * lib/mockData.ts holds the demo values a few screens show while they have no
 * real source yet (the stats panel, the profile's role line, the paywall's
 * preview plans). The data hooks never use it: their data comes from the API,
 * and a screen with no backend says so. None of it may reach a store build:
 * placeholder content is an App Store 2.1 rejection.
 *
 * `__DEV__` is false in every release build, preview and production alike.
 * Metro inlines it and folds the branch away before it collects dependencies,
 * so mockData.ts is not in a release bundle at all, not merely unused. Check
 * with `npx expo export --platform ios --no-bytecode` and grep the bundle.
 *
 * This is the one file that loads mockData.ts. Everything else reads mock
 * content through `devPlaceholders`, and must render something sensible when
 * it is null (an empty list, a blank field, a hidden section).
 */
import type * as MockData from './mockData'

let placeholders: typeof MockData | null = null
if (__DEV__) {
	// A require, not an import: an import is hoisted and always bundled.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	placeholders = require('./mockData') as typeof MockData
}

export const devPlaceholders = placeholders
