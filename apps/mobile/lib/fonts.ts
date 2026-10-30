/**
 * Font files for expo-font, keyed by the names packages/brand uses.
 *
 * Imports are per weight (`…/600SemiBold`), not the package root: a root
 * import pulls every weight and italic of the family into the bundle.
 *
 * Both presets' display faces are registered here so switching `preset` in
 * brand.config.ts needs no code change; only the active preset's files are
 * LOADED at startup (see presetFonts). A play that settles on one preset can
 * delete the other preset's two imports (Source Serif ~0.66 MB, Bricolage
 * ~0.18 MB) from the bundle.
 *
 * JavaScript and font assets only — no native code — so this ships OTA.
 */
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold'
// dusk display
import { SourceSerif4_400Regular } from '@expo-google-fonts/source-serif-4/400Regular'
import { SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4/600SemiBold'
// daylight display
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold'
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold'
import { theme } from '@app/brand'

type FontSource = number

const FONT_FILES: Record<string, FontSource> = {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	Inter_700Bold,
	Inter_800ExtraBold,
	SourceSerif4_400Regular,
	SourceSerif4_600SemiBold,
	BricolageGrotesque_700Bold,
	BricolageGrotesque_800ExtraBold
}

/** The files the active preset uses, ready for useFonts(). */
export const presetFonts: Record<string, FontSource> = Object.fromEntries(
	[theme.fonts.text, theme.fonts.display]
		.flatMap((family) => Object.values(family.files))
		.map((key) => {
			const file = FONT_FILES[key]
			if (file === undefined) {
				throw new Error(
					`lib/fonts.ts: packages/brand asks for font "${key}" but it is not imported here.`
				)
			}
			return [key, file]
		})
)
