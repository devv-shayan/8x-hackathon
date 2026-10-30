import { LegalDocument, type LegalSection } from '@/components/LegalDocument'

// 🎨 REPLACE: your terms of service, reviewed by counsel, and the date they took effect.
const UPDATED = '[effective date]'

const SECTIONS: LegalSection[] = [
	{
		heading: 'Use of the template',
		body: 'This project is distributed as starter software. You are responsible for customizing business logic, legal content, and service configurations before publishing to production environments.'
	},
	{
		heading: 'Accounts and access',
		body: 'If authentication is enabled, users are responsible for maintaining the security of their login methods and for activity performed under their account.'
	},
	{
		heading: 'Subscriptions',
		body: 'Any billing and entitlement behavior depends on your configured payment provider. Ensure your pricing, cancellation terms, and renewal terms are clearly disclosed in your final app copy.'
	},
	{
		heading: 'Service availability',
		body: 'Template components are provided without uptime guarantees. Integrations may be unavailable due to network conditions, external providers, or platform maintenance windows.'
	},
	{
		heading: 'Liability and compliance',
		body: 'Replace this document with jurisdiction-appropriate legal terms reviewed by qualified counsel. This sample text is informational and not legal advice.'
	}
]

export default function TermsScreen() {
	return <LegalDocument title="Terms of Service" updated={UPDATED} sections={SECTIONS} />
}
