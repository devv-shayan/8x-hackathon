import { brandConfig } from '@app/brand'
import { motionTokens } from '@/lib/brand-motion'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { Container } from './Container'
import { MotionProvider } from './motion/MotionProvider'

/**
 * The marketing site's frame: the capsule nav, the page, the footer, inside
 * the motion root. The nav floats over the page, so a page that does not open
 * on its own full-bleed hero asks for `isPadded` to clear it.
 */
export function PageShell({
	isPadded = true,
	children
}: {
	isPadded?: boolean
	children: React.ReactNode
}) {
	return (
		<MotionProvider tokens={motionTokens}>
			<Nav siteName={brandConfig.siteName} />
			<main id="main" className={isPadded ? 'min-h-[60vh] pt-28 sm:pt-32' : undefined}>
				{children}
			</main>
			<Footer />
		</MotionProvider>
	)
}

/** A page's opening: its title in the display face, and an optional line under it. */
export function PageHeader({ title, lead }: { title: string; lead?: React.ReactNode }) {
	return (
		<header className="max-w-3xl">
			<h1 className="t-h1 text-balance">{title}</h1>
			{lead && <p className="t-lead mt-5 text-pretty text-ink-secondary">{lead}</p>}
		</header>
	)
}

/**
 * Readable long-form column for legal copy. Hand-rolled prose styles (no
 * @tailwindcss/typography dependency) at a 68ch measure.
 */
export function Prose({
	title,
	updated,
	children
}: {
	title: string
	updated?: string
	children: React.ReactNode
}) {
	return (
		<Container className="pb-24">
			<div className="mx-auto max-w-[68ch]">
				<h1 className="t-h1 text-balance">{title}</h1>
				{updated && <p className="mt-4 text-sm text-ink-tertiary">Last updated {updated}</p>}
				<div className="mt-12 space-y-5 text-[17px] leading-[1.7] text-ink-body [&_a:hover]:underline [&_a]:text-brand-ink [&_h2]:!mt-14 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-0.015em] [&_h2]:text-ink [&_h3]:!mt-8 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink">
					{children}
				</div>
			</div>
		</Container>
	)
}
