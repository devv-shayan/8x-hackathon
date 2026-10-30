'use client'

import { useRef, useState } from 'react'
import {
	motion,
	useMotionValueEvent,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform
} from 'motion/react'
import { cn, type CssVars } from '@/lib/utils'
import { Container } from '../Container'
import { DeviceFrame } from '../device/DeviceFrame'
import { Reveal } from '../motion/Reveal'
import { useMotionTokens } from '../motion/MotionProvider'

/**
 * Where an act's light falls (as % of the scene) and how strong it is (0 to 1).
 * Every act is lit by the accent alone: the story changes the light, not the hue.
 */
export interface ActLight {
	x: number
	y: number
	strength: number
}

export interface StoryAct {
	id: string
	/** Two or three words: the act's name beside its number. */
	label: string
	title: string
	body: string
	/** The app screen this act deals onto the phone. */
	screen: React.ReactNode
	/** What that screen shows, for screen readers. */
	screenLabel: string
	light: ActLight
}

/** Scroll given to each act once the section is pinned, in viewport heights. */
const VH_PER_ACT = 85
/** Extra scroll after the last act so it can be read before the pin releases. */
const HEADROOM_VH = 40

const number = (i: number) => String(i + 1).padStart(2, '0')
const stateOf = (i: number, active: number) =>
	i < active ? 'past' : i === active ? 'active' : 'future'
const lightVars = ({ x, y, strength }: ActLight): CssVars => ({
	'--act-x': `${x}%`,
	'--act-y': `${y}%`,
	'--act-a': strength
})

/**
 * The story, told by pinning one phone and scrolling the acts through it.
 *
 * One index, from the section's scroll progress, decides the current act; the
 * choreography between acts is CSS transitions on that state (`.deal`, `.act`
 * in globals.css), not scroll-linked opacity ramps: those crossfade two acts
 * into mush whenever the reader stops between them, and Motion's scroll
 * timeline spaces multi-stop keyframes evenly regardless of the stops. What
 * does follow every frame of scroll is the camera: the phone turns and pushes
 * in across the whole story, so the pin reads as a scene playing, not a page
 * stuck. The light moves with the acts: across the scene on dusk, and on
 * daylight as the marigold field behind the phone, carrying the act's number
 * in ink.
 *
 * Below lg the same acts are a stack of cards, no pinning.
 */
export function SceneScroll({ heading, acts }: { heading: string; acts: StoryAct[] }) {
	const ref = useRef<HTMLDivElement>(null)
	const [active, setActive] = useState(0)
	const isStill = useReducedMotion()
	const { springs } = useMotionTokens()

	const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
	useMotionValueEvent(scrollYProgress, 'change', (p) => {
		const next = Math.min(acts.length - 1, Math.max(0, Math.floor(p * acts.length)))
		setActive((current) => (current === next ? current : next))
	})

	const camera = useSpring(scrollYProgress, springs.smooth)
	const rotate = useTransform(camera, [0, 1], [-2.5, 1.5])
	const scale = useTransform(camera, [0, 1], [0.95, 1])
	const y = useTransform(camera, [0, 1], [18, -14])

	const current = acts[active] ?? acts[0]
	if (!current) return null

	return (
		<>
			{/* ── lg and up: the phone is pinned and the story plays through it ── */}
			<div
				ref={ref}
				className="relative hidden lg:block"
				style={{ height: `${acts.length * VH_PER_ACT + HEADROOM_VH}vh` }}
			>
				<div className="sticky top-0 flex h-[100svh] items-center overflow-hidden pt-16">
					<span
						aria-hidden="true"
						className="act-light absolute inset-0 -z-10 daylight:hidden"
						style={lightVars(current.light)}
					/>
					<Container className="grid grid-cols-12 items-center gap-8">
						<div className="col-span-6">
							<h2 className="sr-only">{heading}</h2>
							<div className="relative h-[24rem] xl:h-[26rem]">
								{acts.map((act, i) => (
									<div
										key={act.id}
										data-state={stateOf(i, active)}
										aria-hidden={i === active ? undefined : true}
										className="act absolute inset-0 flex flex-col justify-center"
									>
										<h3 className="act-title t-display max-w-[6.8em] text-balance">{act.title}</h3>
										<p className="t-lead mt-7 max-w-[40ch] text-pretty text-ink-secondary">
											{act.body}
										</p>
									</div>
								))}
							</div>

							<div className="mt-6 flex items-center gap-5" aria-hidden="true">
								<span className="flex items-center gap-2">
									{acts.map((act, i) => (
										<span
											key={act.id}
											className={cn(
												'h-1.5 rounded-pill transition-[width,background-color] duration-slow ease-out',
												i === active ? 'w-7 bg-brand-ink' : 'w-1.5 bg-line-active'
											)}
										/>
									))}
								</span>
								{/* Daylight carries this counter on the field instead (below). */}
								<span className="relative h-5 min-w-[12rem] text-sm font-semibold daylight:hidden">
									{acts.map((act, i) => (
										<span
											key={act.id}
											className={cn(
												'absolute inset-0 whitespace-nowrap transition-opacity duration-base',
												i === active ? 'opacity-100' : 'opacity-0'
											)}
										>
											<span className="tabular-nums text-brand-ink">{number(i)}</span>
											<span className="text-ink-tertiary"> · </span>
											<span className="text-ink-secondary">{act.label}</span>
										</span>
									))}
								</span>
							</div>
						</div>

						<div className="relative col-span-6 flex justify-center">
							{/* Daylight: the marigold field, carrying the act's number and name in ink:
							    the story's one counter on this preset. */}
							<span
								aria-hidden="true"
								className="act-field absolute bottom-[6%] left-[24%] top-[10%] -z-10 hidden w-[100vw] rounded-l-4xl daylight:block"
								style={lightVars(current.light)}
							/>
							<span
								aria-hidden="true"
								className="absolute bottom-[8%] right-[-2rem] hidden daylight:block xl:right-[-7rem]"
							>
								{acts.map((act, i) => (
									<span
										key={act.id}
										className={cn(
											'absolute bottom-0 right-0 flex flex-col items-end text-on-brand transition-[opacity,transform] duration-slow ease-out',
											i === active ? 'opacity-100' : 'translate-y-4 opacity-0'
										)}
									>
										<span className="t-hero text-[7rem] leading-none xl:text-[10rem]">
											{number(i)}
										</span>
										<span className="mt-2 whitespace-nowrap text-base font-bold">{act.label}</span>
									</span>
								))}
							</span>
							<motion.div style={isStill ? undefined : { rotate, scale, y }}>
								<DeviceFrame
									label={current.screenLabel}
									className="[--screen:290] xl:[--screen:310]"
								>
									{acts.map((act, i) => (
										<div key={act.id} className="deal" data-state={stateOf(i, active)}>
											{act.screen}
										</div>
									))}
								</DeviceFrame>
							</motion.div>
						</div>
					</Container>
				</div>
			</div>

			{/* ── Below lg: the same acts, stacked ── */}
			<div className="py-24 sm:py-28 lg:hidden">
				<Container>
					<h2 className="t-h1 max-w-[7.3em] text-balance">{heading}</h2>
					<ol className="mt-12 grid gap-5 sm:grid-cols-2">
						{acts.map((act, i) => (
							<Reveal as="li" key={act.id} delay={(i % 2) * 90} className="pane overflow-hidden">
								<div className="relative h-[21rem] overflow-hidden">
									<span
										aria-hidden="true"
										className="act-light absolute inset-0 daylight:hidden"
										style={lightVars({ x: 50, y: 100, strength: act.light.strength })}
									/>
									<span
										aria-hidden="true"
										className="act-field absolute inset-x-6 bottom-0 top-20 hidden rounded-t-4xl daylight:block"
										style={lightVars(act.light)}
									/>
									<p
										aria-hidden="true"
										className="absolute left-5 top-4 text-sm font-semibold tabular-nums"
									>
										<span className="text-brand-ink">{number(i)}</span>
										<span className="text-ink-tertiary"> · {act.label}</span>
									</p>
									{/* The phone fades out before the card's edge, so no line of its
									    screen is cut through. */}
									<div className="absolute inset-0 flex items-start justify-center pt-12 [mask-image:linear-gradient(to_bottom,black_calc(100%_-_4.5rem),transparent_calc(100%_-_0.5rem))]">
										<DeviceFrame label={act.screenLabel} className="[--screen:230]">
											{act.screen}
										</DeviceFrame>
									</div>
								</div>
								<div className="border-t border-line-hairline p-6 sm:p-7">
									<h3 className="t-h2 text-balance">{act.title}</h3>
									<p className="mt-3 text-pretty leading-relaxed text-ink-secondary">{act.body}</p>
								</div>
							</Reveal>
						))}
					</ol>
				</Container>
			</div>
		</>
	)
}
