'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { IS_LIVE } from '@/lib/stores'
import { BrandMark } from './BrandMark'

// 🎨 REPLACE: your site's sections and pages.
const LINKS = [
	{ href: '/#story', label: 'How it works' },
	{ href: '/#features', label: 'Features' },
	{ href: '/pricing', label: 'Pricing' },
	{ href: '/support', label: 'Support' }
]

/** The nav's call to action, true to the launch state (src/lib/stores.ts). */
const CTA_LABEL = IS_LIVE ? 'Get the app' : 'Join the waitlist'

/** Scroll distance, px, after which the bar contracts into the capsule. */
const CONTRACT_AFTER = 24

/**
 * The site header. At the top of the page it is an open, full-width bar over
 * the hero; past the first few pixels of scroll it contracts into a floating
 * glass capsule. Both states are one DOM, so nothing remounts mid-scroll.
 *
 * The mobile menu is a <details> disclosure, so it opens before hydration;
 * script only adds closing on a link tap, Escape, or a tap outside.
 */
export function Nav({ siteName }: { siteName: string }) {
	const pathname = usePathname()
	const [isContracted, setIsContracted] = useState(false)
	const menu = useRef<HTMLDetailsElement>(null)

	useEffect(() => {
		let frame = 0
		const read = () => {
			frame = 0
			setIsContracted(window.scrollY > CONTRACT_AFTER)
		}
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}
		read()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => {
			window.removeEventListener('scroll', onScroll)
			if (frame) cancelAnimationFrame(frame)
		}
	}, [])

	useEffect(() => {
		const el = menu.current
		if (!el) return
		const close = () => {
			el.open = false
		}
		const onPointerDown = (e: PointerEvent) => {
			if (el.open && e.target instanceof Node && !el.contains(e.target)) close()
		}
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && el.open) {
				close()
				el.querySelector('summary')?.focus()
			}
		}
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeyDown)
		window.addEventListener('resize', close)
		return () => {
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('resize', close)
		}
	}, [])

	const closeMenu = () => {
		if (menu.current) menu.current.open = false
	}
	const onCta = () => {
		closeMenu()
		gaEvent(FUNNEL_EVENTS.ctaClicked, { cta: 'nav' })
	}

	return (
		<header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
			<a
				href="#main"
				className="sr-only rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-ink-inverse focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
			>
				Skip to content
			</a>
			<nav
				aria-label="Main"
				className={cn(
					'relative mx-auto flex h-14 items-center justify-between border transition-[max-width,background-color,border-color,box-shadow,padding] duration-slow ease-out',
					isContracted
						? 'max-w-[880px] rounded-pill border-line-glass bg-bg/75 pl-4 pr-2 shadow-raised backdrop-blur-xl backdrop-saturate-150'
						: 'max-w-content border-transparent px-2 sm:px-5'
				)}
			>
				<Link
					href="/"
					className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight"
					onClick={closeMenu}
				>
					<BrandMark siteName={siteName} />
					<span className="font-display text-lg">{siteName}</span>
				</Link>

				<ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
					{LINKS.map((link) => (
						<li key={link.href}>
							<Link
								href={link.href}
								aria-current={pathname === link.href ? 'page' : undefined}
								className="rounded-pill px-3.5 py-2 text-sm font-medium text-ink-secondary transition-colors duration-fast hover:bg-surface2/70 hover:text-ink aria-[current=page]:text-ink"
							>
								{link.label}
							</Link>
						</li>
					))}
				</ul>

				<div className="flex items-center gap-2">
					<Link
						href="/#download"
						onClick={onCta}
						className="hidden h-10 items-center rounded-pill bg-ink px-4 text-sm font-semibold text-ink-inverse transition-[transform,background-color] duration-fast hover:bg-ink/90 active:scale-[0.96] sm:inline-flex"
					>
						{CTA_LABEL}
					</Link>

					<details ref={menu} className="group relative md:hidden">
						<summary
							aria-label="Menu"
							className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-line-soft bg-surface/70 text-ink backdrop-blur-md transition-transform duration-fast active:scale-[0.96]"
						>
							<Menu className="h-5 w-5 group-open:hidden" aria-hidden="true" />
							<X className="hidden h-5 w-5 group-open:block" aria-hidden="true" />
						</summary>
						<div className="menu-panel pane absolute right-0 top-[calc(100%+10px)] w-64 p-2 shadow-overlay">
							<ul>
								{LINKS.map((link) => (
									<li key={link.href}>
										<Link
											href={link.href}
											onClick={closeMenu}
											className="flex min-h-11 items-center rounded-row px-3.5 text-[15px] font-medium text-ink-secondary transition-colors hover:bg-surface2 hover:text-ink"
										>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
							<Link
								href="/#download"
								onClick={onCta}
								className="mt-1 flex h-12 items-center justify-center rounded-row bg-ink text-[15px] font-semibold text-ink-inverse"
							>
								{CTA_LABEL}
							</Link>
						</div>
					</details>
				</div>
			</nav>
		</header>
	)
}
