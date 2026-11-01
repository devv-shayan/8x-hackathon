import type { ReactNode } from 'react'
import { TrackedLink } from '@/components/TrackedLink'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { APP_URL } from '@/lib/stores'
import { cn } from '@/lib/utils'

/** Where a call to action sits on the page: the `cta` discriminator on `cta_clicked`. */
export type CtaPlacement = 'hero' | 'loop' | 'final'

/** The square black button into the app, reporting where it was clicked. */
export function StartLink({
	placement,
	children = 'Start a class',
	className
}: {
	placement: CtaPlacement
	children?: ReactNode
	className?: string
}) {
	return (
		<TrackedLink
			href={APP_URL}
			name={FUNNEL_EVENTS.ctaClicked}
			properties={{ cta: placement }}
			className={cn(
				'inline-flex h-10 items-center gap-2 bg-[rgb(var(--l-ink))] px-4 text-sm font-medium text-white transition-colors duration-fast hover:bg-[rgb(var(--l-ink)/0.85)]',
				className
			)}
		>
			<span aria-hidden="true">&gt;</span>
			{children}
		</TrackedLink>
	)
}

/** The quieter grey button beside it, to a place on the page. */
export function GreyLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			className="inline-flex h-10 items-center gap-2 bg-[rgb(var(--l-wash))] px-4 text-sm text-[rgb(var(--l-ink))] transition-colors duration-fast hover:bg-[rgb(var(--l-hair))]"
		>
			<span aria-hidden="true">&gt;</span>
			{children}
		</a>
	)
}

/** The full-width rule with a small label that opens each part of the page. */
export function SectionBand({ label, dark = false }: { label: string; dark?: boolean }) {
	return (
		<div
			className={cn(
				'border-y',
				dark ? 'border-white/10 bg-[rgb(var(--l-ink))]' : 'border-[rgb(var(--l-hair))]'
			)}
		>
			<div className="mx-auto flex max-w-content items-center gap-2.5 px-5 py-3 sm:px-8">
				<span aria-hidden="true" className="h-3 w-0.5 bg-[rgb(var(--l-lime-tick))]" />
				<span className="l-mono">{label}</span>
			</div>
		</div>
	)
}

/** A card of app UI, floated over a background. */
export function AppCard({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<div
			className={cn(
				'relative border border-[rgb(var(--l-hair))] bg-[rgb(var(--l-paper))] text-[13px] text-[rgb(var(--l-ink))] shadow-[0_8px_24px_rgb(0_0_0/0.14)]',
				className
			)}
		>
			{children}
		</div>
	)
}

/** One row of an AppCard, with a hairline above it. */
export function AppRow({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<div
			className={cn(
				'flex items-center justify-between gap-3 border-t border-[rgb(var(--l-hair-soft))] px-3 py-2 first:border-t-0',
				className
			)}
		>
			{children}
		</div>
	)
}

/** The green "Fixed in class" tag. */
export function FixedTag({ children = 'Fixed' }: { children?: ReactNode }) {
	return (
		<span className="whitespace-nowrap bg-[rgb(var(--l-fixed-bg))] px-1.5 py-0.5 text-[11px] text-[rgb(var(--l-fixed))]">
			{children}
		</span>
	)
}
