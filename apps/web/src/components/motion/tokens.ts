import type { Bezier, SpringSpec } from '@app/brand'

/**
 * The slice of the preset's motion the browser needs: one easing curve and the
 * springs. Built on the server (see `motionTokens` in src/lib/brand-motion.ts)
 * and handed to <MotionProvider>, so client components never import the brand
 * builder itself.
 */
export interface MotionTokens {
	ease: Bezier
	springs: {
		snappy: SpringSpec
		smooth: SpringSpec
		gentle: SpringSpec
	}
}
