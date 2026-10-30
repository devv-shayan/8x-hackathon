import { theme } from '@app/brand'
import type { MotionTokens } from '@/components/motion/tokens'

/** The active preset's easing and springs, for <MotionProvider>. Server-only by use. */
export const motionTokens: MotionTokens = {
	ease: theme.motion.easing.out,
	springs: {
		snappy: theme.motion.springs.snappy,
		smooth: theme.motion.springs.smooth,
		gentle: theme.motion.springs.gentle
	}
}
