'use client'

import { useRef, type PointerEvent } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMotionTokens } from './MotionProvider'

/** How far, in px, the child leans toward the pointer at the element's edge. */
const PULL_PX = 7

/**
 * The primary action leans toward the cursor while it is over it, on the
 * preset's snappy spring, and springs home on leave. Mouse only: a tap on a
 * touch screen never nudges the button out from under the finger.
 */
export function Magnetic({
	children,
	className
}: {
	children: React.ReactNode
	className?: string
}) {
	const ref = useRef<HTMLSpanElement>(null)
	const isStill = useReducedMotion()
	const { springs } = useMotionTokens()
	const x = useMotionValue(0)
	const y = useMotionValue(0)
	const springX = useSpring(x, springs.snappy)
	const springY = useSpring(y, springs.snappy)

	function onPointerMove(e: PointerEvent<HTMLSpanElement>) {
		const rect = ref.current?.getBoundingClientRect()
		if (isStill || e.pointerType !== 'mouse' || rect == null) return
		x.set(((e.clientX - rect.left) / rect.width - 0.5) * 2 * PULL_PX)
		y.set(((e.clientY - rect.top) / rect.height - 0.5) * 2 * PULL_PX)
	}

	function onPointerLeave() {
		x.set(0)
		y.set(0)
	}

	return (
		<motion.span
			ref={ref}
			onPointerMove={onPointerMove}
			onPointerLeave={onPointerLeave}
			style={isStill ? undefined : { x: springX, y: springY }}
			className={cn('inline-flex', className)}
		>
			{children}
		</motion.span>
	)
}
