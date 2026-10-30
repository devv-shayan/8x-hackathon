import { Children, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { enter } from '@/lib/motion'

/**
 * One block of a staggered entrance: it fades up into place after
 * `index` × the preset's stagger step (capped, so long lists do not crawl).
 *
 *   <FadeSlideIn index={0}>…masthead…</FadeSlideIn>
 *   <FadeSlideIn index={1}>…first card…</FadeSlideIn>
 *
 * Use on tab screens and first-run surfaces. Never on a pushed screen's title:
 * the navigation transition is its entrance, and a nested entering animation
 * flashes on the way back.
 */
export function FadeSlideIn({
	index = 0,
	base,
	style,
	children
}: {
	index?: number
	/** Delay (ms) before the whole group starts, for a group that follows another. */
	base?: number
	style?: StyleProp<ViewStyle>
	children: ReactNode
}) {
	return (
		<Animated.View entering={enter(index, { base })} style={style}>
			{children}
		</Animated.View>
	)
}

/** Staggers each child in turn — FadeSlideIn with the index filled in. */
export function StaggerList({
	base,
	gap,
	children
}: {
	base?: number
	gap?: number
	children: ReactNode
}) {
	const items = Children.toArray(children).filter(Boolean)
	return (
		<>
			{items.map((child, i) => (
				<FadeSlideIn
					key={i}
					index={i}
					base={base}
					style={gap !== undefined && i > 0 ? { marginTop: gap } : undefined}
				>
					{child}
				</FadeSlideIn>
			))}
		</>
	)
}
