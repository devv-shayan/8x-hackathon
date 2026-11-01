import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/Container'
import { ContactForm } from '@/components/ContactForm'
import { PageHeader, PageShell } from '@/components/PageShell'
import { PixelField } from '@/components/landing/pixel/PixelField'

export const metadata: Metadata = {
	title: 'Support',
	description: 'Get help, report a bug, or send feedback.'
}

const QUESTIONS = [
	{
		q: 'How do I sign in on a new phone?',
		a: 'Install the app, enter the email on your account, and type in the six-digit code we send you.'
	},
	{
		q: 'A video won’t read. What now?',
		a: 'Public YouTube videos with speech work best. Private, removed or silent ones can’t be read.'
	},
	{
		q: 'How do I delete my account?',
		a: 'In the app, open Settings and tap Delete account, or use the delete account page.'
	}
]

export default function SupportPage() {
	return (
		<PageShell>
			<Container className="pb-28 sm:pb-36">
				<PageHeader
					label="Support"
					title="How can we help?"
					highlight="help"
					lead="Use the form, and we'll reply by email."
				/>

				<div className="mt-12 grid border border-[rgb(var(--l-hair))] lg:grid-cols-[1.15fr_0.85fr]">
					<section
						className="border-b border-[rgb(var(--l-hair))] p-6 sm:p-8 lg:border-b-0 lg:border-r"
						aria-labelledby="message-heading"
					>
						<h2 id="message-heading" className="l-mono">
							Send us a message
						</h2>
						<p className="mt-2 text-sm text-[rgb(var(--l-muted))]">
							It reaches the team&rsquo;s inbox and the admin panel.
						</p>
						<div className="mt-6">
							<ContactForm />
						</div>
					</section>

					<section aria-labelledby="questions-heading" className="flex flex-col">
						<h2 id="questions-heading" className="l-mono px-6 pt-6 sm:px-8 sm:pt-8">
							Quick answers
						</h2>
						<dl className="mt-4">
							{QUESTIONS.map((item) => (
								<div
									key={item.q}
									className="border-t border-[rgb(var(--l-hair))] px-6 py-5 sm:px-8"
								>
									<dt className="font-medium">{item.q}</dt>
									<dd className="mt-1.5 text-pretty text-sm leading-relaxed text-[rgb(var(--l-muted))]">
										{item.a}
									</dd>
								</div>
							))}
						</dl>
						<div className="relative mt-auto hidden min-h-[140px] border-t border-[rgb(var(--l-hair))] lg:block">
							<PixelField name="limeEdges" />
						</div>
					</section>
				</div>

				<p className="mt-6 text-sm text-[rgb(var(--l-muted))]">
					Want to delete your account?{' '}
					<Link
						href="/delete-account"
						className="text-[rgb(var(--l-ink))] underline underline-offset-4"
					>
						Here&rsquo;s how
					</Link>
					.
				</p>
			</Container>
		</PageShell>
	)
}
