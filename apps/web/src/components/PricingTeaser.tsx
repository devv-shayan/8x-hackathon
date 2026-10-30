import { ArrowRight } from 'lucide-react'
import { plans } from '@/lib/pricing'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { Container } from './Container'
import { PlanCard } from './PlanCard'
import { Lines } from './Lines'
import { TrackedLink } from './TrackedLink'
import { Ground } from './landing/Ground'
import { Reveal } from './motion/Reveal'

// 🎨 REPLACE: your pricing headline, one clause per line. The plans themselves
// live in src/lib/pricing.ts.
const HEADING = ['Free to start.', 'Pro when it earns its place.']

/** The landing page's plans: the same cards as /pricing, and the way there. */
export function PricingTeaser() {
	return (
		<section id="pricing" className="relative isolate bg-bg py-28 sm:py-36">
			<Ground washAt="right" />
			<Container>
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
					<Reveal className="min-w-0">
						<h2 className="t-h1">
							<Lines lines={HEADING} />
						</h2>
					</Reveal>
					<Reveal delay={90} className="flex-none lg:max-w-[22rem] lg:pb-2">
						<p className="max-w-[40ch] text-pretty leading-relaxed text-ink-secondary">
							Subscriptions are billed by the App Store or Google Play, so cancelling is always in
							your hands.
						</p>
						{/* `cta` is this event's declared discriminator. */}
						<TrackedLink
							href="/pricing"
							name={FUNNEL_EVENTS.ctaClicked}
							properties={{ cta: 'pricing_teaser' }}
							className="group mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink"
						>
							Compare plans
							<ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
						</TrackedLink>
					</Reveal>
				</div>

				<ol className="mt-14 grid gap-5 lg:grid-cols-3">
					{plans.map((plan, i) => (
						<Reveal as="li" key={plan.id} delay={i * 80}>
							<PlanCard plan={plan} />
						</Reveal>
					))}
				</ol>
			</Container>
		</section>
	)
}
