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
					title="Pick the plan that fits."
					lead="Start free and upgrade when it earns its place. Subscriptions are billed by the App Store or Google Play, and you can cancel there at any time."
				/>
				<div className="mt-14 sm:mt-16">
					<PricingMatrix />
				</div>

				<section className="mt-28 grid gap-12 sm:mt-36 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
					<h2 className="t-h1 max-w-[5.8em] text-balance">Questions, answered.</h2>
					<FaqList items={faqs} />
				</section>
			</Container>
		</PageShell>
	)
}
