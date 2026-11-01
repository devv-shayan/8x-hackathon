import type { Metadata } from 'next'
import { PageShell, Prose } from '@/components/PageShell'

export const metadata: Metadata = {
	title: 'Terms of Service',
	description: 'The terms that govern your use of the app.'
}

export default function TermsPage() {
	return (
		<PageShell>
			<Prose title="Terms of Service" updated="November 1, 2026">
				<h2>1. Acceptance of terms</h2>
				<p>
					By using Chalkback you agree to these terms. If you don&apos;t agree, don&apos;t use the
					app.
				</p>

				<h2>2. Your account</h2>
				<p>
					You are responsible for what happens under your account. Add only videos you are allowed
					to use, and don&apos;t misuse the service.
				</p>

				<h2>3. AI content</h2>
				<p>
					Students, scores and explanations are written by AI and can be wrong. Check anything
					important against the video.
				</p>

				<h2>4. Availability</h2>
				<p>
					Chalkback is provided as is, and may change or be unavailable at times. It depends on
					outside services, including YouTube.
				</p>

				<h2>5. Contact</h2>
				<p>
					Questions? Use the <a href="/support">support page</a>.
				</p>
			</Prose>
		</PageShell>
	)
}
