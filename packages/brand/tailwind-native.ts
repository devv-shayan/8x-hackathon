/**
 * NativeWind colours for apps/mobile/tailwind.config.js — the active preset's
 * primary-scheme values (React Native has no CSS variables). Runtime theming
 * (light/dark switching) goes through the ThemeProvider, not class names.
 */

import { theme } from './index'
import { nativeColors } from './src/tailwind'

export const colors = nativeColors(theme)
