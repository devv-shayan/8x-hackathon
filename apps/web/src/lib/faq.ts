/**
 * The questions answered on the landing page and on /pricing. `id` is the
 * `question` discriminator on `faq_opened`, so keep ids stable once live:
 * renaming one splits its history in two.
 *
 * 🎨 REPLACE: every answer here is true of the template as shipped (store
 * billing, code sign-in, both platforms, in-app deletion). Rewrite them for
 * your app, and put your real trial terms in `trial`.
 */
export interface Faq {
	id: string
	question: string
	answer: string
}

export const faqs: Faq[] = [
	{
		id: 'devices',
		question: 'Which phones does it work on?',
		answer:
			'iPhone and Android. Your account works on both, so you can change phones without starting over.'
	},
	{
		id: 'sign_in',
		question: 'Do I need a password?',
		answer: 'No. You sign in with your email and a six-digit code that we send you each time.'
	},
	{
		id: 'trial',
		question: 'Is there a free trial?',
		answer:
			'Pro starts with a free trial. Its length and what happens when it ends are shown on the upgrade screen before you confirm anything.'
	},
	{
		id: 'cancel',
		question: 'Can I cancel any time?',
		answer:
			'Yes. Subscriptions are managed by the App Store or Google Play, and you can cancel in your store account settings whenever you like.'
	},
	{
		id: 'refunds',
		question: 'How do refunds work?',
		answer:
			'Payments go through Apple or Google, so refunds follow their policies. If you need a hand, write to us from the support page.'
	},
	{
		id: 'delete',
		question: 'How do I delete my account?',
		answer:
			'In the app, open Settings and tap Delete account. If you cannot sign in, use the form on the delete account page.'
	}
]
