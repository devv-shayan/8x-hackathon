import { Check } from 'lucide-react'
import { IS_LIVE } from '@/lib/stores'
import type { CssVars } from '@/lib/utils'
import { Container } from '../Container'
import { StoreBadges } from '../StoreBadges'
import { WaitlistForm } from '../WaitlistForm'
import { DeviceFrame } from '../device/DeviceFrame'
import { HomeScreen } from '../device/screens/HomeScreen'
import { OnboardingScreen } from '../device/screens/OnboardingScreen'
import { WordRise } from '../motion/WordRise'
import { HeroDevice } from './HeroDevice'

// 🎨 REPLACE: your headline (one entry per display line; three short lines
// read best) and your one-line promise.
const HEADLINE = ['A calmer', 'way to get', 'things done.']
const PROMISE = 'See what is moving, pick up where you left off, and watch the work add up.'

/** Entrance timings, ms: the words rise first, then the action and the phone. */
const ACTIONS_AT = 480
const DEVICE_AT = 180

/**
 * The first viewport is the product: the app's own home screen at real
 * proportions, resting in a slight three-quarter turn, beside the headline and
 * the store buttons. Dusk: the phone stands in a wash of the accent under film
 * grain, with the onboarding screen on a second phone receding behind it.
 * Daylight: it stands on a marigold field that runs off the page, with one ink
 * chip riding its edge.
 */
export function Hero() {
	return (
		<section className="relative isolate overflow-hidden bg-bg">
			<span aria-hidden="true" className="grain -z-10" />
			<span aria-hidden="true" className="atmosphere absolute inset-0 -z-20 daylight:hidden" />

			<Container className="grid min-h-[100svh] items-center gap-14 pb-20 pt-28 sm:pt-32 lg:grid-cols-[1.12fr_0.88fr] lg:gap-6 lg:pb-16 lg:pt-28">
				<div className="relative">
					<WordRise as="h1" lines={HEADLINE} className="t-hero" />
					{/* No entrance: the promise is the largest text block on a phone, so it
					    paints at once and LCP never waits on an animation. */}
					<p className="t-lead mt-7 max-w-[36ch] text-pretty text-ink-secondary">{PROMISE}</p>
					<div className="enter mt-9" style={{ '--enter-delay': `${ACTIONS_AT}ms` } as CssVars}>
						{IS_LIVE ? (
							<>
								<StoreBadges placement="hero" />
								<p className="mt-5 text-sm text-ink-tertiary">On iPhone and Android.</p>
							</>
						) : (
							<div className="max-w-md">
								<WaitlistForm />
								<p className="mt-4 text-sm text-ink-tertiary">Coming to iPhone and Android.</p>
							</div>
						)}
					</div>
				</div>

				<div
					className="enter relative flex justify-center lg:justify-end"
					style={{ '--enter-delay': `${DEVICE_AT}ms` } as CssVars}
				>
					{/* Dusk: the accent as light, off-centre and wide, never a halo on the phone. */}
					<span
						aria-hidden="true"
						className="act-light absolute -inset-x-[40%] -inset-y-[15%] -z-10 daylight:hidden"
						style={{ '--act-x': '40%', '--act-y': '38%', '--act-a': 1 } as CssVars}
					/>
					{/* Daylight: the marigold field the phone stands on. */}
					<span
						aria-hidden="true"
						className="absolute left-1/2 top-[22%] -z-10 hidden h-[64%] w-[100vw] -translate-x-1/2 bg-brand daylight:block lg:left-[6%] lg:top-[14%] lg:h-[72%] lg:w-[60vw] lg:translate-x-0 lg:rounded-l-4xl"
					/>
					<HeroDevice>
						<div className="relative">
							{/* Dusk depth: a second phone receding into the light (scenery, hidden from screen readers). */}
							<div className="absolute bottom-[4%] right-[58%] hidden origin-bottom-right -rotate-[7deg] scale-[0.84] opacity-55 lg:dusk:block">
								<DeviceFrame isDecorative label="" className="[--screen:290] xl:[--screen:310]">
									<OnboardingScreen />
								</DeviceFrame>
							</div>
							{/* Daylight depth: one ink chip riding the field's edge.
							    🎨 REPLACE: sample content, from the app's welcome screen. */}
							<div
								aria-hidden="true"
								className="absolute left-0 top-[62%] z-10 hidden -translate-x-[84%] items-center gap-3 rounded-pill bg-ink py-2.5 pl-2.5 pr-5 text-ink-inverse shadow-overlay lg:daylight:flex"
							>
								<span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-on-brand">
									<Check className="h-[18px] w-[18px]" strokeWidth={2.6} />
								</span>
								<span className="leading-tight">
									<span className="block text-sm font-semibold">Morning review</span>
									<span className="block text-xs opacity-75">Done · 8:40</span>
								</span>
							</div>
							<DeviceFrame
								label="The app's home screen, with sample content"
								className="[--screen:258] sm:[--screen:292] lg:[--screen:300] xl:[--screen:320]"
							>
								<HomeScreen />
							</DeviceFrame>
						</div>
					</HeroDevice>
				</div>
			</Container>
		</section>
	)
}
