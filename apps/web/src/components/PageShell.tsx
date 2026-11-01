import { brandConfig } from '@app/brand'
import { motionTokens } from '@/lib/brand-motion'
import { cn } from '@/lib/utils'
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
			<main id="main" className={cn('l-sans', isPadded && 'min-h-[60vh] pt-28 sm:pt-32')}>
				{children}
			</main>
			<Footer />
		</MotionProvider>
	)
}

/**
 * A page's opening: a mono label on a hairline band, then the title, with an optional
 * highlighted word and a line under it.
 */
export function PageHeader({
	label,
	title,
	highlight,
	lead
}: {
	label?: string
	title: string
	/** A word or phrase in `title` to mark with the lime highlighter. */
	highlight?: string
	lead?: React.ReactNode
}) {
	const at = highlight ? title.indexOf(highlight) : -1
	return (
		<header className="max-w-3xl">
			{label && (
				<p className="l-mono flex items-center gap-2.5">
					<span aria-hidden="true" className="h-3 w-0.5 bg-[rgb(var(--l-lime-tick))]" />
					{label}
				</p>
			)}
			<h1 className="mt-5 text-balance text-[clamp(2.2rem,4.6vw,3.6rem)] font-medium leading-[1.06] tracking-[-0.035em] text-[rgb(var(--l-ink))]">
				{at < 0 ? (
					title
				) : (
					<>
						{title.slice(0, at)}
						<span className="l-hl">{highlight}</span>
						{title.slice(at + highlight!.length)}
					</>
				)}
			</h1>
			{lead && (
				<p className="mt-5 max-w-[52ch] text-pretty text-[17px] leading-relaxed text-[rgb(var(--l-muted))]">
					{lead}
				</p>
			)}
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
				<div className="mt-12 space-y-5 text-[17px] leading-[1.7] text-ink-body [&_a:hover]:underline [&_a]:text-[rgb(var(--l-ink))] [&_a]:underline [&_a]:underline-offset-4 [&_h2]:!mt-14 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-[-0.015em] [&_h2]:text-ink [&_h3]:!mt-8 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink">
					{children}
				</div>
			</div>
		</Container>
	)
}
