/**
 * Haptics named for what they MEAN, so the same feeling marks the same moment
 * everywhere. Plain functions (not a hook) so they can be called from anywhere,
 * including runOnJS at the end of a Reanimated worklet.
 *
 * No-op on web; every failure is swallowed (a device without a Taptic Engine
 * must never throw from a button press). The in-app switch (Settings →
 * Haptics) is persisted and read once at launch by the root layout.
 */
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'

const supported = Platform.OS !== 'web'
const KEY = 'app:haptics:v1'
let enabled = supported
let preference = true

/** Honour the in-app "Haptics" setting for this session. */
export function setHapticsEnabled(on: boolean) {
	preference = on
	enabled = supported && on
}

/** The person's choice (true until they turn haptics off). */
export function hapticsPreference(): boolean {
	return preference
}

/** Read the stored choice once per launch. Never throws. */
export async function loadHapticsPref(): Promise<void> {
	try {
		const raw = await AsyncStorage.getItem(KEY)
		if (raw === 'off') setHapticsEnabled(false)
	} catch {
		// Keep the default: on.
	}
}

/** Apply and persist a choice. A write that fails still applies for this session. */
export async function saveHapticsPref(on: boolean): Promise<void> {
	setHapticsEnabled(on)
	try {
		await AsyncStorage.setItem(KEY, on ? 'on' : 'off')
	} catch {
		// Non-fatal.
	}
}

function run(fire: () => Promise<void>) {
	if (!enabled) return
	try {
		fire().catch(() => {})
	} catch {
		// Native module missing (tests, Expo Go edge cases): stay silent.
	}
}

export const haptic = {
	/** Press-in on a button or card — call synchronously in onPressIn. */
	press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
	/** A pick: tab switch, segmented control, list choice, slider tick. */
	select: () => run(() => Haptics.selectionAsync()),
	/** Something lands: a sheet snaps, a card is kept, a drag settles. */
	snap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
	/** A pull-to-refresh release, or another big physical moment. */
	refresh: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
	/** It worked: purchase, save, completion. */
	success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
	/** Careful: destructive confirm, or a refused action (pair with shake()). */
	warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
	/** It failed: validation or network error. */
	error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
} as const

export type HapticMeaning = keyof typeof haptic
