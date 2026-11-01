import { Container } from '../Container'
import { GreyLink, StartLink } from './parts'
import { PixelStudents } from './pixel/PixelStudents'

const SUBJECTS = ['Biology', 'Psychology', 'History', 'Physics', 'Economics', 'Any lecture']

/** The first viewport: the promise on the left, Maya and Omar waiting on the right. */
export function Hero() {
	return (
		<section className="l-sans relative overflow-hidden bg-[rgb(var(--l-paper))] pt-14 text-[rgb(var(--l-ink))]">
			<div aria-hidden="true" className="l-dots absolute inset-y-0 right-0 w-full lg:w-1/2" />
			<Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
				<div className="bg-[rgb(var(--l-paper))] lg:pr-6">
					<p className="inline-flex flex-wrap gap-x-3 bg-[rgb(var(--l-lime-soft))] px-3 py-1.5 text-[13px]">
						<span>Learning that sticks:</span>
						<span>paste a video, teach it back &gt;</span>
					</p>
					<h1 className="mt-6 text-balance text-[clamp(2.6rem,5.4vw,4.3rem)] font-medium leading-[1.04] tracking-[-0.035em]">
						Don&rsquo;t just watch it.
						<br />
						<span className="l-hl">Teach</span> it <span className="l-hl">back</span>.
					</h1>
					<p className="mt-6 max-w-[40ch] text-[17px] leading-relaxed text-[rgb(var(--l-muted))]">
						Paste any YouTube video, explain it in your own words, and teach two AI students who ask
						about what you missed. Gaps come back until they stick.
					</p>
					<div className="mt-8 flex flex-wrap gap-2">
						<StartLink placement="hero" />
						<GreyLink href="#how">See how it works</GreyLink>
					</div>
				</div>

				<div className="relative">
					<PixelStudents className="aspect-[4/3] w-full border border-[rgb(var(--l-hair))]" />
					<p className="l-mono mt-3">Point at or tap a student to call on them</p>
				</div>
			</Container>

			<div className="border-t border-[rgb(var(--l-hair-soft))]">
				<ul className="mx-auto flex max-w-content flex-wrap justify-around gap-x-6 gap-y-2 px-5 py-4 sm:px-8">
					{SUBJECTS.map((subject) => (
						<li key={subject} className="l-mono">
							{subject}
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}
