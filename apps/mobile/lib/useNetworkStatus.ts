import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'

/** Offline only when the OS says so; an unknown reachability is not "offline". */
export function isOffline(state: NetInfoState): boolean {
	return state.isConnected === false || state.isInternetReachable === false
}

/**
 * The device's connectivity: true online, false offline, and null until the
 * first reading arrives.
 *
 * null matters. Starting at `true` (as this hook once did) made a launch with
 * no connection read as "online" for the first frame, so anything that only
 * reacts to the first offline-after-online transition — the launch overlay —
 * never showed.
 */
export function useNetworkStatus(): boolean | null {
	const [online, setOnline] = useState<boolean | null>(null)

	useEffect(() => {
		let active = true
		NetInfo.fetch().then((state) => {
			if (active) setOnline(!isOffline(state))
		})
		const unsubscribe = NetInfo.addEventListener((state) => setOnline(!isOffline(state)))
		return () => {
			active = false
			unsubscribe()
		}
	}, [])

	return online
}
