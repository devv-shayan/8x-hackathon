import Link from 'next/link'
import { faqs } from '@/lib/faq'
import { Container } from '../Container'
import { FaqList } from '../FaqList'
import { Reveal } from '../motion/Reveal'
import { Ground } from './Ground'

export function FaqSection() {
	return (
		<section id="faq" className="relative isolate bg-bg py-28 sm:py-36">
			<Ground washAt="left" />
			<Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
				<Reveal>
					<h2 className="t-h1 max-w-[5.8em] text-balance">Questions, answered.</h2>
					<p className="mt-6 max-w-[34ch] text-pretty leading-relaxed text-ink-secondary">
						Something else on your mind?{' '}
						<Link href="/support" className="font-medium text-brand-ink underline">
							Ask us
						</Link>{' '}
						and we will get back to you.
					</p>
				</Reveal>
				<Reveal delay={90}>
					<FaqList items={faqs} />
				</Reveal>
			</Container>
		</section>
	)
}
