import Link from 'next/link'
import { faqs } from '@/lib/faq'
import { FaqList } from '../FaqList'
import { SectionBand, StartLink } from './parts'
import { PixelField } from './pixel/PixelField'

/** The questions, then the closing lime band. */
export function FaqSection() {
	return (
		<div className="l-sans bg-[rgb(var(--l-paper))] text-[rgb(var(--l-ink))]">
			<div id="faq" className="scroll-mt-14">
				<SectionBand label="Questions" />
			</div>
			<section className="mx-auto grid max-w-content gap-10 px-5 pt-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
				<div>
					<h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.03em]">
						Questions, answered.
					</h2>
					<p className="mt-4 max-w-[34ch] leading-relaxed text-[rgb(var(--l-muted))]">
						Something else on your mind?{' '}
						<Link href="/support" className="text-[rgb(var(--l-ink))] underline underline-offset-4">
							Ask us
						</Link>{' '}
						and we&rsquo;ll get back to you.
					</p>
				</div>
				<FaqList items={faqs} />
			</section>

			<section className="mx-auto max-w-content px-5 py-24 sm:px-8 sm:py-28">
				<div className="relative overflow-hidden px-6 py-20 text-center">
					<PixelField name="limeEdges" />
					<h2 className="relative inline-block bg-[rgb(var(--l-paper))] px-4 py-2 text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.03em]">
						The fastest way to learn it
						<br />
						is to teach it.
					</h2>
					<div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
						<StartLink placement="final">Start a class free</StartLink>
						<a href="#how" className="bg-[rgb(var(--l-paper))] px-3 py-2 text-sm">
							&gt; See how it works
						</a>
					</div>
				</div>
			</section>
		</div>
	)
}
