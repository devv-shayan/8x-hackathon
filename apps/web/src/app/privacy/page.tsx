import type { Metadata } from 'next'
import { PageShell, Prose } from '@/components/PageShell'

export const metadata: Metadata = {
	title: 'Privacy Policy',
	description: 'How we collect, use, and protect your data.'
}

export default function PrivacyPage() {
	return (
		<PageShell>
			<Prose title="Privacy Policy" updated="November 5, 2026">
				<p>Chalkback helps you remember what you watch by teaching it to AI students.</p>

				<h2>1. Information we collect</h2>
				<p>
					Your email and profile, the YouTube links you add with their transcripts, what you write
					or say in class, your scores, and how you use the app. Supabase, Vercel, Google Gemini,
					Groq, Supadata, PostHog, Google Analytics, Sentry and Expo process this for us.
				</p>
				<p>
					When you explain or answer out loud, your recording goes to Groq to be turned into text,
					and we keep only that text. We never store the recording. Groq also makes the students’
					voices from their questions. If you allow reminders, we store a push token and Expo
					delivers a note that names one idea you might forget. The board works if you say no.
				</p>

				<h2>2. How we use information</h2>
				<ul>
					<li>To sign you in and run your classes</li>
					<li>To bring back what you missed</li>
					<li>To understand product usage and improve the app</li>
					<li>To respond to support requests</li>
				</ul>

				<h2>3. Data retention &amp; deletion</h2>
				<p>
					We keep your data until you delete your account. Use Settings in the app or the{' '}
					<a href="/delete-account">account deletion page</a>.
				</p>

				<h2>4. Contact</h2>
				<p>
					Questions about this policy? Use the <a href="/support">support page</a>.
				</p>
			</Prose>
		</PageShell>
	)
}
