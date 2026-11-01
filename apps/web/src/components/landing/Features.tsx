import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
	BookOpen,
	CircleDot,
	EyeOff,
	ListChecks,
	PenLine,
	Play,
	Timer,
	TrendingUp
} from 'lucide-react'
import { TrackInView } from '@/components/TrackInView'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'
import { AppCard, AppRow, FixedTag, SectionBand, StartLink } from './parts'
import { PixelField } from './pixel/PixelField'
import type { PixelFieldName } from './pixel/fields'

type Feature = { icon: LucideIcon; label: string; text: string; tone?: string }

/** A product section: a highlighted name, a line, features on the left, app UI over a live background on the right. */
function FeatureSplit({
	id,
	name,
	highlight,
	lead,
	features,
	field,
	children
}: {
	id?: string
	name: string
	highlight: string
	lead: string
	features: Feature[]
	field: PixelFieldName
	children: ReactNode
}) {
	return (
		<section id={id} className="mx-auto max-w-content scroll-mt-20 px-5 pt-20 sm:px-8 sm:pt-24">
			<h2 className="text-[26px] font-medium tracking-[-0.02em]">
				<span className={cn('px-1.5', highlight)}>{name}</span>
			</h2>
			<p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-[rgb(var(--l-muted))]">
				{lead}
			</p>
			<div className="mt-8 grid border border-[rgb(var(--l-hair))] md:grid-cols-[0.85fr_1.3fr]">
				<ul className="border-b border-[rgb(var(--l-hair))] md:border-b-0 md:border-r">
					{features.map(({ icon: Icon, label, text, tone }) => (
						<li key={label} className="border-b border-[rgb(var(--l-hair))] p-5 last:border-b-0">
							<p
								className="l-mono flex items-center gap-2"
								style={tone ? { color: tone } : undefined}
							>
								<Icon aria-hidden="true" className="h-3.5 w-3.5" />
								{label}
							</p>
							<p className="mt-2 text-[15px] leading-relaxed">{text}</p>
						</li>
					))}
				</ul>
				<div className="relative flex min-h-[300px] items-center overflow-hidden py-10 pl-8 pr-0 sm:pl-12">
					<PixelField name={field} />
					{children}
				</div>
			</div>
		</section>
	)
}

/** "How it works": the loop in one line, then Explain, Teach the class and See what stuck. */
export function Features() {
	return (
		<div className="l-sans bg-[rgb(var(--l-paper))] text-[rgb(var(--l-ink))]">
			<div id="how" className="relative scroll-mt-14">
				<TrackInView name={FUNNEL_EVENTS.storyView} />
				<SectionBand label="How it works" />
			</div>
			<div className="mx-auto max-w-content px-5 sm:px-8">
				<div className="mx-auto mt-14 max-w-3xl border border-[rgb(var(--l-hair))] px-6 py-10 text-center">
					<h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.03em]">
						One <span className="l-hl">study loop</span> for everything you watch.
					</h2>
					<p className="mx-auto mt-4 max-w-[48ch] text-[17px] leading-relaxed text-[rgb(var(--l-muted))]">
						Explain it, teach it, and come back to what you missed. One place for every video
						you&rsquo;re learning from.
					</p>
					<StartLink placement="loop" className="mt-6" />
				</div>
			</div>

			<FeatureSplit
				name="Explain"
				highlight="bg-[rgb(var(--l-lime))]"
				lead="Write what you learned. The key ideas stay hidden, so you can't just copy them."
				field="voiceWaves"
				features={[
					{
						icon: EyeOff,
						label: 'Hidden key ideas',
						text: "Read straight from the video's transcript."
					},
					{
						icon: Timer,
						label: 'Scored quietly',
						text: 'Your score stays hidden until the class ends.'
					},
					{
						icon: PenLine,
						label: 'Your own words',
						text: 'No multiple choice. Explain it like a teacher.'
					}
				]}
			>
				<AppCard className="w-full max-w-md">
					<AppRow>
						<span className="l-mono">Explain · Try something new for 30 days</span>
					</AppRow>
					<AppRow className="block leading-relaxed">
						Try something new for 30 days. He felt stuck, so he took on small challenges like a
						photo a day
						<span
							aria-hidden="true"
							className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-current"
						/>
					</AppRow>
					<AppRow>
						<span className="l-mono">58 words</span>
						<span className="bg-[rgb(var(--l-ink))] px-2 py-1 text-[12px] text-white">
							Start the class
						</span>
					</AppRow>
				</AppCard>
			</FeatureSplit>

			<FeatureSplit
				id="class"
				name="Teach the class"
				highlight="bg-[rgb(var(--l-gold))]"
				lead="Two students with different minds. You pick whose hand to take."
				field="goldDrift"
				features={[
					{
						icon: CircleDot,
						label: 'Maya, the beginner',
						text: "Knows only what you told her. Catches what doesn't add up.",
						tone: 'rgb(var(--l-maya))'
					},
					{
						icon: CircleDot,
						label: 'Omar, the sharp one',
						text: 'Watched the video. Asks about what you left out.',
						tone: 'rgb(var(--l-omar))'
					},
					{
						icon: BookOpen,
						label: "I'll be back",
						text: 'Stuck? Private help from the exact moment in the video.'
					}
				]}
			>
				<AppCard className="w-full max-w-md">
					<AppRow className="justify-start">
						<span className="border border-[rgb(var(--l-ink))] px-2 py-0.5">
							<span className="text-[rgb(var(--l-maya))]">●</span> Maya ✋
						</span>
						<span className="px-2 py-0.5 text-[rgb(var(--l-faint))]">
							<span className="text-[rgb(var(--l-omar))]">●</span> Omar
						</span>
						<span className="l-mono ml-auto">Q 2 / 4</span>
					</AppRow>
					<AppRow>How can big challenges stick if we only do small things?</AppRow>
					<AppRow className="justify-end">
						<span className="bg-[rgb(var(--l-ink))] px-2 py-1 text-white">
							I said it backwards. Small ones last.
						</span>
					</AppRow>
					<AppRow>
						<span className="l-mono">I&rsquo;ll be back · skip · end</span>
					</AppRow>
				</AppCard>
			</FeatureSplit>

			<FeatureSplit
				name="See what stuck"
				highlight="bg-[rgb(var(--l-peach))]"
				lead="Your first score, your score after teaching, and every gap linked to the video."
				field="warmUpRipples"
				features={[
					{ icon: TrendingUp, label: 'Before and after', text: 'See how much teaching fixed.' },
					{
						icon: Play,
						label: 'Jump to the moment',
						text: "Every gap opens the video where it's explained."
					},
					{ icon: ListChecks, label: 'Every question', text: 'Answered, needed help, or skipped.' }
				]}
			>
				<AppCard className="w-full max-w-md">
					<AppRow>
						<span>Results</span>
						<span>
							<s className="text-[rgb(var(--l-faint))]">2/5</s> <b className="font-semibold">3/5</b>
						</span>
					</AppRow>
					<AppRow>
						Small sustainable changes
						<FixedTag>Fixed in class</FixedTag>
					</AppRow>
					<AppRow>
						Growing self-confidence
						<span className="l-mono">▶ 1:06</span>
					</AppRow>
					<AppRow>
						Writing a novel in a month
						<span className="l-mono">▶ 1:51</span>
					</AppRow>
				</AppCard>
			</FeatureSplit>
		</div>
	)
}
