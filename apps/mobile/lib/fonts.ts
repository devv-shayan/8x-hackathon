/**
 * Font files for expo-font, keyed by the names packages/brand uses.
 *
 * Imports are per weight (`…/600SemiBold`), not the package root: a root
 * import pulls every weight and italic of the family into the bundle.
 *
 * The app is settled on the `landing` preset (Inter Tight and JetBrains Mono,
 * the website's faces), so only those files are imported. Switching to another
 * preset means importing its faces here first: presetFonts throws on a font the
 * preset asks for that is missing.
 *
 * JavaScript and font assets only — no native code — so this ships OTA.
 */
import { InterTight_400Regular } from '@expo-google-fonts/inter-tight/400Regular'
import { InterTight_500Medium } from '@expo-google-fonts/inter-tight/500Medium'
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold'
import { InterTight_700Bold } from '@expo-google-fonts/inter-tight/700Bold'
import { InterTight_800ExtraBold } from '@expo-google-fonts/inter-tight/800ExtraBold'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium'
import { theme } from '@app/brand'

type FontSource = number

const FONT_FILES: Record<string, FontSource> = {
	InterTight_400Regular,
	InterTight_500Medium,
	InterTight_600SemiBold,
	InterTight_700Bold,
	InterTight_800ExtraBold,
	JetBrainsMono_500Medium
}

/** The files the active preset uses, ready for useFonts(). */
export const presetFonts: Record<string, FontSource> = Object.fromEntries(
	[theme.fonts.text, theme.fonts.display, theme.fonts.mono]
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
