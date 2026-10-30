'use client'

import Link from 'next/link'
import { plans } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { PlanCard } from './PlanCard'

export function PricingMatrix() {
	return (
		<ol className="grid gap-5 lg:grid-cols-3">
			{plans.map((plan) => (
				<li key={plan.id}>
					<PlanCard plan={plan}>
						{/* `plan` is this event's declared discriminator, so each tier gets
                its own row. Without it every tier after the first click of the
                day would be dropped and the "most selected plan" would just be
                whichever one people happened to click first. */}
						<div className="mt-auto pt-8">
							<Link
								href="/#download"
								onClick={() => gaEvent(FUNNEL_EVENTS.planSelected, { plan: plan.id })}
								className={cn(
									'flex min-h-12 items-center justify-center rounded-button px-5 font-semibold transition-[transform,background-color] duration-fast active:scale-[0.96]',
									plan.featured
										? 'bg-brand text-on-brand hover:bg-brand-hover daylight:bg-ink daylight:text-ink-inverse daylight:hover:bg-ink/90'
										: 'border border-line-active text-ink hover:bg-surface2'
								)}
							>
								{plan.cta}
							</Link>
						</div>
					</PlanCard>
				</li>
			))}
		</ol>
	)
}
