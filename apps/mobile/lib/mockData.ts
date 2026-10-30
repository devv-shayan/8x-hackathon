/**
 * Mock / placeholder data for the template — DEVELOPMENT BUILDS ONLY.
 *
 * It fills what has no data source yet while you build: the demo user's role
 * line, the stats panel and the paywall's preview plans. Lists (items, tasks,
 * activity, notifications) come from the API in every build; with no backend
 * configured, their screens say so instead of showing made-up rows.
 *
 * Never import this file. Read it through `devPlaceholders` in
 * lib/devPlaceholders.ts, which loads it only when `__DEV__` is true, so a
 * release build does not contain it at all (placeholder content in a store
 * build is an App Store 2.1 rejection). Shared types live in lib/types.ts.
 */

import type { PlanOption } from './paywall'

// ─── Demo user ────────────────────────────────────────────────────────────────

export const demoUser = {
	fullName: 'Avery Quinn',
	email: 'avery.quinn@example.com',
	role: 'Admin',
	teamName: 'My Team',
	initials: 'AQ'
}

// ─── Stats panel (Home) ───────────────────────────────────────────────────────

export const insightCards = [
	{ id: 'metric-1', label: 'Items', value: 24, unit: '', delta: '+3 this week' },
	{ id: 'metric-2', label: 'Completion', value: 78, unit: '%', delta: '+2.1%' },
	{ id: 'metric-3', label: 'Active users', value: 41, unit: '', delta: '+5 today' }
]

// ─── Paywall preview ──────────────────────────────────────────────────────────
// Sample plans so the paywall can be built and reviewed before the store
// products exist. Shown only when the store returns nothing, labelled as a
// preview, and never purchasable: real prices always come from the store.

export const paywallPreview: PlanOption[] = [
	{
		id: 'preview-annual',
		title: 'Yearly',
		price: '$39.99',
		period: 'year',
		perMonth: '$3.33 / month',
		savingsPct: 33,
		trialDays: 7
	},
	{ id: 'preview-monthly', title: 'Monthly', price: '$4.99', period: 'month' }
]
