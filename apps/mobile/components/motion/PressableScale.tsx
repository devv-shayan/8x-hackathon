import { useCallback } from 'react'
import {
	Pressable,
	type GestureResponderEvent,
	type PressableProps,
	type StyleProp,
	type ViewStyle
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { haptic, type HapticMeaning } from '@/lib/haptics'
import { PRESS, Springs } from '@/lib/motion'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
	style?: StyleProp<ViewStyle>
	/** 'button' springs to .96, 'card' to .98 (the preset's press scales), or a number. */
	scaleTo?: 'button' | 'card' | number
	/** The feeling on press-in, by meaning. false for none. */
	haptic?: HapticMeaning | false
	children?: React.ReactNode
}

/**
 * The one way the app answers a touch: a spring down on press-in (snappy),
 * back on release (settle), with a meaning-named haptic. Every tappable in the
 * app goes through this or a primitive built on it, so the whole product has
 * one physical feel. Springs carry ReduceMotion.System: with Reduce Motion on,
 * the scale is skipped and only the haptic remains.
 */
export function PressableScale({
	style,
	scaleTo = 'button',
	haptic: meaning = 'press',
	onPressIn,
	onPressOut,
	disabled,
	accessibilityRole = 'button',
	accessibilityState,
	children,
	...rest
}: PressableScaleProps) {
	const scale = useSharedValue(1)
	const target = typeof scaleTo === 'number' ? scaleTo : PRESS[scaleTo]
	const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

	const handleIn = useCallback(
		(e: GestureResponderEvent) => {
			scale.value = withSpring(target, Springs.snappy)
			if (meaning) haptic[meaning]()
			onPressIn?.(e)
		},
		[scale, target, meaning, onPressIn]
	)

	const handleOut = useCallback(
		(e: GestureResponderEvent) => {
			scale.value = withSpring(1, Springs.settle)
			onPressOut?.(e)
		},
		[scale, onPressOut]
	)

	return (
		<AnimatedPressable
			style={[style, animated]}
			onPressIn={handleIn}
			onPressOut={handleOut}
			disabled={disabled}
			accessibilityRole={accessibilityRole}
			accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
			{...rest}
		>
			{children}
		</AnimatedPressable>
	)
}
