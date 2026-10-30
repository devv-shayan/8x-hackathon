import type { Metadata } from 'next'
import { PageShell, Prose } from '@/components/PageShell'

export const metadata: Metadata = {
	title: 'Terms of Service',
	description: 'The terms that govern your use of the app.'
}

export default function TermsPage() {
	return (
		<PageShell>
			<Prose title="Terms of Service" updated="January 1, 2026">
				<p>
					<strong>This is a template.</strong> Replace this with terms reviewed for your product and
					jurisdiction before launch.
				</p>

				<h2>1. Acceptance of terms</h2>
				<p>
					By using the app you agree to these terms. If you don&apos;t agree, don&apos;t use the
					app.
				</p>

				<h2>2. Subscriptions &amp; billing</h2>
				<p>
					Paid plans are billed through the App Store and Google Play. Renewals, cancellations, and
					refunds are governed by those platforms&apos; policies. Summarize your trial and renewal
					terms here.
				</p>

				<h2>3. Acceptable use</h2>
				<p>Describe prohibited uses, content rules, and account termination conditions.</p>

				<h2>4. Disclaimers &amp; liability</h2>
				<p>
					The standard &quot;as is&quot;, limitation-of-liability, and governing-law clauses go
					here.
				</p>

				<h2>5. Contact</h2>
				<p>
					Questions? Email <a href="mailto:legal@example.com">legal@example.com</a>.
				</p>
			</Prose>
		</PageShell>
	)
}
