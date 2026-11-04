/**
 * 🎨 BRAND — the one file a play edits to rebrand.
 *
 * Both apps read every colour, font, radius, shadow and spring from
 * packages/brand, and packages/brand reads its choices from here:
 *
 *   preset   the world: 'dusk' (dark, editorial, serif), 'daylight'
 *            (light, warm, bold grotesque) or 'landing' (the website's white,
 *            black and lime, with Inter Tight and JetBrains Mono). Structure,
 *            components and motion are shared; a preset changes the world, not
 *            the layout.
 *   accent   your brand colour as one hex. Every accent role (button fill,
 *            text-on-ground, text-on-fill, tints, borders, glow, gradient) is
 *            derived from it with WCAG AA contrast guaranteed by the contrast
 *            test — no hand-picked tints to keep in sync. 'default' uses the
 *            preset's own accent (luminous sky for dusk, marigold for daylight).
 *   names    what the app and the website are called.
 *
 * After changing the preset, also set apps/mobile/app.json to the new
 * preset's ground (its primary scheme's `ground.bg` in presets/), because
 * those values are baked into the native build and ship with the next store
 * build, not over the air:
 *
 *                         dusk              daylight          landing
 *   backgroundColor       '#090f1e'         '#f3f0e9'         '#ffffff'
 *   androidStatusBar
 *     barStyle            'light-content'   'dark-content'    'dark-content'
 *
 * backgroundColor goes in four places: `splash.backgroundColor`,
 * `android.adaptiveIcon.backgroundColor`, `androidStatusBar.backgroundColor`
 * and the `expo-splash-screen` plugin's `backgroundColor`. The mobile theme
 * test (apps/mobile/__tests__/theme.test.tsx) fails until all five match.
 */

import type { PresetName } from './src/types'

export const brandConfig: {
	preset: PresetName
	accent: string
	appName: string
	siteName: string
} = {
	// 🎨 BRAND: 'dusk' | 'daylight' | 'landing'
	preset: 'landing',
	// 🎨 BRAND: '#rrggbb', or 'default' for the preset's own accent
	accent: 'default',
	// 🎨 BRAND: app name (mobile) and site name (web). Keep them the same word
	// unless the site deliberately goes by another name: the website shows the
	// app's own screens, so two names read as two products.
	appName: 'Chalkback',
	siteName: 'Chalkback'
}
