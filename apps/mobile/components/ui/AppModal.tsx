import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TriangleAlert } from 'lucide-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Timings } from '@/lib/motion'
import { Button } from './Button'
import { ListRow, type IconComponent } from './List'
import { Sheet } from './Sheet'
import { Text } from './Text'

export type AlertButton = {
	text: string
	onPress?: () => void
	style?: 'default' | 'cancel' | 'destructive'
}

export type SheetOption = {
	text: string
	icon?: IconComponent
	onPress?: () => void
	style?: 'default' | 'destructive'
}

/** How far the alert card rises as it fades in. */
const RISE = 32

/**
 * A decision the person has to make: a floating card near the bottom (thumb
 * reach), not draggable, fading up on modalIn. Destructive decisions carry a
 * warning chip and a warning haptic. Every button closes it (onDismiss first,
 * then the button's own onPress).
 */
export function AlertModal({
	visible,
	title,
	message,
	buttons = [{ text: 'OK' }],
	onDismiss
}: {
	visible: boolean
	title: string
	message?: string
	buttons?: AlertButton[]
	onDismiss?: () => void
}) {
	const insets = useSafeAreaInsets()
	const { colors: c, radii, elevation, layout } = useTheme()
	const [mounted, setMounted] = useState(visible)
	const shown = useSharedValue(0)
	const destructive = buttons.some((b) => b.style === 'destructive')

	useEffect(() => {
		if (visible) {
			setMounted(true)
			shown.value = withTiming(1, Timings.modalIn)
			if (destructive) haptic.warning()
		} else {
			shown.value = withTiming(0, Timings.modalOut, (done) => {
				if (done) runOnJS(setMounted)(false)
			})
		}
		// shown is a stable shared value; destructive is read as it is when the
		// alert opens.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible])

	const backdrop = useAnimatedStyle(() => ({ opacity: shown.value }))
	const card = useAnimatedStyle(() => ({
		opacity: shown.value,
		transform: [{ translateY: (1 - shown.value) * RISE }]
	}))

	if (!mounted) return null

	const cancel = buttons.find((b) => b.style === 'cancel')
	const actions = buttons.filter((b) => b.style !== 'cancel')
	const single = actions.length === 1 && actions[0]?.style !== 'destructive'

	function press(b: AlertButton) {
		onDismiss?.()
		b.onPress?.()
	}

	return (
		<Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
			<Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }, backdrop]} />
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onDismiss}
				accessibilityRole="button"
				accessibilityLabel="Close"
			/>
			<View style={[s.bottom, { paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }]}>
				<Animated.View
					accessibilityViewIsModal
					style={[
						s.card,
						{
							backgroundColor: c.surface,
							borderColor: c.borderHairline,
							borderRadius: radii['3xl'],
							padding: layout.gutterWide
						},
						elevation.overlay,
						card
					]}
				>
					{destructive ? (
						<View style={[s.chip, { backgroundColor: c.errorSoft }]}>
							<TriangleAlert size={20} color={c.errorText} strokeWidth={2} />
						</View>
					) : null}
					<Text variant="h3" accessibilityRole="header">
						{title}
					</Text>
					{message ? (
						<Text variant="bodySm" tone="secondary" style={s.message}>
							{message}
						</Text>
					) : null}
					<View style={s.buttons}>
						{actions.map((b) => (
							<Button
								key={b.text}
								label={b.text}
								fullWidth
								variant={b.style === 'destructive' ? 'destructive' : single ? 'primary' : 'outline'}
								onPress={() => press(b)}
							/>
						))}
						{cancel ? (
							<Button label={cancel.text} variant="ghost" fullWidth onPress={() => press(cancel)} />
						) : null}
					</View>
				</Animated.View>
			</View>
		</Modal>
	)
}

/**
 * A short list of actions on a Sheet: each a row with an optional icon chip,
 * then Cancel.
 */
export function ActionSheet({
	visible,
	title,
	options,
	onDismiss
}: {
	visible: boolean
	title?: string
	options: SheetOption[]
	onDismiss: () => void
}) {
	return (
		<Sheet open={visible} onClose={onDismiss} title={title}>
			<View style={s.options}>
				{options.map((o) => (
					<ListRow
						key={o.text}
						icon={o.icon}
						title={o.text}
						destructive={o.style === 'destructive'}
						accessory={null}
						onPress={() => {
							onDismiss()
							o.onPress?.()
						}}
					/>
				))}
				<Button label="Cancel" variant="ghost" fullWidth onPress={onDismiss} />
			</View>
		</Sheet>
	)
}

const s = StyleSheet.create({
	bottom: { flex: 1, justifyContent: 'flex-end' },
	card: { borderWidth: StyleSheet.hairlineWidth, gap: 8 },
	chip: {
		width: 44,
		height: 44,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 6
	},
	message: { marginTop: 2 },
	buttons: { marginTop: 16, gap: 10 },
	options: { gap: 8 }
})
