'use client'

import { createContext, useContext } from 'react'
import { MotionConfig } from 'motion/react'
import type { MotionTokens } from './tokens'

const MotionTokensContext = createContext<MotionTokens | null>(null)

/**
 * The marketing site's motion root. `reducedMotion="user"` makes every motion
 * component honour the visitor's reduced-motion setting (transforms dropped,
 * opacity kept); the CSS block in globals.css does the same for CSS motion.
 *
 * The preset's easing and springs arrive as props from a server component, so
 * the brand builder never ships to the browser.
 */
export function MotionProvider({
	tokens,
	children
}: {
	tokens: MotionTokens
	children: React.ReactNode
}) {
	return (
		<MotionTokensContext value={tokens}>
			<MotionConfig reducedMotion="user" transition={{ ease: tokens.ease }}>
				{children}
			</MotionConfig>
		</MotionTokensContext>
	)
}

/** The active preset's easing and springs. */
export function useMotionTokens(): MotionTokens {
	const tokens = useContext(MotionTokensContext)
	if (!tokens) throw new Error('useMotionTokens must be used inside <MotionProvider>')
	return tokens
}
