import { Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

type NotificationsModule = typeof import('expo-notifications')

/**
 * Whether this run of the app can get Maya's reminders: a build made with EAS, so an App Store
 * or Google Play build, TestFlight, an internal build or a development build. Not Expo Go,
 * which has had no remote push since SDK 53 and errors when the module is used, and not the
 * browser. Every push call goes through `loadNotifications`, so Expo Go never loads the module.
 */
export const PUSH_SUPPORTED =
	(Platform.OS === 'ios' || Platform.OS === 'android') &&
	Constants.executionEnvironment !== ExecutionEnvironment.StoreClient

let loading: Promise<NotificationsModule | null> | undefined

/** expo-notifications, loaded on first use where push works; null everywhere else. */
export function loadNotifications(): Promise<NotificationsModule | null> {
	if (!PUSH_SUPPORTED) return Promise.resolve(null)
	loading ??= import('expo-notifications').catch(() => null)
	return loading
}
