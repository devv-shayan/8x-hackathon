import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
// Every colour, radius, shadow and easing in this preset is a CSS variable
// emitted from packages/brand (see src/app/layout.tsx), so utilities re-theme
// with the preset and scheme. Rebrand in packages/brand/brand.config.ts.
import brandPreset from '@app/brand/tailwind-preset'

const config: Config = {
	content: ['./src/app/**/*.{ts,tsx,mdx}', './src/components/**/*.{ts,tsx,mdx}'],
	presets: [brandPreset],
	plugins: [
		// A preset changes the world, not the layout: `dusk:` and `daylight:`
		// restyle material (glow or field, grain, weight) and may swap decorative,
		// aria-hidden scenery only. Never readable content, its order or the layout.
		plugin(({ addVariant }) => {
			addVariant('dusk', '[data-preset="dusk"] &')
			addVariant('daylight', '[data-preset="daylight"] &')
		})
	]
}

export default config
