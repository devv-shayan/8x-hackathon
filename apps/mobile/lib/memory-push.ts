import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { api } from '@/lib/api'
import { log } from '@/lib/logger'
import { loadNotifications } from '@/lib/push-support'

const ASKED = 'memory-push-asked'
const PLACEHOLDER = 'REPLACE_'

/**
 * Asks for reminders the first time Maya's memory opens, then stores this
 * phone's Expo token. A refusal, a browser, Expo Go, or a build with no EAS
 * project leaves the board working and sends nothing. True once this phone is set to
 * get the notes, so the board shows its next one only when it will arrive.
 */
export function useMemoryPush(): boolean {
	const started = useRef(false)
	const [registered, setRegistered] = useState(false)
	useFocusEffect(
		useCallback(() => {
			if (started.current) return
			started.current = true
			void registerMemoryPush().then(setRegistered)
		}, [])
	)
	return registered
}

async function registerMemoryPush(): Promise<boolean> {
	if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false
	try {
		const Notifications = await loadNotifications()
		if (!Notifications) return false
		const projectId = easProjectId()
		if (!projectId) {
			log.warn('Maya memory reminders need an EAS project id before a phone can register', {
				source: 'memory-push'
			})
			return false
		}
		const current = await Notifications.getPermissionsAsync()
		let granted = current.granted
		if (!granted) {
			const asked = await AsyncStorage.getItem(ASKED)
			if (asked) return false
			await AsyncStorage.setItem(ASKED, '1')
			granted = (await Notifications.requestPermissionsAsync()).granted
		}
		if (!granted) return false
		if (Platform.OS === 'android') {
			await Notifications.setNotificationChannelAsync('memory', {
				name: 'Class memory',
				importance: Notifications.AndroidImportance.DEFAULT
			})
		}
		const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
		await api('registerPushToken', {
			body: { token, platform: Platform.OS }
		})
		return true
	} catch (error) {
		log.warn('Maya memory reminders were not registered', { source: 'memory-push', error })
		return false
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
