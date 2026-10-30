import { CircleAlert, Flag, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
	AppCard,
	Eyebrow,
	GUTTER,
	HomeIndicator,
	INSET_TOP,
	ProgressBar,
	StatusBadge,
	StatusBar,
	TabBar,
	type
} from '../parts'

/*
 * The app's home tab (apps/mobile/app/(tabs)/index.tsx): date and greeting,
 * the at-a-glance panel, recent items, latest activity, the glass tab bar.
 * 🎨 REPLACE: sample content. The greeting's name and the stats are the app's
 * development demo data (apps/mobile/lib/mockData.ts); the item and activity
 * rows are samples, since the app lists those from the API. Swap them for your
 * app's, or pass a real screenshot to <DeviceFrame src>.
 */
const TODAY = 'Wednesday, 24 September'
const GREETING = 'Good evening, Avery'
const STATS = [
	{ value: '24', label: 'Items' },
	{ value: '78%', label: 'Completion' },
	{ value: '41', label: 'Active users' }
]
const ITEMS = [
	{
		name: 'Project Alpha',
		meta: 'Avery Quinn · Updated 2h ago',
		status: 'active',
		summary: 'Progress is on track with all milestones ahead of schedule.',
		completion: 82,
		active: 18
	},
	{
		name: 'Project Beta',
		meta: 'Maya Park · Updated 45m ago',
		status: 'pending',
		summary: 'Waiting on review feedback before moving to the next phase.',
		completion: 61,
		active: 11
	}
] as const
const ACTIVITY = [
	{ icon: Flag, title: 'Phase 2 completed', when: '22m ago', isAlert: false },
	{ icon: MessageCircle, title: 'New feedback received', when: '1h ago', isAlert: false },
	{ icon: CircleAlert, title: 'Deadline approaching', when: '3h ago', isAlert: true }
]

/** The app's home tab, at 393 × 852 pt. */
export function HomeScreen() {
	return (
		<div className="absolute inset-0 overflow-hidden bg-bg text-ink">
			<StatusBar />

			<div
				className="absolute inset-x-0 flex flex-col gap-[14px]"
				style={{ top: INSET_TOP + 8, padding: `0 ${GUTTER}px` }}
			>
				<div className="mb-[4px] flex flex-col gap-[8px]">
					<Eyebrow tone="muted">{TODAY}</Eyebrow>
					<p style={type('title')}>{GREETING}</p>
				</div>

				<AppCard tier="hero" padding={24}>
					<p className="text-hero-text-secondary" style={type('eyebrow')}>
						At a glance · demo data
					</p>
					<div className="mt-[16px] flex">
						{STATS.map((s) => (
							<div key={s.label} className="flex flex-1 flex-col gap-[4px]">
								<span style={{ ...type('number'), fontSize: 28, lineHeight: '32px' }}>
									{s.value}
								</span>
								<span className="text-hero-text-secondary" style={type('caption')}>
									{s.label}
								</span>
							</div>
						))}
					</div>
				</AppCard>

				<div className="flex items-baseline justify-between pt-[4px]">
					<p style={type('h3')}>Recent items</p>
					<p className="text-brand-ink" style={type('label')}>
						See all
					</p>
				</div>

				{ITEMS.map((item) => (
					<AppCard key={item.name}>
						<div className="flex items-start gap-[12px]">
							<div className="flex flex-1 flex-col gap-[3px]">
								<span style={type('label')}>{item.name}</span>
								<span className="text-ink-tertiary" style={type('caption')}>
									{item.meta}
								</span>
							</div>
							<StatusBadge status={item.status} />
						</div>
						<p className="mt-[10px] text-ink-secondary" style={type('bodySm')}>
							{item.summary}
						</p>
						<div className="mt-[14px] flex flex-col gap-[8px]">
							<ProgressBar value={item.completion / 100} />
							<span
								className="text-ink-secondary"
								style={{ ...type('caption'), fontVariantNumeric: 'tabular-nums' }}
							>
								{item.completion}% complete · {item.active} active
							</span>
						</div>
					</AppCard>
				))}

				<p className="pt-[4px]" style={type('h3')}>
					Latest activity
				</p>
				<div className="rounded-card border border-line-hairline bg-surface">
					{ACTIVITY.map(({ icon: Icon, title, when, isAlert }, i) => (
						<div
							key={title}
							className={cn(
								'flex min-h-[60px] items-center gap-[12px] px-[16px] py-[12px]',
								i > 0 && 'border-t border-line-hairline'
							)}
						>
							<span
								className={cn(
									'grid h-[36px] w-[36px] place-items-center rounded-[12px]',
									isAlert ? 'bg-warning-soft text-warning-text' : 'bg-brand-dim text-brand-ink'
								)}
							>
								<Icon size={18} strokeWidth={2} />
							</span>
							<span className="flex-1" style={type('label')}>
								{title}
							</span>
							<span className="text-ink-tertiary" style={type('bodySm')}>
								{when}
							</span>
						</div>
					))}
				</div>
			</div>

			<span
				aria-hidden="true"
				className="absolute inset-x-0 bottom-0 z-[5] h-[160px] bg-gradient-to-t from-bg via-bg/80 to-bg-fade"
			/>
			<TabBar active={0} />
			<HomeIndicator />
		</div>
	)
}
