'use client'

import { useEffect, useRef } from 'react'
import { gaEvent } from '@/lib/analytics/client'
import type { AppEvent } from '@/lib/analytics/events'

/**
 * Fire a view event when a page mounts, from a server component.
 *
 * Drop it into any page whose view is a funnel step:
 *
 *   <TrackEvent name={FUNNEL_EVENTS.pricingView} />
 *
 * Guarded against React 18 StrictMode's double-mount in development, which
 * would otherwise fire every view event twice locally and make the numbers you
 * are debugging against wrong.
 */
export function TrackEvent({
	name,
	properties
}: {
	name: AppEvent
	properties?: Record<string, unknown>
}) {
	const fired = useRef(false)

	useEffect(() => {
		if (fired.current) return
		fired.current = true
		gaEvent(name, properties)
		// `properties` is intentionally not a dependency: this fires once per mount,
		// and re-firing when an object literal gets a new identity on re-render is
		// exactly the bug that inflates view counts.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [name])

	return null
}
