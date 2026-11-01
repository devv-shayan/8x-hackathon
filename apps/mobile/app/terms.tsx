import { LegalDocument, type LegalSection } from '@/components/LegalDocument'

const UPDATED = 'November 1, 2026'

const SECTIONS: LegalSection[] = [
	{
		heading: 'Acceptance of terms',
		body: 'By using Chalkback you agree to these terms. If you don’t agree, don’t use the app.'
	},
	{
		heading: 'Your account',
		body: 'You are responsible for what happens under your account. Add only videos you are allowed to use, and don’t misuse the service.'
	},
	{
		heading: 'AI content',
		body: 'Students, scores and explanations are written by AI and can be wrong. Check anything important against the video.'
	},
	{
		heading: 'Availability',
		body: 'Chalkback is provided as is, and may change or be unavailable at times. It depends on outside services, including YouTube.'
	}
]

export default function TermsScreen() {
	return <LegalDocument title="Terms of Service" updated={UPDATED} sections={SECTIONS} />
}
