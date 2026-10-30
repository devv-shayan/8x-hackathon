import type { Metadata } from 'next'
import { PageShell, Prose } from '@/components/PageShell'

export const metadata: Metadata = {
	title: 'Privacy Policy',
	description: 'How we collect, use, and protect your data.'
}

export default function PrivacyPage() {
	return (
		<PageShell>
			<Prose title="Privacy Policy" updated="January 1, 2026">
				<p>
					<strong>This is a template.</strong> Replace this copy with a privacy policy reviewed for
					your product, jurisdictions, and the data you actually collect. Both the App Store and
					Google Play require a reachable privacy policy URL — this page exists so you have one from
					day one.
				</p>

				<h2>1. Information we collect</h2>
				<p>
					Describe the account data (email, profile), usage/analytics data (PostHog, GA4), and any
					device permissions (camera, photos) your app uses. List third parties that process data:
					Supabase, RevenueCat, PostHog, Google Analytics, Sentry, Expo (app updates).
				</p>

				<h2>2. How we use information</h2>
				<ul>
					<li>To provide and maintain the service</li>
					<li>To process subscriptions and entitlements</li>
					<li>To understand product usage and improve the app</li>
					<li>To respond to support requests</li>
				</ul>

				<h2>3. Data retention &amp; deletion</h2>
				<p>
					Explain how long you keep data and how users can request deletion. Link to your{' '}
					<a href="/delete-account">account deletion page</a>.
				</p>

				<h2>4. Contact</h2>
				<p>
					Questions about this policy? Email{' '}
					<a href="mailto:privacy@example.com">privacy@example.com</a>.
				</p>
			</Prose>
		</PageShell>
	)
}
