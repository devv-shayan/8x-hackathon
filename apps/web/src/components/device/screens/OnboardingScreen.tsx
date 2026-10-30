import { ChevronLeft, Moon, Sun, SunMoon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
	AppButton,
	Eyebrow,
	GUTTER,
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
 * The app's onboarding, on its appearance step (apps/mobile/app/(onboarding)):
 * back, the progress dots, the step, the question, three choices applied
 * live, and the floating Finish.
 */
const STEP = { at: 2, of: 2 }
const APPEARANCE = [
	{
		icon: SunMoon,
		title: 'Match my phone',
		subtitle: 'Follows your system setting',
		isPicked: true
	},
	{ icon: Sun, title: 'Light', subtitle: 'Bright surfaces, dark text' },
	{ icon: Moon, title: 'Dark', subtitle: 'Easy on the eyes at night' }
]

/** The progress dots: the current step stretched, steps reached in the accent ink. */
function ProgressDots() {
	return (
		<span className="flex flex-1 items-center justify-center gap-[6px]">
			{Array.from({ length: STEP.of }, (_, i) => (
				<span
					key={i}
					className={cn(
						'h-[6px] rounded-full',
						i + 1 === STEP.at ? 'w-[22px]' : 'w-[6px]',
						i + 1 <= STEP.at ? 'bg-brand-ink' : 'bg-line-active'
					)}
				/>
			))}
		</span>
	)
}

/** An onboarding step, at 393 × 852 pt. */
export function OnboardingScreen() {
	return (
		<div className="absolute inset-0 overflow-hidden bg-bg text-ink">
			<StatusBar />
			<div
				className="absolute inset-x-0 flex items-center"
				style={{ top: INSET_TOP + 6, padding: `0 ${GUTTER - 4}px` }}
			>
				<span className="flex w-[88px]">
					<IconDisc>
						<ChevronLeft size={20} strokeWidth={2} />
					</IconDisc>
				</span>
				<ProgressDots />
				<span className="w-[88px]" />
			</div>

			<div
				className="absolute inset-x-0 flex flex-col gap-[22px]"
				style={{ top: INSET_TOP + 78, padding: `0 ${GUTTER_WIDE}px` }}
			>
				<Eyebrow>{`Step ${STEP.at} of ${STEP.of}`}</Eyebrow>
				<div className="flex flex-col gap-[10px]">
					<p className="text-balance" style={type('question')}>
						Light, dark, or match your phone?
					</p>
					<p className="text-ink-secondary" style={type('body')}>
						The app changes as you choose. You can switch any time in Settings.
					</p>
				</div>
				<div className="flex flex-col gap-[10px]">
					{APPEARANCE.map(({ icon: Icon, title, subtitle, isPicked }) => (
						<SelectionRow
							key={title}
							title={title}
							subtitle={subtitle}
							isSelected={isPicked}
							leading={
								<span
									className={cn(
										'grid h-[36px] w-[36px] place-items-center rounded-[12px]',
										isPicked ? 'bg-surface text-brand-ink' : 'bg-surface3 text-ink-secondary'
									)}
								>
									<Icon size={18} strokeWidth={2} />
								</span>
							}
						/>
					))}
				</div>
			</div>

			<div className="absolute inset-x-0 bottom-0">
				<span className="block h-[56px] bg-gradient-to-b from-bg-fade to-bg" />
				<div className="bg-bg" style={{ padding: `0 ${GUTTER_WIDE}px ${INSET_BOTTOM + 12}px` }}>
					<AppButton withArrow>Finish</AppButton>
				</div>
			</div>
			<HomeIndicator />
		</div>
	)
}
