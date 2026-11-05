import { useCallback, useEffect, useRef } from 'react'
import { router } from 'expo-router'
import type * as Notifications from 'expo-notifications'
import { track } from '@/lib/analytics'
import { loadNotifications } from '@/lib/push-support'

const STAGES = new Set(['5', '4', '3', '2', '1', 'due'])

function openReminder(response: Notifications.NotificationResponse) {
	const data = response.notification.request.content.data ?? {}
	const path = typeof data.path === 'string' ? data.path : ''
	if (path !== '/memory') return
	const gapId = typeof data.gap_id === 'string' ? data.gap_id : ''
	const stage = typeof data.stage === 'string' ? data.stage : ''
	if (gapId && STAGES.has(stage)) {
		track('memory_reminder_opened', { gap_id: gapId, stage })
	}
	router.push('/memory')
}

/**
 * A reminder opens Maya's memory. Mounted once the person is signed in, so a
 * tap before the navigator is ready waits, and the same tap is not opened twice.
 */
export function MemoryReminderOpener({ ready }: { ready: boolean }) {
	const seen = useRef<string | null>(null)
	const waiting = useRef<Notifications.NotificationResponse | null>(null)
	const readyRef = useRef(ready)
	readyRef.current = ready

	const open = useCallback((response: Notifications.NotificationResponse) => {
		const id = response.notification.request.identifier
		if (seen.current === id) return
		if (!readyRef.current) {
			waiting.current = response
			return
		}
		seen.current = id
		waiting.current = null
		openReminder(response)
	}, [])

	useEffect(() => {
		let subscription: { remove(): void } | null = null
		let gone = false
		// Expo Go and the browser get null here, and the module is never loaded.
		void loadNotifications().then((module) => {
			if (!module || gone) return
			module.setNotificationHandler({
				handleNotification: async () => ({
					shouldShowBanner: true,
					shouldShowList: true,
					shouldPlaySound: false,
					shouldSetBadge: false
				})
			})
			subscription = module.addNotificationResponseReceivedListener(open)
			module
				.getLastNotificationResponseAsync()
				.then((response) => {
					if (response && !gone) open(response)
				})
				.catch(() => {
					// A build without notification support has nothing to open.
				})
		})
		return () => {
			gone = true
			subscription?.remove()
		}
	}, [open])

	useEffect(() => {
		if (ready && waiting.current) open(waiting.current)
	}, [ready, open])

	return null
}
