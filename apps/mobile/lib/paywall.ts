/**
 * What the paywall shows for each plan, read from the store's own products
 * (RevenueCat offerings) — the price, period and trial come from the store,
 * never from copy in the app.
 */
import type { PurchasesOfferings, PurchasesPackage } from '@/lib/purchases'

export type PlanPeriod = 'week' | 'month' | 'year' | 'lifetime'

export interface PlanOption {
	id: string
	title: string
	/** The store's formatted price, e.g. "$39.99". */
	price: string
	period: PlanPeriod
	/** A per-month equivalent for longer plans, e.g. "$3.33 / month". */
	perMonth?: string
	/** Saving against 12 × the monthly plan, when both exist. */
	savingsPct?: number
	/** A free trial the store will apply, in days. */
	trialDays?: number
	/** The package to buy. Absent for development previews. */
	pkg?: PurchasesPackage
}

const DAYS_PER_UNIT: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }

function periodOf(pkg: PurchasesPackage): PlanPeriod {
	switch (pkg.packageType) {
		case 'ANNUAL':
			return 'year'
		case 'WEEKLY':
			return 'week'
		case 'LIFETIME':
			return 'lifetime'
		default:
			return pkg.identifier.toLowerCase().includes('year') ? 'year' : 'month'
	}
}

const TITLE: Record<PlanPeriod, string> = {
	week: 'Weekly',
	month: 'Monthly',
	year: 'Yearly',
	lifetime: 'Lifetime'
}

/** The current offering as plan options, longest period first. */
export function plansFromOfferings(offerings: PurchasesOfferings | null): PlanOption[] {
	const packages = offerings?.current?.availablePackages ?? []
	const monthly = packages.find((p) => periodOf(p) === 'month')?.product.price

	const plans = packages.map((pkg): PlanOption => {
		const product = pkg.product
		const period = periodOf(pkg)
		const intro = product.introPrice
		const trialDays =
			intro && intro.price === 0
				? intro.periodNumberOfUnits * (DAYS_PER_UNIT[intro.periodUnit] ?? 0) || undefined
				: undefined
		let perMonth: string | undefined
		let savingsPct: number | undefined
		if (period === 'year' && product.price > 0) {
			perMonth = `${new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: product.currencyCode || 'USD',
				maximumFractionDigits: 2
			}).format(product.price / 12)} / month`
			if (monthly && monthly > 0) {
				const pct = Math.round((1 - product.price / (monthly * 12)) * 100)
				if (pct > 0) savingsPct = pct
			}
		}
		return {
			id: pkg.identifier,
			title: TITLE[period],
			price: product.priceString,
			period,
			perMonth,
			savingsPct,
			trialDays,
			pkg
		}
	})

	const order: Record<PlanPeriod, number> = { lifetime: 0, year: 1, month: 2, week: 3 }
	return plans.sort((a, b) => order[a.period] - order[b.period])
}

/** "per year", "per month", "once". */
export function periodPhrase(period: PlanPeriod): string {
	return period === 'lifetime' ? 'once' : `per ${period}`
}
