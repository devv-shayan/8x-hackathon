import { FileCheck2, Gift, Lock, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionBand } from './parts'
import { PixelField } from './pixel/PixelField'
import type { PixelFieldName } from './pixel/fields'

const REASONS = [
	{
		icon: FileCheck2,
		title: 'From the video',
		text: 'Every answer is checked against the transcript.'
	},
	{ icon: Lock, title: 'Private help', text: 'The class never sees you look it up.' },
	{ icon: Smartphone, title: 'On your phone', text: 'One class takes about ten minutes.' },
	{ icon: Gift, title: 'Free to try', text: 'Paste a link and start.' }
]

const STUDENTS: {
	name: string
	role: string
	line: string
	field: PixelFieldName
	dark: boolean
}[] = [
	{
		name: 'Maya',
		role: 'The beginner · never saw the video',
		line: '“Wait, how can it be both? That doesn’t add up.”',
		field: 'maya',
		dark: true
	},
	{
		name: 'Omar',
		role: 'The sharp one · watched it twice',
		line: '“The video also covers confidence. You skipped it.”',
		field: 'omar',
		dark: false
	}
]

/** Why teaching works, then the two students who make it work. */
export function Students() {
	return (
		<div className="l-sans bg-[rgb(var(--l-paper))] pb-24 text-[rgb(var(--l-ink))] sm:pb-28">
			<SectionBand label="Why teaching works" />
			<section className="mx-auto max-w-content px-5 pt-14 sm:px-8">
				<h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.03em]">
					Everyone forgets.
					<br />
					Teaching it makes it <span className="l-hl">stick</span>.
				</h2>
				<ul className="mt-10 grid border border-[rgb(var(--l-hair))] sm:grid-cols-2 lg:grid-cols-4">
					{REASONS.map(({ icon: Icon, title, text }) => (
						<li
							key={title}
							className="border-b border-[rgb(var(--l-hair))] p-5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 sm:[&:nth-child(odd)]:border-r"
						>
							<p className="flex items-center gap-2 text-[15px]">
								<Icon aria-hidden="true" className="h-4 w-4" />
								{title}
							</p>
							<p className="mt-1.5 text-sm leading-relaxed text-[rgb(var(--l-muted))]">{text}</p>
						</li>
					))}
				</ul>
			</section>

			<div className="mt-24 sm:mt-28">
				<SectionBand label="The class" />
			</div>
			<section className="mx-auto max-w-content px-5 pt-14 sm:px-8">
				<h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.03em]">
					Meet the students who <span className="l-hl">keep you honest</span>.
				</h2>
				<ul className="mt-10 grid gap-4 md:grid-cols-2">
					{STUDENTS.map((student) => (
						<li
							key={student.name}
							className="relative flex min-h-[260px] flex-col justify-between overflow-hidden p-6"
						>
							<PixelField name={student.field} />
							<p
								className={cn(
									'relative max-w-[26ch] self-start px-2 py-1 text-[22px] leading-snug tracking-[-0.01em]',
									student.dark ? 'bg-black/55 text-white' : 'bg-white/85'
								)}
							>
								{student.line}
							</p>
							<p className="relative self-start bg-[rgb(var(--l-paper))] px-3 py-2">
								<span className="block text-[15px] font-medium">{student.name}</span>
								<span className="l-mono">{student.role}</span>
							</p>
						</li>
					))}
				</ul>
			</section>
		</div>
	)
}
