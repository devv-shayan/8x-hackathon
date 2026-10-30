/**
 * Single source of truth for pricing, shared by the landing teaser, the full
 * pricing page and the paywall drawn in the landing page's phone. Edit here;
 * every surface updates.
 *
 * 🎨 REPLACE: the template has no prices of its own and must not invent any.
 * The paid prices below are placeholders (`isPricePlaceholder`), and the site
 * marks them as such until you set your real ones and delete the flag. Keep
 * them in step with the products in App Store Connect and the Play Console.
 */
export interface Plan {
	id: string
	name: string
	/** Shown as written, e.g. '$4.99'. */
	price: string
	cadence: string
	/** A short label for the cadence inside the app's paywall ('month', 'year'). */
	period?: string
	tagline: string
	features: string[]
	cta: string
	featured?: boolean
	/** True while `price` is the template's placeholder. Delete once the price is real. */
	isPricePlaceholder?: boolean
}

export const plans: Plan[] = [
	{
		id: 'free',
		name: 'Free',
		price: '$0',
		cadence: 'forever',
		tagline: 'The whole core app, free for good.',
		features: ['The core app', 'Sign in with a code', 'Light and dark themes'],
		cta: 'Get the app'
	},
	{
		id: 'pro',
		name: 'Pro',
		price: '$X.XX',
		cadence: 'per month',
		period: 'month',
		tagline: 'For people who use it every day.',
		features: [
			'Everything in Free',
			'Your first premium feature',
			'Your second premium feature',
			'Cancel any time in the store'
		],
		cta: 'Start free trial',
		featured: true,
		isPricePlaceholder: true
	},
	{
		id: 'pro-annual',
		name: 'Pro Annual',
		price: '$XX.XX',
		cadence: 'per year',
		period: 'year',
		tagline: 'Pro, billed once a year.',
		features: ['Everything in Pro', 'One payment a year', 'Cancel any time in the store'],
		cta: 'Go annual',
		isPricePlaceholder: true
	}
]

/** The plans a subscriber picks between on the paywall (every plan with a period). */
export const paidPlans = plans.filter((p) => p.period != null)
