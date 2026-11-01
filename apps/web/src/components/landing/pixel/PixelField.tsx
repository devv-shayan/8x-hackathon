'use client'

import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { hexToRgb, renderField } from './dither'
import { PIXEL_FIELDS, type PixelFieldName } from './fields'
import { useAnimationFrame } from './useAnimationFrame'

const FPS = 24
/** The moment drawn for visitors who prefer reduced motion. */
const STILL_AT = 4

/**
 * One of the landing page's generative backgrounds, drawn at a few device pixels per cell
 * and scaled up with crisp edges. Decorative: hidden from assistive technology, and it
 * fills its positioned parent.
 */
export function PixelField({ name, className }: { name: PixelFieldName; className?: string }) {
	const canvas = useRef<HTMLCanvasElement>(null)
	const buffer = useRef<ImageData | null>(null)
	const { palette, cell, field } = PIXEL_FIELDS[name]
	const colours = useRef(palette.map(hexToRgb))

	const fit = useCallback(() => {
		const el = canvas.current
		const ctx = el?.getContext('2d')
		if (!el || !ctx) return
		const width = Math.max(8, Math.ceil(el.clientWidth / cell))
		const height = Math.max(8, Math.ceil(el.clientHeight / cell))
		if (el.width === width && el.height === height && buffer.current) return
		el.width = width
		el.height = height
		buffer.current = ctx.createImageData(width, height)
	}, [cell])

	useEffect(() => {
		const el = canvas.current
		if (!el) return
		const observer = new ResizeObserver(fit)
		observer.observe(el)
		return () => observer.disconnect()
	}, [fit])

	const draw = useCallback(
		(t: number) => {
			fit()
			const el = canvas.current
			const image = buffer.current
			const ctx = el?.getContext('2d')
			if (!el || !image || !ctx) return
			renderField(image.data, el.width, el.height, field, colours.current, t)
			ctx.putImageData(image, 0, 0)
		},
		[field, fit]
	)

	useAnimationFrame(canvas, draw, FPS, STILL_AT)

	return (
		<canvas
			ref={canvas}
			aria-hidden="true"
			className={cn('pixelated absolute inset-0 h-full w-full', className)}
		/>
	)
}
