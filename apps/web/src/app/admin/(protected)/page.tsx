import { getSummaryCounts } from '@/lib/dashboard-stats'
import { leadStore } from '@/server/db/leads'

export const dynamic = 'force-dynamic'

/**
 * Headline counts.
 *
 * Paid users comes from `getSummaryCounts`, the same function behind the Play
 * Stats API — NOT from a local `plan_type = 'premium'` count. Those two are not
 * the same number: comps, RevenueCat promos, sandbox purchases and trials are
 * all premium in-app without being sales. When this screen and the dashboard
 * disagree, nobody knows which to trust and both stop being used.
 *
 * A count that fails fails the screen: it shows the error, never a 0.
 */
async function getStats() {
	const [counts, leads] = await Promise.all([getSummaryCounts(), leadStore.counts()])

	return {
		total: counts.usersTotal,
		premium: counts.byPlan.premium ?? 0,
		trial: counts.byPlan.trial ?? 0,
		newWeek: counts.newUsers7d,
		waitlist: leads.waitlist,
		messages: leads.contactMessages,
		countryCoverage: counts.countryCoverage
	}
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="card p-6">
			<p className="text-sm text-ink-mute">{label}</p>
			<p className="mt-2 text-3xl font-extrabold">{value.toLocaleString()}</p>
		</div>
	)
}

export default async function AdminOverviewPage() {
	let stats: Awaited<ReturnType<typeof getStats>> | null = null
	let error = ''
	try {
		stats = await getStats()
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load stats'
	}

	return (
		<div>
			<h1 className="text-2xl font-bold">Overview</h1>
			<p className="mt-1 text-sm text-ink-mute">
				Headline metrics. Extend with charts as the play grows.
			</p>

			{error ? (
				<div className="card mt-6 border-danger/40 p-6 text-sm text-danger">
					{error}
					<p className="mt-2 text-ink-mute">
						Make sure DATABASE_URL is set and the migrations have run.
					</p>
				</div>
			) : (
				<>
					<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<StatCard label="Total users" value={stats!.total} />
						<StatCard label="Paying users" value={stats!.premium} />
						<StatCard label="On trial" value={stats!.trial} />
						<StatCard label="New this week" value={stats!.newWeek} />
						<StatCard label="Waitlist signups" value={stats!.waitlist} />
						<StatCard label="Contact messages" value={stats!.messages} />
					</div>

					{/* Country coverage is the health check on what this play reports
              per-market. The dashboard cannot narrow anything to a market that
              the play never tagged, and a thin split reads as "this play cannot
              answer per-market" rather than as a gap in signup capture. */}
					{stats!.total > 0 && stats!.countryCoverage < 0.5 && (
						<div className="card mt-6 border-warning/40 p-5 text-sm">
							<p className="font-semibold">
								Only {Math.round(stats!.countryCoverage * 100)}% of accounts have a country.
							</p>
							<p className="mt-1 text-ink-mute">
								Every per-market number on the stats dashboard comes from{' '}
								<code>profiles.region</code>. Set it at signup (from the edge geo header) or the
								market filter has almost nothing to narrow.
							</p>
						</div>
					)}
				</>
			)}
		</div>
	)
}
