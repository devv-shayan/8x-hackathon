'use client'

import { useEffect } from 'react'
import {
	motion,
	useMotionValue,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform
} from 'motion/react'
import { useMotionTokens } from '../motion/MotionProvider'

/** Largest lean toward the cursor on top of the rest pose, degrees. */
const MAX_TILT_DEG = 6
/** How far the phone drifts down as the hero scrolls away, px. */
const DRIFT_PX = 90
/** How far it turns while drifting, degrees. */
const DRIFT_TURN_DEG = 3
/** The page scroll, px, over which the drift plays out (about one viewport). */
const DRIFT_OVER_PX = 900

/**
 * The hero phone rests in a slight three-quarter turn, and moves twice: it
 * leans toward the cursor anywhere over the page (mouse only, on the preset's
 * gentle spring), and as the hero scrolls away it drifts down and turns a
 * little, so the page reads as a camera passing the product rather than a
 * picture being scrolled off. Under reduced motion it keeps the rest pose and
 * does not move. The rest pose applies from lg up.
 */
export function HeroDevice({ children }: { children: React.ReactNode }) {
	const isStill = useReducedMotion()
	const { springs } = useMotionTokens()

	const px = useMotionValue(0)
	const py = useMotionValue(0)
	const sx = useSpring(px, springs.gentle)
	const sy = useSpring(py, springs.gentle)
	const rotateY = useTransform(sx, [-1, 1], [-MAX_TILT_DEG, MAX_TILT_DEG])
	const rotateX = useTransform(sy, [-1, 1], [MAX_TILT_DEG, -MAX_TILT_DEG])

	const { scrollY } = useScroll()
	const drift = useSpring(scrollY, springs.smooth)
	const y = useTransform(drift, [0, DRIFT_OVER_PX], [0, DRIFT_PX])
	const rotate = useTransform(drift, [0, DRIFT_OVER_PX], [0, DRIFT_TURN_DEG])

	useEffect(() => {
		if (isStill || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
		const onMove = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return
			px.set((e.clientX / window.innerWidth) * 2 - 1)
			py.set((e.clientY / window.innerHeight) * 2 - 1)
		}
		const onLeave = () => {
			px.set(0)
			py.set(0)
		}
		window.addEventListener('pointermove', onMove, { passive: true })
		document.documentElement.addEventListener('pointerleave', onLeave)
		return () => {
			window.removeEventListener('pointermove', onMove)
			document.documentElement.removeEventListener('pointerleave', onLeave)
		}
	}, [isStill, px, py])

	return (
		<div className="[perspective:1600px]">
			{/* The rest pose is CSS and large screens only: a 3D turn makes Chrome
			    rasterise the scaled screen below device resolution, which a phone
			    shows as soft text. Small screens keep the phone flat and sharp. */}
			<div className="lg:[transform:rotateY(-9deg)_rotateX(3deg)]">
				<motion.div style={isStill ? undefined : { rotateX, rotateY, y, rotate }}>
					{children}
				</motion.div>
			</div>
		</div>
	)
}
