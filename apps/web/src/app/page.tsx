import { PageShell } from '@/components/PageShell'
import { Hero } from '@/components/landing/Hero'
import { Story } from '@/components/landing/Story'
import { FeatureDescent } from '@/components/landing/FeatureDescent'
import { FaqSection } from '@/components/landing/FaqSection'
import { PricingTeaser } from '@/components/PricingTeaser'
import { CallToAction } from '@/components/CallToAction'
import { TrackEvent } from '@/components/TrackEvent'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'

export default function HomePage() {
	return (
		<PageShell isPadded={false}>
			{/* The top of the funnel. Every conversion rate this play reports uses
          this as its denominator, so it fires for guests too. */}
			<TrackEvent name={FUNNEL_EVENTS.landingView} />
			<Hero />
			<Story />
			<FeatureDescent />
			<PricingTeaser />
			<FaqSection />
			<CallToAction />
		</PageShell>
	)
}
