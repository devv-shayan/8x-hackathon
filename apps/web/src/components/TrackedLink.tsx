'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { gaEvent } from '@/lib/analytics/client'
import type { AppEvent } from '@/lib/analytics/events'

/**
 * A link that fires an event on click, usable from a server component:
 *
 *   <TrackedLink href="/pricing" name={FUNNEL_EVENTS.ctaClicked} properties={{ cta: 'pricing_teaser' }}>
 */
export function TrackedLink({
	name,
	properties,
	onClick,
	...props
}: ComponentProps<typeof Link> & { name: AppEvent; properties?: Record<string, string> }) {
	return (
		<Link
			{...props}
			onClick={(e) => {
				gaEvent(name, properties)
				onClick?.(e)
			}}
		/>
	)
}
