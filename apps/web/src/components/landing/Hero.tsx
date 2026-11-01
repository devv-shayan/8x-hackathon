import { APP_URL } from '@/lib/stores'
import type { CssVars } from '@/lib/utils'
import { Container } from '../Container'
import { DeviceFrame } from '../device/DeviceFrame'
import { WelcomeScreen } from '../device/screens/WelcomeScreen'
import { WordRise } from '../motion/WordRise'
import { HeroDevice } from './HeroDevice'

const HEADLINE = ['Teach it.', 'The class', 'talks back.']
const PROMISE =
	'Paste a YouTube video, explain it, and teach AI students who ask about what you missed, so it sticks.'

/** Entrance timings, ms: the words rise first, then the action and the phone. */
const ACTIONS_AT = 480
const DEVICE_AT = 180

/** The first viewport: the headline, the way in, and the app's welcome screen on a phone. */
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
						<a
							href={APP_URL}
							className="inline-flex h-12 items-center rounded-pill bg-brand px-6 font-semibold text-on-brand transition-transform duration-fast active:scale-[0.96]"
						>
							Try Chalkback
						</a>
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
						<DeviceFrame
							label="The app's welcome screen"
							className="[--screen:258] sm:[--screen:292] lg:[--screen:300] xl:[--screen:320]"
						>
							<WelcomeScreen />
						</DeviceFrame>
					</HeroDevice>
				</div>
			</Container>
		</section>
	)
}
