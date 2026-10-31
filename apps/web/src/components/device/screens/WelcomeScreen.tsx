import { Check, Sparkles } from 'lucide-react'
import { brandConfig } from '@app/brand'
import {
	AppButton,
	AppMark,
	Glow,
	GUTTER_WIDE,
	HomeIndicator,
	INSET_BOTTOM,
	INSET_TOP,
	ProgressBar,
	StatusBar,
	type
} from '../parts'

/*
 * The app's welcome screen (apps/mobile/app/index.tsx): the mark and name, three
 * cards dealt onto the table, the tagline, one way forward.
 * 🎨 REPLACE: the tagline and description mirror APP_TAGLINE and
 * APP_DESCRIPTION in apps/mobile/lib/constants.ts; change them together.
 */
const TAGLINE = 'Teach it. The class talks back.'
const DESCRIPTION =
	'Explain what you watched to AI students who ask about what you missed, so it sticks.'

/** The dealt cards' resting poses, as in the app. */
const CARDS = [
	{ rotate: -8, x: -46, y: -52 },
	{ rotate: 6, x: 42, y: -8 },
	{ rotate: -2, x: -6, y: 56 }
] as const

function DealtCard({ index, children }: { index: number; children: React.ReactNode }) {
	const pose = CARDS[index] ?? CARDS[0]
	return (
		<div
			className="absolute left-1/2 top-1/2 flex w-[236px] flex-col gap-[10px] rounded-card border border-line-hairline bg-surface2 p-[16px] shadow-raised"
			style={{
				zIndex: index + 1,
				transform: `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg)`
			}}
		>
			{children}
		</div>
	)
}

/** The app's first screen, at 393 × 852 pt. */
export function WelcomeScreen() {
	return (
		<div className="absolute inset-0 overflow-hidden bg-bg text-ink">
			<Glow className="-left-[98px] -top-[80px] h-[590px] w-[590px]" />
			<StatusBar />

			<div
				className="absolute inset-x-0 flex items-center gap-[10px]"
				style={{ top: INSET_TOP + 12, padding: `0 ${GUTTER_WIDE}px` }}
			>
				<AppMark size={32} />
				<span style={type('label')}>{brandConfig.appName}</span>
			</div>

			<div className="absolute inset-x-0 top-[150px] h-[250px]">
				<DealtCard index={0}>
					<span className="text-ink-tertiary" style={type('eyebrow')}>
						This week
					</span>
					<span style={{ ...type('number'), marginTop: -2 }}>24</span>
					<span className="text-ink-secondary" style={type('caption')}>
						items moved forward
					</span>
				</DealtCard>
				<DealtCard index={1}>
					<span className="flex items-center gap-[12px]">
						<span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-success-soft text-success-text">
							<Check size={16} strokeWidth={2.4} />
						</span>
						<span className="flex flex-col">
							<span style={type('label')}>Morning review</span>
							<span className="text-ink-secondary" style={type('caption')}>
								Done · 8:40
							</span>
						</span>
					</span>
				</DealtCard>
				<DealtCard index={2}>
					<span className="flex items-center gap-[12px]">
						<span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-brand-dim text-brand-ink">
							<Sparkles size={16} strokeWidth={2} />
						</span>
						<span className="flex flex-col">
							<span style={type('label')}>Your first project</span>
							<span className="text-ink-secondary" style={type('caption')}>
								3 of 5 steps
							</span>
						</span>
					</span>
					<ProgressBar value={0.62} />
				</DealtCard>
			</div>

			<div
				className="absolute inset-x-0 flex flex-col gap-[14px]"
				style={{ bottom: INSET_BOTTOM + 200, padding: `0 ${GUTTER_WIDE}px` }}
			>
				<p className="text-balance" style={type('display')}>
					{TAGLINE}
				</p>
				<p className="text-ink-secondary" style={type('lead')}>
					{DESCRIPTION}
				</p>
			</div>

			<div
				className="absolute inset-x-0 flex flex-col gap-[6px]"
				style={{ bottom: INSET_BOTTOM + 16, padding: `0 ${GUTTER_WIDE}px` }}
			>
				<AppButton withArrow>Get started</AppButton>
				<AppButton variant="ghost" size="md">
					I already have an account
				</AppButton>
				<p className="mt-[8px] text-center text-ink-tertiary" style={type('caption')}>
					By continuing you agree to the <span className="text-ink-secondary underline">Terms</span>{' '}
					and <span className="text-ink-secondary underline">Privacy Policy</span>.
				</p>
			</div>
			<HomeIndicator />
		</div>
	)
}
