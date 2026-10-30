import { IS_LIVE } from '@/lib/stores'
import { Container } from './Container'
import { StoreBadges } from './StoreBadges'
import { WaitlistForm } from './WaitlistForm'
import { DeviceFrame } from './device/DeviceFrame'
import { WelcomeScreen } from './device/screens/WelcomeScreen'
import { Reveal } from './motion/Reveal'

// 🎨 REPLACE: your closing line, once for each state. Which one shows follows
// the store URLs in src/lib/stores.ts, so the page never says the app is out
// before it is.
const COPY = IS_LIVE
	? {
			heading: 'Get the app.',
			body: 'Free to download on iPhone and Android. Sign in with your email, and you are in.'
		}
	: {
			heading: 'Be first in line.',
			body: 'It is not in the stores yet. Leave your email and we will write once, the day it is.'
		}

/**
 * The close: one band that owns the width. On dusk it is the hero surface lit
 * from below under grain; on daylight it is the marigold field with graphite
 * ink. The app's welcome screen rises into it from the bottom edge.
 */
export function CallToAction() {
	return (
		<section
			id="download"
			className="relative isolate overflow-hidden bg-hero text-hero-text daylight:bg-brand daylight:text-on-brand"
		>
			{/* Dusk: the band rises out of the page's ground rather than starting on a
			    line; the grain after it covers both, as it does the section above. */}
			<span
				aria-hidden="true"
				className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-bg to-bg-fade daylight:hidden"
			/>
			<span aria-hidden="true" className="grain -z-10" />
			<span
				aria-hidden="true"
				className="absolute -bottom-1/2 left-1/2 -z-10 h-[90%] w-[110%] -translate-x-1/2 rounded-[50%] bg-brand-glow blur-[110px] daylight:hidden"
			/>
			<Container className="grid items-center gap-12 pb-0 pt-24 sm:pt-28 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pt-32">
				<Reveal className="pb-16 lg:pb-32">
					<h2 className="t-display text-balance">{COPY.heading}</h2>
					<p className="t-lead mt-6 max-w-[40ch] text-pretty text-hero-text-secondary daylight:text-on-brand/80">
						{COPY.body}
					</p>
					{IS_LIVE ? (
						<StoreBadges placement="closing" className="mt-9" />
					) : (
						<div className="mt-9 max-w-md">
							<WaitlistForm />
						</div>
					)}
				</Reveal>
				<Reveal delay={120} className="hidden justify-center self-end sm:flex lg:justify-end">
					{/* The phone runs off the band's bottom edge, fading out in the empty
					    gap under the welcome screen's cards, above its headline. */}
					<div className="-mb-[18.25rem] [mask-image:linear-gradient(to_bottom,black_17rem,transparent_20.5rem)] lg:-mb-[20.5rem] lg:[mask-image:linear-gradient(to_bottom,black_18.75rem,transparent_22.5rem)]">
						<DeviceFrame
							label="The app's welcome screen"
							className="[--screen:280] lg:[--screen:310]"
						>
							<WelcomeScreen />
						</DeviceFrame>
					</div>
				</Reveal>
			</Container>
		</section>
	)
}
