import { useEffect, useState, type ReactNode } from 'react'
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	View,
	useWindowDimensions,
	type LayoutChangeEvent
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Springs, Timings } from '@/lib/motion'
import { Text } from './Text'

/** Dismiss when dragged past this share of the sheet's height… */
const THROW_DISTANCE = 0.25
/** …or flung down faster than this (pt/s). */
const THROW_VELOCITY = 800

/**
 * A bottom sheet on React Native's own Modal, not @gorhom/bottom-sheet: under
 * the New Architecture on Android gorhom's sheets can mount invisibly or fail
 * to present (gorhom/react-native-bottom-sheet #2046, #2167), and a shipped
 * app moved to this pattern after hitting exactly that. The Modal is
 * Fabric-native and brings the portal and the hardware back button for free.
 *
 * - Throwable: drag the handle area down past a quarter of the sheet, or fling
 *   it, to dismiss; otherwise it settles back.
 * - Keyboard-aware: content rides above the keyboard.
 * - Controlled: the parent owns `open`; `onClose` fires on every close path.
 * - Fade-rise in on modalIn, out on modalOut; with Reduce Motion both are
 *   instant (the timings carry ReduceMotion.System).
 */
export function Sheet({
	open,
	onClose,
	title,
	children,
	dismissible = true
}: {
	open: boolean
	onClose: () => void
	title?: string
	children: ReactNode
	/** False for a sheet that must be answered (no backdrop tap, no throw). */
	dismissible?: boolean
}) {
	const insets = useSafeAreaInsets()
	const { height: screenH } = useWindowDimensions()
	const { colors: c, radii, isDark } = useTheme()
	const [mounted, setMounted] = useState(open)
	const [sheetH, setSheetH] = useState(screenH)

	const y = useSharedValue(screenH)
	const backdrop = useSharedValue(0)

	useEffect(() => {
		if (open) {
			setMounted(true)
			backdrop.value = withTiming(1, Timings.modalIn)
			y.value = withTiming(0, Timings.modalIn)
		} else if (mounted) {
			backdrop.value = withTiming(0, Timings.modalOut)
			y.value = withTiming(sheetH, Timings.modalOut, (done) => {
				if (done) runOnJS(setMounted)(false)
			})
		}
		// mounted and sheetH are read as they are when `open` flips; re-running on
		// their changes would replay the animation.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	const pan = Gesture.Pan()
		.enabled(dismissible)
		.onChange((e) => {
			y.value = Math.max(0, y.value + e.changeY)
		})
		.onEnd((e) => {
			if (y.value > sheetH * THROW_DISTANCE || e.velocityY > THROW_VELOCITY) {
				runOnJS(haptic.select)()
				runOnJS(onClose)()
			} else {
				y.value = withSpring(0, Springs.settle)
			}
		})

	const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
	const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

	function onLayout(e: LayoutChangeEvent) {
		setSheetH(e.nativeEvent.layout.height)
	}

	if (!mounted) return null

	return (
		<Modal
			visible
			transparent
			animationType="none"
			statusBarTranslucent
			onRequestClose={dismissible ? onClose : () => {}}
		>
			<GestureHandlerRootView style={s.fill}>
				<Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
					{Platform.OS === 'ios' ? (
						<BlurView
							intensity={18}
							tint={isDark ? 'dark' : 'light'}
							style={StyleSheet.absoluteFill}
						/>
					) : null}
					<View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
				</Animated.View>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={dismissible ? onClose : undefined}
					accessibilityRole="button"
					accessibilityLabel="Close"
				/>

				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					style={s.bottom}
					pointerEvents="box-none"
				>
					<Animated.View
						onLayout={onLayout}
						style={[
							s.sheet,
							{
								backgroundColor: c.surface,
								borderColor: c.borderHairline,
								borderTopLeftRadius: radii.sheet,
								borderTopRightRadius: radii.sheet,
								paddingBottom: insets.bottom + 16,
								maxHeight: screenH - insets.top - 24
							},
							sheetStyle
						]}
						accessibilityViewIsModal
					>
						<GestureDetector gesture={pan}>
							<View style={s.grab}>
								<View style={[s.handle, { backgroundColor: c.borderActive }]} />
								{title ? (
									<Text variant="h3" style={s.title} accessibilityRole="header">
										{title}
									</Text>
								) : null}
							</View>
						</GestureDetector>
						{children}
					</Animated.View>
				</KeyboardAvoidingView>
			</GestureHandlerRootView>
		</Modal>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	bottom: { flex: 1, justifyContent: 'flex-end' },
	sheet: {
		borderWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: 0,
		paddingHorizontal: 20
	},
	grab: { paddingTop: 10, paddingBottom: 12, alignItems: 'center', gap: 14 },
	handle: { width: 44, height: 5, borderRadius: 3 },
	title: { alignSelf: 'stretch' }
})
