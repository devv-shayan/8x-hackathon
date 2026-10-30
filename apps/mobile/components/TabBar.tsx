import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Springs } from '@/lib/motion'

/** Height of the floating bar itself. */
export const TAB_BAR_HEIGHT = 64
const ICON_SIZE = 22
const LENS_INSET = 6

function barBottom(insetBottom: number) {
	return insetBottom > 0 ? insetBottom + 4 : 14
}

/** How far the top of the floating bar sits above the bottom of the screen. */
export function useTabBarTop(): number {
	const insets = useSafeAreaInsets()
	return barBottom(insets.bottom) + TAB_BAR_HEIGHT
}

/**
 * How far a tab screen's content must scroll clear of the floating bar: the
 * bar, the gap under it, the home indicator, and breathing room above.
 */
export function useTabBarClearance(): number {
	return useTabBarTop() + 20
}

/**
 * A floating glass pill above the home indicator. The active tab sits in a
 * lens that slides between tabs on the smooth spring; a tab change ticks the
 * selection haptic. Glass is a real blur on iOS and the web; Android gets the
 * solid fallback surface (blur there is costly and uneven across devices).
 */
export default function TabBar({ state, navigation, descriptors }: BottomTabBarProps) {
	const insets = useSafeAreaInsets()
	const { colors: c, elevation, layout, isDark } = useTheme()
	const [width, setWidth] = useState(0)
	const count = state.routes.length
	const slot = count > 0 ? width / count : 0

	const lensX = useSharedValue(0)
	useEffect(() => {
		if (slot > 0) lensX.value = withSpring(state.index * slot + LENS_INSET, Springs.smooth)
	}, [state.index, slot, lensX])
	const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lensX.value }] }))

	function onLayout(e: LayoutChangeEvent) {
		const w = e.nativeEvent.layout.width
		setWidth(w)
		// Place the lens without animating on first layout.
		lensX.value = state.index * (w / Math.max(count, 1)) + LENS_INSET
	}

	function handlePress(routeName: string, key: string, focused: boolean) {
		const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true })
		if (focused || event.defaultPrevented) return
		haptic.select()
		navigation.navigate(routeName as never)
	}

	const glass = Platform.OS !== 'android'

	return (
		<View
			pointerEvents="box-none"
			style={[s.wrap, { bottom: barBottom(insets.bottom), paddingHorizontal: layout.gutter }]}
		>
			<View
				style={[
					s.bar,
					{
						borderColor: isDark ? c.borderGlass : c.borderSoft,
						backgroundColor: glass ? 'transparent' : c.glassFallback
					},
					elevation.raised
				]}
				onLayout={onLayout}
			>
				{glass ? (
					<>
						<BlurView intensity={60} tint={c.blurTint} style={[StyleSheet.absoluteFill, s.round]} />
						<View style={[StyleSheet.absoluteFill, s.round, { backgroundColor: c.glassTint }]} />
					</>
				) : null}

				{slot > 0 ? (
					<Animated.View
						pointerEvents="none"
						style={[
							s.lens,
							{ width: slot - LENS_INSET * 2, backgroundColor: c.brandDim },
							lensStyle
						]}
					/>
				) : null}

				{state.routes.map((route, i) => {
					const { options } = descriptors[route.key]
					const focused = state.index === i
					const label =
						typeof options.tabBarLabel === 'string'
							? options.tabBarLabel
							: (options.title ?? route.name)
					const color = focused ? c.brandInk : c.textTertiary
					return (
						<PressableScale
							key={route.key}
							haptic={false}
							scaleTo={0.9}
							onPress={() => handlePress(route.name, route.key, focused)}
							accessibilityRole="tab"
							accessibilityLabel={label}
							accessibilityState={{ selected: focused }}
							style={s.item}
						>
							{options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
							<Text
								variant="caption"
								numberOfLines={1}
								maxFontSizeMultiplier={1.2}
								style={[s.label, { color }, focused && s.labelActive]}
							>
								{label}
							</Text>
						</PressableScale>
					)
				})}
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { position: 'absolute', left: 0, right: 0 },
	bar: {
		height: TAB_BAR_HEIGHT,
		borderRadius: TAB_BAR_HEIGHT / 2,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		alignItems: 'center'
	},
	round: { borderRadius: TAB_BAR_HEIGHT / 2, overflow: 'hidden' },
	lens: {
		position: 'absolute',
		left: 0,
		top: LENS_INSET,
		bottom: LENS_INSET,
		borderRadius: (TAB_BAR_HEIGHT - LENS_INSET * 2) / 2
	},
	item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3 },
	label: { fontSize: 11, lineHeight: 14 },
	labelActive: { fontWeight: '600' }
})
