import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { theme } from '@app/brand'
import { Container } from '../Container'
import { Lines } from '../Lines'
import { Reveal } from '../motion/Reveal'
import { Ground } from './Ground'
import { OtpVignette, SchemeVignette, SettingsVignette } from './Vignettes'

// 🎨 REPLACE: your lead claim. The three features below are true of every
// play built on the template (code sign-in, both schemes, account deletion);
// keep them if your app still has them.
const LEAD = {
	title: ['Quick to open.', 'Quicker to put down.'],
	body: 'Everything is a tap or two from the home screen, so a spare minute is enough to get something done.'
}

const title = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

/**
 * Features as a descent rather than a grid: one lead claim at display size,
 * two panes that each show the feature working, then one wide band on the
 * hero surface (dark in both schemes) to close the run.
 */
export function FeatureDescent() {
	return (
		<section id="features" className="relative isolate bg-bg py-28 sm:py-36">
			<Ground washAt="left" />
			<Container>
				<Reveal>
					<h2 className="t-display">
						<Lines lines={LEAD.title} />
					</h2>
					<p className="t-lead mt-7 max-w-[44ch] text-pretty text-ink-secondary">{LEAD.body}</p>
				</Reveal>

				<div className="mt-16 grid gap-5 sm:mt-20 md:grid-cols-2">
					<Reveal as="article" className="pane flex flex-col p-7 sm:p-9">
						<OtpVignette />
						<h3 className="t-h3 mt-10">No password to remember.</h3>
						<p className="mt-3 max-w-[40ch] text-pretty leading-relaxed text-ink-secondary">
							Sign in with your email and a six-digit code. That is the whole ceremony.
						</p>
					</Reveal>
					<Reveal as="article" delay={90} className="pane flex flex-col p-7 sm:p-9">
						<SchemeVignette
							lightName={title(theme.palettes.light.name)}
							darkName={title(theme.palettes.dark.name)}
						/>
						<h3 className="t-h3 mt-10">Easy on the eyes, day or night.</h3>
						<p className="mt-3 max-w-[40ch] text-pretty leading-relaxed text-ink-secondary">
							It follows your phone&rsquo;s light or dark setting, or you pick one and it stays.
						</p>
					</Reveal>
				</div>

				<Reveal
					as="article"
					className="relative mt-5 grid items-center gap-10 overflow-hidden rounded-card border border-hero-border bg-hero p-7 text-hero-text sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:p-14"
				>
					<span aria-hidden="true" className="grain" />
					<span
						aria-hidden="true"
						className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand-glow blur-[90px] daylight:hidden"
					/>
					<div className="relative">
						<h3 className="t-h2">
							<Lines lines={['Easy to join.', 'Just as easy to leave.']} />
						</h3>
						<p className="mt-5 max-w-[46ch] text-pretty leading-relaxed text-hero-text-secondary">
							Cancel a subscription in the App Store or Google Play. Delete your account and
							everything in it from Settings, or from this site, whenever you like.
						</p>
						<Link
							href="/delete-account"
							className="group mt-7 inline-flex min-h-11 items-center gap-2 font-semibold text-hero-brand-ink"
						>
							How deleting works
							<ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
						</Link>
					</div>
					<div data-scheme="dark" className="relative rounded-2xl bg-bg/60 p-3 text-ink">
						<SettingsVignette />
					</div>
				</Reveal>
			</Container>
		</section>
	)
}
