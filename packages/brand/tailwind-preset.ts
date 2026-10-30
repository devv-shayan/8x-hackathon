/**
 * Tailwind preset for apps/web. Every value is a CSS variable emitted by
 * src/css.ts, so utilities re-theme with the preset and scheme.
 *
 *   import brandPreset from '@app/brand/tailwind-preset'
 *   export default { presets: [brandPreset], … }
 */

import { theme } from './index'
import { webPreset } from './src/tailwind'

const brandPreset = webPreset(theme.palettes[theme.primaryScheme])

export default brandPreset
