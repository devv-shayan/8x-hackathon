import Link from 'next/link'
import { brandConfig } from '@app/brand'
import { BrandMark } from './BrandMark'
import { Container } from './Container'

// 🎨 REPLACE: your pages, your contact address, your one-liner.
const COLUMNS = [
	{
		title: 'Product',
		links: [
			{ href: '/#story', label: 'How it works' },
			{ href: '/#features', label: 'Features' },
			{ href: '/pricing', label: 'Pricing' },
			{ href: '/#download', label: 'Download' }
		]
	},
	{
		title: 'Help',
		links: [
			{ href: '/support', label: 'Support' },
			{ href: '/#faq', label: 'Questions' },
			{ href: 'mailto:hello@example.com', label: 'Contact' }
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

const TAGLINE = 'A calmer way to get things done, on iPhone and Android.'

export function Footer() {
	const { siteName } = brandConfig
	const year = new Date().getFullYear()
	return (
		<footer className="border-t border-line-hairline pb-10 pt-16 sm:pt-20">
			<Container>
				<div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
					<div className="max-w-xs">
						<Link href="/" className="inline-flex items-center gap-2.5 rounded-lg">
							<BrandMark siteName={siteName} />
							<span className="font-display text-lg font-semibold">{siteName}</span>
						</Link>
						<p className="mt-4 text-pretty text-sm leading-relaxed text-ink-secondary">{TAGLINE}</p>
					</div>

					{COLUMNS.map((col) => (
						<nav key={col.title} aria-label={col.title}>
							<p className="text-sm font-semibold text-ink">{col.title}</p>
							<ul className="mt-4 space-y-1">
								{col.links.map((l) => (
									<li key={l.href}>
										<Link
											href={l.href}
											className="inline-flex min-h-9 items-center text-sm text-ink-secondary transition-colors duration-fast hover:text-ink"
										>
											{l.label}
										</Link>
									</li>
								))}
							</ul>
						</nav>
					))}
				</div>

				<div className="mt-16 flex flex-col gap-2 border-t border-line-hairline pt-6 text-sm text-ink-tertiary sm:flex-row sm:items-center sm:justify-between">
					<p>
						© {year} {siteName}. All rights reserved.
					</p>
					<p>Built on the app template.</p>
				</div>
			</Container>
		</footer>
	)
}
