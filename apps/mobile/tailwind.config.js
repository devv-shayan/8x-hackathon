/** @type {import('tailwindcss').Config} */

// 🎨 BRAND: colours come from packages/brand (edit packages/brand/brand.config.ts).
// No hex values belong here. These are the active preset's primary-scheme
// values — React Native has no CSS variables, so NativeWind classes do not
// follow a light/dark switch; runtime theming goes through the ThemeProvider
// (contexts/ThemeContext.tsx).
const { colors } = require('@app/brand/tailwind-native')

module.exports = {
	content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
	presets: [require('nativewind/preset')],
	theme: {
		extend: { colors }
	},
	plugins: []
}
