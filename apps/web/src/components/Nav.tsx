'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { APP_URL } from '@/lib/stores'
import { BrandMark } from './BrandMark'

const LINKS = [
	{ href: '/#how', label: 'How it works' },
	{ href: '/#class', label: 'The class' },
	{ href: '/#remember', label: 'Warm-ups' },
	{ href: '/#faq', label: 'Questions' }
]

const CTA_LABEL = 'Try it free'

/**
 * The site header: a white bar with a hairline under it, the links in the middle and one
 * square black button. The mobile menu is a <details> disclosure, so it opens before
 * hydration; script only adds closing on a link tap, Escape, or a tap outside.
 */
export function Nav({ siteName }: { siteName: string }) {
	const pathname = usePathname()
	const menu = useRef<HTMLDetailsElement>(null)

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
		<header className="l-sans fixed inset-x-0 top-0 z-50 border-b border-[rgb(var(--l-hair))] bg-[rgb(var(--l-paper)/0.92)] text-[rgb(var(--l-ink))] backdrop-blur-md">
			<a
				href="#main"
				className="sr-only bg-[rgb(var(--l-ink))] px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
			>
				Skip to content
			</a>
			<nav
				aria-label="Main"
				className="relative mx-auto flex h-14 max-w-content items-center justify-between px-5 sm:px-8"
			>
				<Link
					href="/"
					className="flex items-center gap-2 text-[17px] font-semibold tracking-tight"
					onClick={closeMenu}
				>
					<BrandMark />
					<span>{siteName.toLowerCase()}</span>
				</Link>

				<ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
					{LINKS.map((link) => (
						<li key={link.href}>
							<Link
								href={link.href}
								aria-current={pathname === link.href ? 'page' : undefined}
								className="px-3 py-2 text-sm text-[rgb(var(--l-muted))] transition-colors duration-fast hover:text-[rgb(var(--l-ink))]"
							>
								{link.label}
							</Link>
						</li>
					))}
				</ul>

				<div className="flex items-center gap-2">
					<Link
						href={APP_URL}
						onClick={onCta}
						className="hidden h-9 items-center bg-[rgb(var(--l-ink))] px-4 text-sm font-medium text-white transition-colors duration-fast hover:bg-[rgb(var(--l-ink)/0.85)] sm:inline-flex"
					>
						{CTA_LABEL}
					</Link>

					<details ref={menu} className="group relative md:hidden">
						<summary
							aria-label="Menu"
							className="grid h-11 w-11 cursor-pointer place-items-center border border-[rgb(var(--l-hair))]"
						>
							<Menu className="h-5 w-5 group-open:hidden" aria-hidden="true" />
							<X className="hidden h-5 w-5 group-open:block" aria-hidden="true" />
						</summary>
						<div className="absolute right-0 top-[calc(100%+8px)] w-64 border border-[rgb(var(--l-hair))] bg-[rgb(var(--l-paper))] p-2 shadow-lg">
							<ul>
								{LINKS.map((link) => (
									<li key={link.href}>
										<Link
											href={link.href}
											onClick={closeMenu}
											className="flex min-h-11 items-center px-3 text-[15px] text-[rgb(var(--l-muted))] hover:bg-[rgb(var(--l-wash))] hover:text-[rgb(var(--l-ink))]"
										>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
							<Link
								href={APP_URL}
								onClick={onCta}
								className="mt-1 flex h-11 items-center justify-center bg-[rgb(var(--l-ink))] text-[15px] font-medium text-white"
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
