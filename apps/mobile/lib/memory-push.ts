import { useCallback, useRef } from 'react'
import { Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { api } from '@/lib/api'
import { log } from '@/lib/logger'

const ASKED = 'memory-push-asked'
const PLACEHOLDER = 'REPLACE_'

/**
 * Asks for reminders the first time Maya's memory opens, then stores this
 * phone's Expo token. A refusal, a browser, or a build with no EAS project
 * leaves the board working and sends nothing.
 */
export function useMemoryPush() {
	const started = useRef(false)
	useFocusEffect(
		useCallback(() => {
			if (started.current) return
			started.current = true
			void registerMemoryPush()
		}, [])
	)
}

async function registerMemoryPush(): Promise<void> {
	if (Platform.OS !== 'ios' && Platform.OS !== 'android') return
	try {
		const projectId = easProjectId()
		if (!projectId) {
			log.warn('Maya memory reminders need an EAS project id before a phone can register', {
				source: 'memory-push'
			})
			return
		}
		const current = await Notifications.getPermissionsAsync()
		let granted = current.granted
		if (!granted) {
			const asked = await AsyncStorage.getItem(ASKED)
			if (asked) return
			await AsyncStorage.setItem(ASKED, '1')
			granted = (await Notifications.requestPermissionsAsync()).granted
		}
		if (!granted) return
		if (Platform.OS === 'android') {
			await Notifications.setNotificationChannelAsync('memory', {
				name: "Maya's memory",
				importance: Notifications.AndroidImportance.DEFAULT
			})
		}
		const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
		await api('registerPushToken', {
			body: { token, platform: Platform.OS }
		})
	} catch (error) {
		log.warn('Maya memory reminders were not registered', { source: 'memory-push', error })
	}
}

function easProjectId(): string | null {
	const extra: unknown = Constants.expoConfig?.extra
	const fromExtra =
		typeof extra === 'object' && extra !== null && 'eas' in extra
			? (extra as { eas?: { projectId?: unknown } }).eas?.projectId
			: undefined
	const fromEas = Constants.easConfig?.projectId
	const id = typeof fromExtra === 'string' ? fromExtra : fromEas
	if (!id || id.startsWith(PLACEHOLDER)) return null
	return id
}
