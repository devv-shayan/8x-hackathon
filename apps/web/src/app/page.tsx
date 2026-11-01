import { PageShell } from '@/components/PageShell'
import { Hero } from '@/components/landing/Hero'
import { FaqSection } from '@/components/landing/FaqSection'
import { TrackEvent } from '@/components/TrackEvent'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'

export default function HomePage() {
	return (
		<PageShell isPadded={false}>
			{/* The top of the funnel. Every conversion rate this play reports uses
          this as its denominator, so it fires for guests too. */}
			<TrackEvent name={FUNNEL_EVENTS.landingView} />
			<Hero />
			<FaqSection />
		</PageShell>
	)
}
