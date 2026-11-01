/**
 * The questions answered on the landing page and on /pricing. `id` is the
 * `question` discriminator on `faq_opened`, so keep ids stable once live:
 * renaming one splits its history in two.
 */
export interface Faq {
	id: string
	question: string
	answer: string
}

export const faqs: Faq[] = [
	{
		id: 'videos',
		question: 'Which videos work?',
		answer:
			'Public YouTube videos with speech. Private, removed or silent videos can’t be read, and the app will tell you.'
	},
	{
		id: 'sign_in',
		question: 'Do I need a password?',
		answer: 'No. You sign in with your email and a six-digit code that we send you each time.'
	},
	{
		id: 'score',
		question: 'How is my score worked out?',
		answer:
			'Your explanation is compared with the key ideas in the video. Each one counts as correct, missed or wrong, and you see the result when the class ends.'
	},
	{
		id: 'stuck',
		question: 'What if I can’t answer a student?',
		answer:
			'Tap I’ll be back to see that part of the video, then come back and answer. You can also skip the question.'
	},
	{
		id: 'delete',
		question: 'How do I delete my account?',
		answer:
			'In the app, open Settings and tap Delete account. If you cannot sign in, use the form on the delete account page.'
	}
]
