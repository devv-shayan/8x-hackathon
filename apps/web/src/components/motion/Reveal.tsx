'use client'

import { useEffect, useRef, useState, type ElementType } from 'react'
import { cn, type CssVars } from '@/lib/utils'

type Tag = 'div' | 'section' | 'li' | 'article' | 'figure' | 'p' | 'span' | 'header'

/**
 * Reveal as the top edge crosses a line just above the bottom of the screen.
 * A share-of-element threshold never fires for a pane taller than the phone
 * it is on, and leaves a blank band under the last one that did.
 */
const ROOT_MARGIN = '0px 0px -8% 0px'

/**
 * Reveals its children with the preset's rise (and, on dusk, a blur dissolve)
 * the first time they scroll into view. IntersectionObserver, so there is no
 * scroll listener; the motion itself is CSS (`.reveal` in globals.css), which
 * only hides the element while a script is running to reveal it, and not at
 * all under reduced motion.
 */
export function Reveal({
	as = 'div',
	className,
	delay = 0,
	children
}: {
	as?: Tag
	className?: string
	/** Stagger, in milliseconds. */
	delay?: number
	children: React.ReactNode
}) {
	const ref = useRef<HTMLElement | null>(null)
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					setIsVisible(true)
					io.disconnect()
				}
			},
			{ threshold: 0, rootMargin: ROOT_MARGIN }
		)
		io.observe(el)
		return () => io.disconnect()
	}, [])

	const Component = as as ElementType
	return (
		<Component
			ref={ref}
			className={cn('reveal', isVisible && 'is-visible', className)}
			style={delay ? ({ '--reveal-delay': `${delay}ms` } as CssVars) : undefined}
		>
			{children}
		</Component>
	)
}
