'use client'

import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { renderStudents, SEATS } from './students'
import { useAnimationFrame } from './useAnimationFrame'

const CELL = 3
const FPS = 25
/** Seconds each student keeps a hand up before the other takes a turn. */
const TURN = 3.2
/** How quickly an arm moves towards up or down, per frame. */
const ARM_EASE = 0.12
/** Above this an arm counts as up, and its question shows. */
const SHOWS_QUESTION = 0.7

/** What Maya and Omar ask on the landing page. */
const LESSON_QUESTIONS: readonly [string, string] = [
	'How do small habits stick better than big ones?',
	'The video also covers confidence. You skipped it.'
]

/**
 * The hero: Maya and Omar in pixels, taking turns to raise a lime hand with a question.
 * Pointing at one calls on them. Reduced motion shows Maya with her hand up.
 */
export function PixelStudents({
	className,
	questions = LESSON_QUESTIONS
}: {
	className?: string
	/** Maya's question, then Omar's. */
	questions?: readonly [string, string]
}) {
	const canvas = useRef<HTMLCanvasElement>(null)
	const buffer = useRef<ImageData | null>(null)
	const raised = useRef([0, 0])
	const pointedAt = useRef<number | null>(null)
	const reducedMotion = useRef<boolean | null>(null)
	const [asking, setAsking] = useState<number | null>(0)

	const draw = useCallback((t: number) => {
		const el = canvas.current
		const ctx = el?.getContext('2d')
		if (!el || !ctx) return
		const width = Math.max(8, Math.ceil(el.clientWidth / CELL))
		const height = Math.max(8, Math.ceil(el.clientHeight / CELL))
		if (el.width !== width || el.height !== height || !buffer.current) {
			el.width = width
			el.height = height
			buffer.current = ctx.createImageData(width, height)
		}
		reducedMotion.current ??= window.matchMedia('(prefers-reduced-motion: reduce)').matches
		// The still frame for reduced motion has the arm fully up, not one step of the way.
		const ease = reducedMotion.current ? 1 : ARM_EASE
		const turn = pointedAt.current ?? Math.floor(t / TURN) % SEATS.length
		raised.current = raised.current.map((r, i) => r + ((i === turn ? 1 : 0) - r) * ease)
		const up = raised.current.findIndex((r) => r > SHOWS_QUESTION)
		setAsking(up < 0 ? null : up)
		renderStudents(buffer.current.data, width, height, t, raised.current)
		ctx.putImageData(buffer.current, 0, 0)
	}, [])

	useAnimationFrame(canvas, draw, FPS, 0)

	const callOn = (e: PointerEvent<HTMLDivElement>) => {
		const box = e.currentTarget.getBoundingClientRect()
		pointedAt.current = (e.clientX - box.left) / box.width < 0.5 ? 0 : 1
	}

	return (
		<div
			className={cn('relative cursor-pointer select-none', className)}
			onPointerMove={callOn}
			onPointerDown={callOn}
			onPointerLeave={(e) => {
				// A tap keeps its student called on; only a mouse leaving hands back to turns.
				if (e.pointerType === 'mouse') pointedAt.current = null
			}}
		>
			<canvas
				ref={canvas}
				aria-hidden="true"
				className="pixelated absolute inset-0 h-full w-full"
			/>
			{SEATS.map((seat, i) => (
				<p
					key={seat.name}
					aria-hidden={asking !== i}
					className={cn(
						'absolute top-3 max-w-[40%] border border-[rgb(var(--l-ink))] bg-[rgb(var(--l-paper))] px-2.5 py-1.5 text-[13px] leading-snug transition-[opacity,transform] duration-300',
						i === 0 ? 'left-3' : 'right-3',
						asking === i ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
					)}
				>
					<span className="l-mono mb-0.5 block">{seat.name} ✋</span>
					{questions[i]}
				</p>
			))}
		</div>
	)
}
