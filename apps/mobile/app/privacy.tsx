import { LegalDocument, type LegalSection } from '@/components/LegalDocument'

const UPDATED = 'November 1, 2026'

const SECTIONS: LegalSection[] = [
	{
		heading: 'Overview',
		body: 'Chalkback helps you remember what you watch by teaching it to AI students. This page says what it keeps and why.'
	},
	{
		heading: 'What we keep',
		body: 'Your email and profile, the YouTube links you add with their transcripts, what you write in class, your scores, and how you use the app.'
	},
	{
		heading: 'How we use it',
		body: 'To sign you in, run your classes, bring back what you missed, and improve the app. We do not sell your data.'
	},
	{
		heading: 'Who processes it',
		body: 'Supabase stores your account and data, Vercel hosts the service, and Google Gemini and Supadata read videos and write the students. PostHog, Sentry and Expo handle analytics, errors and app updates.'
	},
	{
		heading: 'Deleting your data',
		body: 'Open Settings and tap Delete account. That removes your account, videos, classes and answers.'
	}
]

export default function PrivacyScreen() {
	return <LegalDocument title="Privacy Policy" updated={UPDATED} sections={SECTIONS} />
}
