import i18n, { changeLanguage, use as addPlugin } from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

import en from '../locales/en.json'
// TODO: add more languages by importing their JSON and adding to `resources`
// import es from '../locales/es.json'

const LANG_KEY = 'app_language'

export const SUPPORTED_LOCALES = ['en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const localeNames: Record<Locale, string> = {
	en: 'English'
	// es: 'Español',
}

let _initialized = false

export async function initI18n() {
	if (_initialized) return
	_initialized = true

	const saved = await AsyncStorage.getItem(LANG_KEY)
	const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en'
	const initial: Locale =
		(saved as Locale) ??
		(SUPPORTED_LOCALES.includes(deviceLang as Locale) ? (deviceLang as Locale) : 'en')

	// The named exports are the default instance's own methods, bound to it by
	// i18next, so this is i18n.use(...) (and changeLanguage below is
	// i18n.changeLanguage). `use` is renamed only because React's hook rules
	// claim any function called use().
	await addPlugin(initReactI18next).init({
		resources: {
			en: { translation: en }
			// es: { translation: es },
		},
		lng: initial,
		fallbackLng: 'en',
		interpolation: { escapeValue: false },
		compatibilityJSON: 'v4'
	})
}

export async function setLanguage(locale: Locale) {
	await AsyncStorage.setItem(LANG_KEY, locale)
	await changeLanguage(locale)
}

export function getCurrentLocale(): Locale {
	return (i18n.language as Locale) ?? 'en'
}

export default i18n
