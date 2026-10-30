import { LegalDocument, type LegalSection } from '@/components/LegalDocument'

// 🎨 REPLACE: your privacy policy, reviewed by counsel, and the date it took effect.
const UPDATED = '[effective date]'

const SECTIONS: LegalSection[] = [
	{
		heading: 'Overview',
		body: 'This template application is provided for demonstration purposes. Data shown across the app can be mock data, sample analytics, or developer-provided environment values.'
	},
	{
		heading: 'Data we may process',
		body: 'Depending on how you configure this template, your production app may process account identifiers, product usage events, subscription status, and support inquiries.'
	},
	{
		heading: 'How data is used',
		body: 'Typical use cases include account authentication, feature personalization, billing state checks, and improving product quality through aggregate analytics.'
	},
	{
		heading: 'Third-party services',
		body: "This starter may integrate with providers like authentication backends, subscription platforms, analytics services, and app update delivery. Review each provider's privacy policy before publishing."
	},
	{
		heading: 'Your responsibility before launch',
		body: 'Replace this document with your legal policy, verify regional compliance requirements, and keep your final policy URL available inside app settings.'
	}
]

export default function PrivacyScreen() {
	return <LegalDocument title="Privacy Policy" updated={UPDATED} sections={SECTIONS} />
}
