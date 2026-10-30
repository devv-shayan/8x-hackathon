/**
 * @app/brand — the single source of every colour, font, radius, shadow and
 * spring in the monorepo. Both apps import from here; neither keeps a copy.
 *
 *   import { theme, palette } from '@app/brand'
 *   theme.palettes.dark.brandFill      // role-typed colours, per scheme
 *   theme.type.h1                      // role scale (family, weight, size…)
 *   theme.motion.springs.snappy        // per-preset motion
 *
 * To rebrand, edit brand.config.ts — nothing else.
 */

import { brandConfig } from './brand.config'
import { buildTheme } from './src/theme'
import type { Palette, Scheme } from './src/types'

export * from './src/types'
export * from './src/color'
export { space, layout, TYPE_ROLES, HIT_TARGET } from './src/scale'
export { AA, AA_NON_TEXT, buildPalette, onColor } from './src/palette'
export { buildTheme, presets, SCHEMES } from './src/theme'
export { brandCss, colorRoles, WEB_FONT_VARS } from './src/css'
export { brandConfig }

/** The active theme: brand.config's preset with its accent. */
export const theme = buildTheme(brandConfig.preset, brandConfig.accent)

/** The active preset's palette for a scheme (defaults to the preset's primary scheme). */
export function palette(scheme: Scheme = theme.primaryScheme): Palette {
	return theme.palettes[scheme]
}
