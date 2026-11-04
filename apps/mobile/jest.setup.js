/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('expo-notifications', () => ({
	setNotificationHandler: () => undefined,
	getPermissionsAsync: async () => ({ granted: false }),
	requestPermissionsAsync: async () => ({ granted: false }),
	getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[test]' }),
	setNotificationChannelAsync: async () => undefined,
	addNotificationResponseReceivedListener: () => ({ remove() {} }),
	getLastNotificationResponseAsync: async () => null,
	AndroidImportance: { DEFAULT: 3 }
}))
