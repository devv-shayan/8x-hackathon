import type { ReactElement, ReactNode } from 'react'
import {
	ScrollView,
	View,
	type RefreshControlProps,
	type StyleProp,
	type ViewStyle
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTabBarClearance } from '@/components/TabBar'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * A screen's frame: the ground, the gutter, and the right clearance at each
 * end — the status bar (or a PageHeader) at the top, the home indicator or the
 * floating tab bar at the bottom. Content scrolls by default.
 */
export function Screen({
	header,
	children,
	scroll = true,
	tabs = false,
	gap = 16,
	refreshControl,
	contentStyle,
	footer
}: {
	/** A PageHeader; when present the content starts under it. */
	header?: ReactNode
	children: ReactNode
	scroll?: boolean
	/** A tab screen: clear the floating tab bar instead of the home indicator. */
	tabs?: boolean
	gap?: number
	refreshControl?: ReactElement<RefreshControlProps>
	contentStyle?: StyleProp<ViewStyle>
	/** Pinned below the scroll area (a CTA shelf). */
	footer?: ReactNode
}) {
	const insets = useSafeAreaInsets()
	const { colors: c, layout } = useTheme()
	const tabClearance = useTabBarClearance()
	const padding: ViewStyle = {
		paddingHorizontal: layout.gutter,
		paddingTop: header ? 8 : insets.top + 12,
		paddingBottom: tabs ? tabClearance : footer ? 24 : insets.bottom + 28,
		gap
	}

	return (
		<View style={{ flex: 1, backgroundColor: c.bg }}>
			{header}
			{scroll ? (
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={[padding, contentStyle]}
					refreshControl={refreshControl}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					showsVerticalScrollIndicator={false}
				>
					{children}
				</ScrollView>
			) : (
				<View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
			)}
			{footer}
		</View>
	)
}
