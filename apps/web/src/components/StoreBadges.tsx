'use client'

import { cn } from '@/lib/utils'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/stores'
import { Magnetic } from './motion/Magnetic'

/** Where on the page the buttons sit; rides to PostHog / GA4 with each click. */
export type StorePlacement = 'hero' | 'closing'

const STORES = [
	{
		store: 'app_store',
		href: APP_STORE_URL,
		kicker: 'Download on the',
		name: 'App Store',
		glyph: (
			<svg viewBox="0 0 17 20" className="h-[22px] w-[19px]" fill="currentColor" aria-hidden="true">
				<path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4ZM11.5 3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3.1-1.5Z" />
			</svg>
		)
	},
	{
		store: 'play_store',
		href: PLAY_STORE_URL,
		kicker: 'Get it on',
		name: 'Google Play',
		glyph: (
			<svg viewBox="0 0 18 20" className="h-[21px] w-[19px]" fill="currentColor" aria-hidden="true">
				<path d="M.6.4C.4.6.3 1 .3 1.4v17.2c0 .4.1.8.3 1l9.6-9.6L.6.4Zm10.6 10.6 2.9 2.9-11 6.3c-.4.2-.8.3-1.1.2l9.2-9.4Zm0-2L2 .1c.4-.1.7 0 1.1.2l11 6.3-2.9 2.4Zm4.2-.1 2.7 1.5c.8.5.8 1.2 0 1.7l-2.8 1.6-3-3 3.1-1.8Z" />
			</svg>
		)
	}
] as const

/**
 * The store buttons: the page's primary action. Ink pills (the inverse of the
 * ground) in both presets, so they read on the page, on the marigold field and
 * on the dusk band alike, each leaning toward the cursor. A store whose URL is
 * unset (src/lib/stores.ts) is left out.
 */
export function StoreBadges({
	placement,
	className
}: {
	placement: StorePlacement
	className?: string
}) {
	return (
		<div className={cn('flex flex-wrap items-center gap-3', className)}>
			{STORES.filter((s) => s.href !== '').map((s) => (
				<Magnetic key={s.store}>
					{/* `store` is this event's declared discriminator in
					    app/api/track/route.ts, so App Store and Play get their own
					    rows. `placement` is PostHog / GA4 only (see events.ts). */}
					<a
						href={s.href}
						target="_blank"
						rel="noopener noreferrer"
						onClick={() => gaEvent(FUNNEL_EVENTS.storeBadgeClicked, { store: s.store, placement })}
						className="flex h-[3.5rem] items-center gap-3 rounded-pill bg-ink pl-5 pr-6 text-ink-inverse shadow-cta transition-[transform,background-color] duration-fast hover:bg-ink/90 active:scale-[0.96]"
					>
						{s.glyph}
						<span className="text-left leading-none">
							<span className="block text-[11px] font-medium opacity-75">{s.kicker}</span>
							<span className="mt-1 block text-[17px] font-semibold tracking-[-0.01em]">
								{s.name}
							</span>
						</span>
					</a>
				</Magnetic>
			))}
		</div>
	)
}
