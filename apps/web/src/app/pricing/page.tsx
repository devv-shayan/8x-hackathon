import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { FaqList } from '@/components/FaqList'
import { PageHeader, PageShell } from '@/components/PageShell'
import { PricingMatrix } from '@/components/PricingMatrix'
import { TrackEvent } from '@/components/TrackEvent'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { faqs } from '@/lib/faq'

export const metadata: Metadata = {
	title: 'Pricing',
	description: 'Start free, and upgrade when it earns its place.'
}

export default function PricingPage() {
	return (
		<PageShell>
			{/* Intent signal. The gap between this and checkout_started is the drop
          that never reached a payment sheet. */}
			<TrackEvent name={FUNNEL_EVENTS.pricingView} />
			<Container className="pb-28 sm:pb-36">
				<PageHeader
					label="Pricing"
					title="Pick the plan that fits."
					highlight="fits"
					lead="Start free and upgrade when it earns its place. Subscriptions are billed by the App Store or Google Play, and you can cancel there at any time."
				/>
				<div className="mt-14 sm:mt-16">
					<PricingMatrix />
				</div>

				<section className="mt-24 grid gap-10 sm:mt-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
					<h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.03em]">
						Questions, answered.
					</h2>
					<FaqList items={faqs} />
				</section>
			</Container>
		</PageShell>
	)
}
