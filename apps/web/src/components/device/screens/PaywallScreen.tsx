import {
	CalendarClock,
	Check,
	Headphones,
	Infinity as InfinityIcon,
	Rocket,
	Sparkles,
	X,
	Zap
} from 'lucide-react'
import { paidPlans } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import {
	AppButton,
	AppCard,
	Glow,
	GUTTER_WIDE,
	HomeIndicator,
	IconDisc,
	INSET_BOTTOM,
	INSET_TOP,
	SelectionRow,
	StatusBar,
	type
} from '../parts'

/*
 * The app's paywall (apps/mobile/app/upgrade.tsx): the promise, what Premium
 * unlocks, identical plan rows, how the trial works, and the pinned shelf with
 * the price line and the action. Restore, Terms and Privacy sit further down
 * the scroll, as in the app.
 * 🎨 REPLACE: the promise and the features mirror PRO_FEATURES in the app.
 * Prices come from src/lib/pricing.ts, so this shows its placeholders until you
 * set real ones; the app always shows the store's.
 */
const FEATURES = [
	{ icon: InfinityIcon, label: 'Unlimited use of every feature' },
	{ icon: Zap, label: 'Faster, with no waiting' },
	{ icon: Rocket, label: 'New features first' },
	{ icon: Headphones, label: 'Priority support' }
]
/** Which paid plan the sample shows as picked (the yearly one, as in the app). */
const PICKED_PERIOD = 'year'
const TRIAL_DAYS = 7

/** The paywall, at 393 × 852 pt. */
export function PaywallScreen() {
	const plans = [...paidPlans].sort((a) => (a.period === PICKED_PERIOD ? -1 : 1))
	const picked = plans[0]
	return (
		<div className="absolute inset-0 overflow-hidden bg-bg text-ink">
			<Glow className="-left-[150px] -top-[140px] h-[600px] w-[600px]" />
			<StatusBar />

			<div
				className="absolute inset-x-0 flex flex-col gap-[22px]"
				style={{ top: INSET_TOP + 4, padding: `0 ${GUTTER_WIDE}px` }}
			>
				<IconDisc>
					<X size={18} strokeWidth={2.2} />
				</IconDisc>

				<div className="flex flex-col items-center gap-[12px] text-center">
					<span className="grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-brand-dim text-brand-ink">
						<Sparkles size={22} strokeWidth={2} />
					</span>
					<p style={{ ...type('display'), fontSize: 34, lineHeight: '38px' }}>Unlock everything</p>
					<p className="text-ink-secondary" style={type('lead')}>
						All of the app, with nothing held back.
					</p>
				</div>

				<div className="flex flex-col gap-[12px]">
					{FEATURES.map(({ icon: Icon, label }) => (
						<span key={label} className="flex items-center gap-[12px]" style={type('body')}>
							<span className="grid h-[32px] w-[32px] place-items-center rounded-[10px] bg-brand-dim text-brand-ink">
								<Icon size={16} strokeWidth={2} />
							</span>
							{label}
						</span>
					))}
				</div>

				<div className="flex flex-col gap-[10px]">
					{plans.map((plan) => (
						<SelectionRow
							key={plan.id}
							title={plan.period === 'year' ? 'Yearly' : 'Monthly'}
							subtitle={plan.period === 'year' ? 'Billed once a year' : 'Billed monthly'}
							isSelected={plan === picked}
							trailing={
								<span className="flex flex-col items-end">
									<span style={{ ...type('label'), fontVariantNumeric: 'tabular-nums' }}>
										{plan.price}
									</span>
									<span className="text-ink-tertiary" style={type('caption')}>
										per {plan.period}
									</span>
								</span>
							}
						/>
					))}
				</div>

				<AppCard tier="well" padding={24}>
					<p className="text-ink-secondary" style={type('eyebrow')}>
						How the free trial works
					</p>
					{[
						{ icon: Check, title: 'Today', body: 'Full access starts. Nothing is charged.' },
						{
							icon: CalendarClock,
							title: `Day ${TRIAL_DAYS}`,
							body: 'The trial ends and your plan begins, unless you cancel before.'
						}
					].map(({ icon: Icon, title, body }, i) => (
						<div key={title} className="mt-[14px] flex gap-[12px]">
							<span
								className={cn(
									'grid h-[26px] w-[26px] flex-none place-items-center rounded-full',
									i === 0 ? 'bg-brand text-on-brand' : 'bg-surface3 text-ink-secondary'
								)}
							>
								<Icon size={14} strokeWidth={2.4} />
							</span>
							<span className="flex flex-col">
								<span style={type('label')}>{title}</span>
								<span className="text-ink-secondary" style={type('bodySm')}>
									{body}
								</span>
							</span>
						</div>
					))}
				</AppCard>
			</div>

			<div
				className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-[10px] border-t border-line-hairline bg-surface shadow-overlay"
				style={{ padding: `12px ${GUTTER_WIDE}px ${INSET_BOTTOM + 12}px` }}
			>
				<p
					className="text-center text-ink-secondary"
					style={{ ...type('bodySm'), fontVariantNumeric: 'tabular-nums' }}
				>
					{TRIAL_DAYS} days free, then {picked?.price} per {picked?.period}
				</p>
				<AppButton withArrow>Start free trial</AppButton>
			</div>
			<HomeIndicator />
		</div>
	)
}
