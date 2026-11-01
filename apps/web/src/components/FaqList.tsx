'use client'

import { Plus } from 'lucide-react'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import type { Faq } from '@/lib/faq'
import { cn } from '@/lib/utils'

/**
 * Questions as <details> disclosures: they open before hydration and with the
 * keyboard, and each opening reports which question it was (`faq_opened`,
 * discriminated by `question`) so the most-asked objection is visible.
 */
export function FaqList({ items, className }: { items: Faq[]; className?: string }) {
	return (
		<div className={cn('border-y border-[rgb(var(--l-hair))]', className)}>
			{items.map((item) => (
				<details
					key={item.id}
					className="faq-item group border-b border-[rgb(var(--l-hair))] last:border-b-0"
					onToggle={(e) => {
						if (e.currentTarget.open) gaEvent(FUNNEL_EVENTS.faqOpened, { question: item.id })
					}}
				>
					<summary className="flex min-h-16 cursor-pointer items-center justify-between gap-6 py-5 text-left text-[17px] font-medium tracking-[-0.01em]">
						{item.question}
						<span className="grid h-9 w-9 flex-none place-items-center border border-[rgb(var(--l-hair))] transition-colors duration-fast group-open:border-[rgb(var(--l-ink))] group-open:bg-[rgb(var(--l-lime))]">
							<Plus
								className="faq-icon h-4 w-4 transition-transform duration-base ease-out"
								aria-hidden="true"
							/>
						</span>
					</summary>
					<p className="faq-answer max-w-[60ch] text-pretty pb-6 pr-14 leading-relaxed text-[rgb(var(--l-muted))]">
						{item.answer}
					</p>
				</details>
			))}
		</div>
	)
}
