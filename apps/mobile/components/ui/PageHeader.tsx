import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, X } from 'lucide-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { Eyebrow } from './Eyebrow'
import { IconButton } from './IconButton'
import { Text } from './Text'

/**
 * The bar at the top of a pushed screen: a round back (or close) button, an
 * optional compact title, and a slot on the right. No entering animation —
 * the navigation transition is the entrance.
 */
export function PageHeader({
	title,
	onBack = () => router.back(),
	backIcon = 'back',
	right,
	inset = true
}: {
	title?: string
	onBack?: () => void
	backIcon?: 'back' | 'close'
	right?: ReactNode
	/** Pad for the status bar. Off when the header sits inside a sheet. */
	inset?: boolean
}) {
	const insets = useSafeAreaInsets()
	const { layout } = useTheme()
	return (
		<View
			style={[
				s.bar,
				{ paddingTop: inset ? insets.top + 6 : 6, paddingHorizontal: layout.gutter - 4 }
			]}
		>
			<IconButton
				onPress={onBack}
				accessibilityLabel={backIcon === 'close' ? 'Close' : 'Back'}
				icon={(color) =>
					backIcon === 'close' ? (
						<X size={20} color={color} strokeWidth={2} />
					) : (
						<ChevronLeft size={22} color={color} strokeWidth={2} />
					)
				}
			/>
			<View style={s.title}>
				{title ? (
					<Text variant="label" numberOfLines={1} accessibilityRole="header">
						{title}
					</Text>
				) : null}
			</View>
			<View style={s.side}>{right}</View>
		</View>
	)
}

/**
 * The large title that opens a screen's content: an optional eyebrow, the
 * title in the preset's display face, and a line of context.
 */
export function ScreenTitle({
	eyebrow,
	title,
	subtitle,
	variant = 'title'
}: {
	eyebrow?: string
	title: string
	subtitle?: string
	variant?: 'title' | 'h1' | 'display'
}) {
	return (
		<View style={s.titleBlock}>
			{eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
			<Text variant={variant} accessibilityRole="header">
				{title}
			</Text>
			{subtitle ? (
				<Text variant="bodySm" tone="secondary">
					{subtitle}
				</Text>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	bar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, gap: 12 },
	title: { flex: 1, alignItems: 'center' },
	side: { minWidth: 40, alignItems: 'flex-end' },
	titleBlock: { gap: 8 }
})
