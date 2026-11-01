'use client'

import Link from 'next/link'
import { plans } from '@/lib/pricing'
import { APP_URL } from '@/lib/stores'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { PlanCard } from './PlanCard'
import { PRIMARY_BUTTON } from './formStyles'

export function PricingMatrix() {
	return (
		<ol className="grid border border-[rgb(var(--l-hair))] lg:grid-cols-3">
			{plans.map((plan) => (
				<li
					key={plan.id}
					className="border-b border-[rgb(var(--l-hair))] last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
				>
					<PlanCard plan={plan}>
						{/* `plan` is this event's declared discriminator, so each tier gets
                its own row. Without it every tier after the first click of the
                day would be dropped and the "most selected plan" would just be
                whichever one people happened to click first. */}
						<div className="mt-auto pt-8">
							<Link
								href={APP_URL}
								onClick={() => gaEvent(FUNNEL_EVENTS.planSelected, { plan: plan.id })}
								className={cn(
									'w-full',
									plan.featured
										? PRIMARY_BUTTON
										: 'inline-flex min-h-11 items-center justify-center gap-2 border border-[rgb(var(--l-ink))] px-5 text-sm font-medium transition-colors duration-fast hover:bg-[rgb(var(--l-wash))]'
								)}
							>
								<span aria-hidden="true">&gt;</span>
								{plan.cta}
							</Link>
						</div>
					</PlanCard>
				</li>
			))}
		</ol>
	)
}
