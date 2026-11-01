'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Calls `draw(seconds)` about `fps` times a second while `target` is on screen. Visitors who
 * prefer reduced motion get one still frame, and nothing runs off screen.
 */
export function useAnimationFrame(
	target: RefObject<Element | null>,
	draw: (seconds: number) => void,
	fps: number,
	stillAt: number
) {
	useEffect(() => {
		const el = target.current
		if (!el) return
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		draw(stillAt)
		if (reduced) return

		let frame = 0
		let last = 0
		let visible = false
		const tick = (now: number) => {
			frame = 0
			if (!visible) return
			if (now - last >= 1000 / fps) {
				last = now
				draw(now / 1000)
			}
			frame = requestAnimationFrame(tick)
		}
		const observer = new IntersectionObserver(([entry]) => {
			visible = Boolean(entry?.isIntersecting)
			if (visible && !frame) frame = requestAnimationFrame(tick)
		})
		observer.observe(el)
		return () => {
			observer.disconnect()
			if (frame) cancelAnimationFrame(frame)
		}
	}, [target, draw, fps, stillAt])
}
