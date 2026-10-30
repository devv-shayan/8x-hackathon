import type { CssVars } from '@/lib/utils'

/**
 * The page's material under a section: film grain on dusk (paper tooth on
 * daylight) and, on dusk, one low wash of the accent at the section's head.
 * Place it first in a `relative isolate bg-bg` section; it sits behind the
 * content. The section must paint the ground (`bg-bg`): an isolated section
 * with no background blends the grain against transparency, which lifts the
 * ground instead of texturing it.
 */
export function Ground({ washAt }: { washAt?: 'left' | 'right' }) {
	return (
		<>
			<span aria-hidden="true" className="grain -z-10" />
			{washAt && (
				<span
					aria-hidden="true"
					className="section-wash absolute inset-0 -z-20 daylight:hidden"
					style={{ '--wash-x': washAt === 'left' ? '10%' : '88%' } as CssVars}
				/>
			)}
		</>
	)
}
