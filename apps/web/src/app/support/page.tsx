import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { ContactForm } from '@/components/ContactForm'
import { PageHeader, PageShell } from '@/components/PageShell'

export const metadata: Metadata = {
	title: 'Support',
	description: 'Get help, report a bug, or send feedback.'
}

// 🎨 REPLACE: your support address, and the questions your users actually ask.
const SUPPORT_EMAIL = 'support@example.com'
const QUESTIONS = [
	{
		q: 'How do I sign in on a new phone?',
		a: 'Install the app, enter the email on your account, and type in the six-digit code we send you.'
	},
	{
		q: 'How do I cancel my subscription?',
		a: 'In your App Store or Google Play account settings, under Subscriptions.'
	},
	{
		q: 'How do I delete my account?',
		a: 'In the app, open Settings and tap Delete account, or use the delete account page on this site.'
	}
]

export default function SupportPage() {
	return (
		<PageShell>
			<Container className="pb-28 sm:pb-36">
				<PageHeader
					title="How can we help?"
					lead={
						<>
							Write to{' '}
							<a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-ink underline">
								{SUPPORT_EMAIL}
							</a>{' '}
							or use the form, and we will reply by email.
						</>
					}
				/>

				<div className="mt-14 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
					<section className="pane p-7 sm:p-9" aria-labelledby="message-heading">
						<h2 id="message-heading" className="t-h3">
							Send us a message
						</h2>
						<p className="mt-2 text-sm text-ink-secondary">
							It reaches the team&rsquo;s inbox and the admin panel.
						</p>
						<div className="mt-7">
							<ContactForm />
						</div>
					</section>

					<section className="p-2 sm:p-4 lg:p-9" aria-labelledby="questions-heading">
						<h2 id="questions-heading" className="t-h3">
							Quick answers
						</h2>
						<dl className="mt-6 divide-y divide-line-soft border-y border-line-soft">
							{QUESTIONS.map((item) => (
								<div key={item.q} className="py-5">
									<dt className="font-semibold">{item.q}</dt>
									<dd className="mt-1.5 text-pretty leading-relaxed text-ink-secondary">
										{item.a}
									</dd>
								</div>
							))}
						</dl>
					</section>
				</div>
			</Container>
		</PageShell>
	)
}
