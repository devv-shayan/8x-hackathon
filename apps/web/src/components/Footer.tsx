import { APP_URL } from '@/lib/stores'
import Link from 'next/link'
import { brandConfig } from '@app/brand'
import { BrandMark } from './BrandMark'
import { Container } from './Container'

const COLUMNS = [
	{
		title: 'Product',
		links: [
			{ href: '/#how', label: 'How it works' },
			{ href: '/#class', label: 'The class' },
			{ href: '/#remember', label: 'Warm-ups' },
			{ href: APP_URL, label: 'Open the app' }
		]
	},
	{
		title: 'Help',
		links: [
			{ href: '/#faq', label: 'Questions' },
			{ href: '/support', label: 'Support' }
		]
	},
	{
		title: 'Legal',
		links: [
			{ href: '/privacy', label: 'Privacy' },
			{ href: '/terms', label: 'Terms' },
			{ href: '/delete-account', label: 'Delete account' }
		]
	}
]

const TAGLINE = 'Teach it back. Find out what stuck.'

export function Footer() {
	const { siteName } = brandConfig
	const year = new Date().getFullYear()
	return (
		<footer className="l-sans border-t border-[rgb(var(--l-hair))] bg-[rgb(var(--l-paper))] pb-10 pt-14 text-[rgb(var(--l-ink))]">
			<Container>
				<div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
					<div className="max-w-xs">
						<Link href="/" className="inline-flex items-center gap-2 text-[17px] font-semibold">
							<BrandMark />
							{siteName.toLowerCase()}
						</Link>
						<p className="mt-4 text-sm leading-relaxed text-[rgb(var(--l-muted))]">{TAGLINE}</p>
					</div>

					{COLUMNS.map((col) => (
						<nav key={col.title} aria-label={col.title}>
							<p className="l-mono">{col.title}</p>
							<ul className="mt-4 space-y-1">
								{col.links.map((l) => (
									<li key={l.href}>
										<Link
											href={l.href}
											className="inline-flex min-h-9 items-center text-sm text-[rgb(var(--l-muted))] transition-colors duration-fast hover:text-[rgb(var(--l-ink))]"
										>
											{l.label}
										</Link>
									</li>
								))}
							</ul>
						</nav>
					))}
				</div>

				<div className="mt-14 border-t border-[rgb(var(--l-hair))] pt-6">
					<p className="l-mono">
						© {year} {siteName}
					</p>
				</div>
			</Container>
		</footer>
	)
}
