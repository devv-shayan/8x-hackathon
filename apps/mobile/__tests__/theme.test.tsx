/**
 * The mobile theme layer: typography and the Text primitive, the native
 * config that must follow the preset, and the rule that no colour lives
 * anywhere but packages/brand.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { palette, theme } from '@app/brand'
import { Type, familyFor, weightToFamily } from '@/lib/typography'
import { presetFonts } from '@/lib/fonts'
import { Text } from '@/components/ui/Text'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

const APP = join(__dirname, '..')

describe('typography', () => {
	it('maps weights to the nearest family file the preset loads', () => {
		expect(weightToFamily('bold')).toBe(theme.fonts.text.files[700])
		expect(weightToFamily(undefined)).toBe(theme.fonts.text.files[400])
		const display = theme.fonts.display.files
		for (const w of Object.keys(display)) {
			expect(familyFor('display', Number(w))).toBe(display[Number(w) as keyof typeof display])
		}
	})

	it('loads every family the role scale uses', () => {
		for (const style of Object.values(Type)) {
			expect(presetFonts[style.fontFamily as string]).toBeDefined()
		}
	})
})

describe('<Text>', () => {
	it('applies a role: family, size, cap on font scaling, default tone', () => {
		render(<Text variant="h1">Hello</Text>)
		const node = screen.getByText('Hello')
		const style = StyleSheet.flatten(node.props.style)
		expect(style.fontFamily).toBe(Type.h1.fontFamily)
		expect(style.fontSize).toBe(theme.type.h1.size)
		expect(style.color).toBe(palette().textPrimary)
		expect(style.includeFontPadding).toBe(false)
		expect(node.props.maxFontSizeMultiplier).toBe(theme.type.h1.maxScale)
	})

	it('maps a style weight to the family file', () => {
		render(<Text style={{ fontWeight: '600', color: 'red' }}>Plain</Text>)
		const style = StyleSheet.flatten(screen.getByText('Plain').props.style)
		expect(style.fontFamily).toBe(theme.fonts.text.files[600])
		expect(style.fontWeight).toBeUndefined()
		expect(style.color).toBe('red')
	})

	it('sets tabular figures on numbers', () => {
		render(<Text tabular>42</Text>)
		const style = StyleSheet.flatten(screen.getByText('42').props.style)
		expect(style.fontVariant).toContain('tabular-nums')
	})
})

describe('app.json follows the preset', () => {
	// The native splash, Android status bar and adaptive icon are baked into the
	// build and can't read packages/brand, so this pins them to it instead: a
	// play that changes `preset` is told here to update app.json too.
	const app = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')).expo
	const ground = palette(theme.primaryScheme).bg

	it('paints the splash, adaptive icon and status bar in the preset ground', () => {
		const splashPlugin = app.plugins.find(
			(p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen'
		)
		expect(app.splash.backgroundColor.toLowerCase()).toBe(ground)
		expect(splashPlugin[1].backgroundColor.toLowerCase()).toBe(ground)
		expect(app.android.adaptiveIcon.backgroundColor.toLowerCase()).toBe(ground)
		expect(app.android.androidStatusBar.backgroundColor.toLowerCase()).toBe(ground)
		expect(app.android.androidStatusBar.barStyle).toBe(
			palette().statusBarStyle === 'light' ? 'light-content' : 'dark-content'
		)
	})

	it('lets the system appearance reach the app', () => {
		expect(app.userInterfaceStyle).toBe('automatic')
	})
})

describe('no colour outside packages/brand', () => {
	const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b|\brgba?\(\s*\d/
	const DIRS = ['app', 'components', 'contexts', 'hooks', 'lib']

	function files(dir: string): string[] {
		return readdirSync(dir).flatMap((name) => {
			const path = join(dir, name)
			if (statSync(path).isDirectory()) return files(path)
			return /\.(ts|tsx)$/.test(name) ? [path] : []
		})
	}

	it('finds no hex or rgb() literal in app code', () => {
		const offenders = DIRS.flatMap((d) => files(join(APP, d))).flatMap((file) =>
			readFileSync(file, 'utf8')
				.split('\n')
				.map((line, i) => ({ line, at: `${relative(APP, file)}:${i + 1}` }))
				.filter(({ line }) => HEX.test(line))
				.map(({ at }) => at)
		)
		expect(offenders).toEqual([])
	})
})
