import AsyncStorage from '@react-native-async-storage/async-storage'

/** Matches apps/web/src/server/demo/local-demo.ts. Development skip-auth only. */
export const LOCAL_DEMO_BEARER = 'local-demo'

const STORAGE_KEY = '__dev_local_demo_auth__'

export async function enableLocalDemoAuth(): Promise<void> {
	if (!__DEV__) return
	await AsyncStorage.setItem(STORAGE_KEY, LOCAL_DEMO_BEARER)
}

export async function localDemoAccessToken(): Promise<string | null> {
	if (!__DEV__) return null
	return AsyncStorage.getItem(STORAGE_KEY)
}
