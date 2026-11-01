import { Brain, CheckCheck, Repeat } from 'lucide-react'
import { Container } from '../Container'
import { PixelField } from './pixel/PixelField'

/**
 * The pixel steps from the white page down into the black band, as [column, row] cells on a
 * 48-column grid: sparse on top, denser just above the band.
 */
const STEP_COLUMNS = 48
const STEPS = [
	[2, 1],
	[9, 1],
	[23, 1],
	[38, 1],
	[1, 2],
	[2, 2],
	[3, 2],
	[8, 2],
	[9, 2],
	[14, 2],
	[22, 2],
	[23, 2],
	[24, 2],
	[30, 2],
	[37, 2],
	[38, 2],
	[44, 2],
	[45, 2]
] as const

const TIMELINE = [
	{ label: 'Class', lit: false },
	{ label: 'Gap found', lit: true },
	{ label: '2 days', gap: true },
	{ label: 'Warm-up', lit: false },
	{ label: 'Right · 5 days', gap: true },
	{ label: 'Warm-up', lit: false },
	{ label: 'Closed', lit: true }
]

const POINTS = [
	{
		icon: Repeat,
		title: 'One-minute warm-ups',
		text: 'A single question, while your next video loads.'
	},
	{
		icon: Brain,
		title: 'Students who remember',
		text: 'The same student asks, and remembers what you said.'
	},
	{
		icon: CheckCheck,
		title: 'Closed after two rights',
		text: 'A wrong answer brings it back in 2 days.'
	}
]

/** The black band: why gaps come back, over the lime tunnel. */
export function Remember() {
	return (
		<section id="remember" className="l-sans scroll-mt-14 bg-[rgb(var(--l-paper))] pt-24 sm:pt-28">
			<div
				aria-hidden="true"
				className="grid"
				style={{ gridTemplateColumns: `repeat(${STEP_COLUMNS}, 1fr)` }}
			>
				{STEPS.map(([column, row]) => (
					<span
						key={`${column}-${row}`}
						className="aspect-square bg-[rgb(var(--l-ink))]"
						style={{ gridColumn: column, gridRow: row }}
					/>
				))}
			</div>
			<div className="relative overflow-hidden bg-[rgb(var(--l-ink))] text-white">
				<PixelField name="tunnel" />
				<Container className="relative py-20 sm:py-24">
					<h2 className="max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.8rem)] font-medium leading-[1.12] tracking-[-0.03em]">
						You forget most of a video in a week.{' '}
						<span className="text-white/55">Maya makes sure you don&rsquo;t.</span>
					</h2>
					<ol className="mt-12 flex flex-wrap items-center gap-2 font-[family-name:var(--font-jetbrains)] text-[11px] uppercase tracking-[0.06em]">
						{TIMELINE.map((step, i) =>
							'gap' in step ? (
								<li key={i} className="px-1 text-white/55">
									── {step.label} ──
								</li>
							) : (
								<li
									key={i}
									className={
										step.lit
											? 'bg-[rgb(var(--l-lime))] px-2.5 py-1.5 text-[rgb(var(--l-ink))]'
											: 'border border-white/25 bg-[rgb(var(--l-ink))] px-2.5 py-1.5'
									}
								>
									{step.label}
								</li>
							)
						)}
					</ol>
					<ul className="mt-12 grid gap-3 md:grid-cols-3">
						{POINTS.map(({ icon: Icon, title, text }) => (
							<li key={title} className="bg-[rgb(var(--l-ink)/0.78)] p-4 backdrop-blur-sm">
								<p className="flex items-center gap-2 text-[15px]">
									<Icon aria-hidden="true" className="h-4 w-4 text-[rgb(var(--l-lime))]" />
									{title}
								</p>
								<p className="mt-1.5 text-sm leading-relaxed text-white/65">{text}</p>
							</li>
						))}
					</ul>
				</Container>
			</div>
		</section>
	)
}
