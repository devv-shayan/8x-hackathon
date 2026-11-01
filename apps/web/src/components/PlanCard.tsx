import { Check } from 'lucide-react'
import type { Plan } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { PixelField } from './landing/pixel/PixelField'

/**
 * One plan, as a cell of the pricing grid. The featured plan opens on a strip of lime pixels
 * instead of a badge. A placeholder price says so.
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
	return (
		<div className={cn('flex h-full flex-col', className)}>
			<div aria-hidden="true" className="relative h-14 border-b border-[rgb(var(--l-hair))]">
				{plan.featured ? (
					<PixelField name="limeEdges" />
				) : (
					<span className="l-dots absolute inset-0 [animation:none]" />
				)}
			</div>
			<div className="flex flex-1 flex-col p-6 sm:p-8">
				<h3 className="l-mono text-[rgb(var(--l-ink))]">{plan.name}</h3>
				<p className="mt-2 text-sm text-[rgb(var(--l-muted))]">{plan.tagline}</p>

				<p className="mt-8 flex items-baseline gap-2">
					<span className="text-5xl font-medium leading-none tracking-[-0.03em]">
						{plan.featured ? <span className="l-hl">{plan.price}</span> : plan.price}
					</span>
					<span className="text-sm text-[rgb(var(--l-muted))]">/ {plan.cadence}</span>
				</p>
				{plan.isPricePlaceholder && (
					<p className="l-mono mt-3 w-fit border border-dashed border-[rgb(var(--l-faint))] px-2 py-0.5">
						Placeholder price
					</p>
				)}

				<ul className="mt-8 space-y-3 border-t border-[rgb(var(--l-hair))] pt-6">
					{plan.features.map((f) => (
						<li key={f} className="flex items-start gap-3 text-[15px] text-[rgb(var(--l-muted))]">
							<Check
								className="mt-0.5 h-4 w-4 flex-none text-[rgb(var(--l-ink))]"
								strokeWidth={2.5}
								aria-hidden="true"
							/>
							{f}
						</li>
					))}
				</ul>
				{children}
			</div>
		</div>
	)
}
