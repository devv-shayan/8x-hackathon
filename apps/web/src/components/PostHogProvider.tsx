'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

/**
 * Initialises PostHog on the client and emits a `$pageview` on every route
 * change. No-ops when PH_KEY is missing, so dev/preview builds stay clean.
 *
 * Keep the PostHog host in sync with the mobile app's EXPO_PUBLIC_POSTHOG_HOST,
 * or web and mobile events split across two projects.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
	const pathname = usePathname()
	const searchParams = useSearchParams()

	useEffect(() => {
		if (!PH_KEY) return
		if (posthog.__loaded) return
		posthog.init(PH_KEY, {
			api_host: PH_HOST,
			capture_pageview: false,
			defaults: '2025-05-24'
		})
	}, [])

	useEffect(() => {
		if (!PH_KEY) return
		if (typeof window === 'undefined') return
		const search = searchParams?.toString()
		const url = pathname + (search ? `?${search}` : '')
		posthog.capture('$pageview', { $current_url: window.location.origin + url })
	}, [pathname, searchParams])

	return <>{children}</>
}
