import { getRetentionCohorts, getSummaryCounts } from '@/lib/dashboard-stats'
import { FUNNEL_EVENTS, CHECKOUT_EVENTS, LIFECYCLE_EVENTS } from '@/lib/analytics/events'
import { analyticsStore } from '@/server/db/analytics'

export const dynamic = 'force-dynamic'

/**
 * What the play's own event log says.
 *
 * Everything here reads `analytics_events` rather than PostHog, deliberately:
 * this is the data that survives an ad blocker, goes back further than the day
 * PostHog was installed, and is the same source the Play Stats API reports
 * retention from. If a number here disagrees with PostHog, this one is the one
 * the dashboard sees.
 */

const FUNNEL: { name: string; label: string }[] = [
	{ name: FUNNEL_EVENTS.landingView, label: 'Landing viewed' },
	{ name: FUNNEL_EVENTS.pricingView, label: 'Pricing viewed' },
	{ name: FUNNEL_EVENTS.planSelected, label: 'Plan selected' },
	{ name: CHECKOUT_EVENTS.upgradeView, label: 'Paywall viewed' },
	{ name: CHECKOUT_EVENTS.checkoutStarted, label: 'Checkout started' },
	{ name: CHECKOUT_EVENTS.purchase, label: 'Purchased' }
]

const DAYS = 30

async function getAnalytics() {
	const since = new Date(Date.now() - DAYS * 86_400_000)

	// A count that fails fails the screen: it shows the error, never a 0.
	const counts = await Promise.all(
		FUNNEL.map(async (step) => ({
			...step,
			count: await analyticsStore.countSince(step.name, since)
		}))
	)

	// Which events are actually arriving. An event registered months ago and
	// sitting at zero is usually a call site that was never wired, not a feature
	// nobody uses — worth seeing side by side.
	const tracked = [
		...Object.values(FUNNEL_EVENTS),
		...Object.values(LIFECYCLE_EVENTS),
		...Object.values(CHECKOUT_EVENTS)
	]
	const volumes = await Promise.all(
		tracked.map(async (name) => ({ name, count: await analyticsStore.countSince(name, since) }))
	)

	const [summary, cohorts] = await Promise.all([getSummaryCounts(), getRetentionCohorts()])

	// Only cohorts old enough to have completed the window. A cohort from
	// yesterday has not had 7 days to come back, and averaging it in as 0 reports
	// "nobody returned" when the honest answer is "not yet known".
	const mature = (key: 'd1' | 'd7' | 'd30') => {
		const rows = cohorts.filter((c) => c[key] !== undefined && c.signups > 0)
		if (rows.length === 0) return null
		const signups = rows.reduce((a, c) => a + c.signups, 0)
		const retained = rows.reduce((a, c) => a + (c[key] ?? 0), 0)
		return { rate: retained / signups, signups }
	}

	return {
		funnel: counts,
		volumes: volumes.sort((a, b) => b.count - a.count),
		summary,
		retention: { d1: mature('d1'), d7: mature('d7'), d30: mature('d30') }
	}
}

function pct(n: number) {
	return `${(n * 100).toFixed(1)}%`
}

export default async function AdminAnalyticsPage() {
	let data: Awaited<ReturnType<typeof getAnalytics>> | null = null
	let error = ''
	try {
		data = await getAnalytics()
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load analytics'
	}

	if (error) {
		return (
			<div>
				<h1 className="text-2xl font-bold">Analytics</h1>
				<div className="card mt-6 border-danger/40 p-6 text-sm text-danger">
					{error}
					<p className="mt-2 text-ink-mute">
						Check DATABASE_URL, and that the migrations have run.
					</p>
				</div>
			</div>
		)
	}

	const top = data!.funnel[0]?.count ?? 0

	return (
		<div className="space-y-10">
			<div>
				<h1 className="text-2xl font-bold">Analytics</h1>
				<p className="mt-1 text-sm text-ink-mute">
					From this play&apos;s own event log, last {DAYS} days. Not PostHog — this is what the
					stats dashboard reads.
				</p>
			</div>

			{/* ── Funnel ─────────────────────────────────────────────────────────── */}
			<section>
				<h2 className="text-lg font-semibold">Funnel</h2>
				<div className="card mt-4 divide-y divide-border-soft">
					{data!.funnel.map((step) => (
						<div key={step.name} className="flex items-center gap-4 p-4">
							<div className="w-40 flex-none text-sm">{step.label}</div>
							<div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
								<div
									className="h-full rounded-full bg-accent"
									style={{ width: top > 0 ? `${(step.count / top) * 100}%` : '0%' }}
								/>
							</div>
							<div className="w-28 flex-none text-right text-sm tabular-nums">
								{step.count.toLocaleString()}
								{top > 0 && <span className="ml-2 text-ink-mute">{pct(step.count / top)}</span>}
							</div>
						</div>
					))}
				</div>
				<p className="mt-2 text-xs text-ink-mute">
					Deduped once per visitor per day, so these are people, not page loads.
				</p>
			</section>

			{/* ── Retention ──────────────────────────────────────────────────────── */}
			<section>
				<h2 className="text-lg font-semibold">Retention</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-3">
					{(['d1', 'd7', 'd30'] as const).map((k) => {
						const r = data!.retention[k]
						return (
							<div key={k} className="card p-6">
								<p className="text-sm text-ink-mute">{k.toUpperCase()}</p>
								<p className="mt-2 text-3xl font-extrabold">{r ? pct(r.rate) : 'n/a'}</p>
								<p className="mt-1 text-xs text-ink-mute">
									{r
										? `${r.signups.toLocaleString()} accounts in mature cohorts`
										: 'No cohort is old enough yet'}
								</p>
							</div>
						)
					})}
				</div>
				<p className="mt-2 text-xs text-ink-mute">
					Active again on <em>exactly</em> day N, over cohorts old enough to have completed the
					window. A rolling &ldquo;within N days&rdquo; reads considerably higher and is not
					comparable to the benchmarks.
				</p>
			</section>

			{/* ── Event volumes ──────────────────────────────────────────────────── */}
			<section>
				<h2 className="text-lg font-semibold">Event volume</h2>
				<div className="card mt-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="border-b border-border-soft text-left text-ink-mute">
							<tr>
								<th className="p-3 font-medium">Event</th>
								<th className="p-3 text-right font-medium">Last {DAYS}d</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border-soft">
							{data!.volumes.map((v) => (
								<tr key={v.name} className={v.count === 0 ? 'text-ink-mute' : ''}>
									<td className="p-3 font-mono text-xs">{v.name}</td>
									<td className="p-3 text-right tabular-nums">{v.count.toLocaleString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="mt-2 text-xs text-ink-mute">
					A registered event sitting at zero is usually a call site that was never wired, not a
					feature nobody uses. Run <code>npm run check:events</code>.
				</p>
			</section>

			{/* ── Markets ────────────────────────────────────────────────────────── */}
			<section>
				<h2 className="text-lg font-semibold">Markets</h2>
				<div className="card mt-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="border-b border-border-soft text-left text-ink-mute">
							<tr>
								<th className="p-3 font-medium">Country</th>
								<th className="p-3 text-right font-medium">Users</th>
								<th className="p-3 text-right font-medium">Paying</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border-soft">
							{Object.entries(data!.summary.byCountry)
								.sort(([, a], [, b]) => b - a)
								.slice(0, 20)
								.map(([code, users]) => (
									<tr key={code}>
										<td className="p-3">{code}</td>
										<td className="p-3 text-right tabular-nums">{users.toLocaleString()}</td>
										<td className="p-3 text-right tabular-nums">
											{(data!.summary.paidByCountry[code] ?? 0).toLocaleString()}
										</td>
									</tr>
								))}
						</tbody>
					</table>
				</div>
				<p className="mt-2 text-xs text-ink-mute">
					{pct(data!.summary.countryCoverage)} of accounts carry a country. The rest show as
					unattributed on the stats dashboard.
				</p>
			</section>
		</div>
	)
}
