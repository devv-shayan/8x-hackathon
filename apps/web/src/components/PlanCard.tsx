import { Check } from 'lucide-react'
import type { Plan } from '@/lib/pricing'
import { cn } from '@/lib/utils'

/**
 * One plan. Every card is the same shape; the featured one is marked by
 * material, not a badge: an accent edge on dusk, the marigold field on
 * daylight. A placeholder price says so.
 */
export function PlanCard({
	plan,
	className,
	children
}: {
	plan: Plan
	className?: string
	/** An action under the features (the pricing page's plan buttons). */
	children?: React.ReactNode
}) {
	const isFeatured = !!plan.featured
	const muted = isFeatured ? 'text-ink-secondary daylight:text-on-brand/80' : 'text-ink-secondary'
	return (
		<div
			className={cn(
				'relative flex h-full flex-col overflow-hidden rounded-card border p-7 sm:p-8',
				isFeatured
					? 'border-brand-border bg-surface2 shadow-raised daylight:border-transparent daylight:bg-brand daylight:text-on-brand'
					: 'border-line-soft bg-surface shadow-soft',
				className
			)}
		>
			{isFeatured && (
				<span
					aria-hidden="true"
					className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-ink to-transparent daylight:hidden"
				/>
			)}
			<h3 className="t-h3">{plan.name}</h3>
			<p className={cn('mt-1.5 text-sm', muted)}>{plan.tagline}</p>

			<p className="mt-8 flex items-baseline gap-2">
				<span className="t-number text-5xl leading-none">{plan.price}</span>
				<span className={cn('text-sm', muted)}>/ {plan.cadence}</span>
			</p>
			{plan.isPricePlaceholder && (
				<p
					className={cn(
						'mt-3 w-fit rounded-pill border border-dashed px-2.5 py-0.5 text-xs font-medium',
						isFeatured
							? 'border-line-active text-ink-secondary daylight:border-on-brand/40 daylight:text-on-brand/80'
							: 'border-line-active text-ink-secondary'
					)}
				>
					Placeholder price
				</p>
			)}

			<ul
				className={cn(
					'mt-8 space-y-3 border-t pt-6',
					isFeatured ? 'border-line-soft daylight:border-on-brand/20' : 'border-line-soft'
				)}
			>
				{plan.features.map((f) => (
					<li key={f} className={cn('flex items-start gap-3 text-[15px]', muted)}>
						<Check
							className={cn(
								'mt-0.5 h-4 w-4 flex-none',
								isFeatured ? 'text-brand-ink daylight:text-on-brand' : 'text-brand-ink'
							)}
							strokeWidth={2.5}
							aria-hidden="true"
						/>
						{f}
					</li>
				))}
			</ul>
			{children}
		</div>
	)
}
