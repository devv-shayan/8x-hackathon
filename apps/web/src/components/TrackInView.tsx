'use client'

import { useEffect, useRef } from 'react'
import { gaEvent } from '@/lib/analytics/client'
import type { AppEvent } from '@/lib/analytics/events'

/** Share of the marker that must be on screen before the event fires. */
const THRESHOLD = 0.35

/**
 * Fire an event once per page view, the first time this marker scrolls into
 * view. Render it as the first child of the section being measured:
 *
 *   <TrackInView name={FUNNEL_EVENTS.storyView} />
 *
 * The marker is an empty, full-height, absolutely positioned layer, so its
 * parent needs `position: relative`.
 */
export function TrackInView({ name }: { name: AppEvent }) {
	const ref = useRef<HTMLSpanElement>(null)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return
				gaEvent(name)
				io.disconnect()
			},
			{ threshold: THRESHOLD }
		)
		io.observe(el)
		return () => io.disconnect()
	}, [name])

	return (
		<span
			ref={ref}
			aria-hidden="true"
			className="pointer-events-none absolute inset-x-0 top-0 h-[60vh]"
		/>
	)
}
