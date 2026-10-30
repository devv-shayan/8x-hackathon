import { Children, Fragment, type ComponentType, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { useTheme } from '@/contexts/ThemeContext'
import { Text } from './Text'

/** A lucide icon component (size / color / strokeWidth). */
export type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

export type RowTone = 'brand' | 'neutral' | 'success' | 'warning' | 'error' | 'info'

const CHIP = 36
const ROW_MIN = 60

/**
 * A named group of rows: a small caps label, then the rows. More space above
 * a section than inside it.
 */
export function Section({
	title,
	footnote,
	children
}: {
	title?: string
	footnote?: string
	children: ReactNode
}) {
	return (
		<View style={s.section}>
			{title ? (
				<Text variant="eyebrow" tone="tertiary" style={s.sectionTitle} accessibilityRole="header">
					{title}
				</Text>
			) : null}
			<View style={s.sectionBody}>{children}</View>
			{footnote ? (
				<Text variant="caption" tone="tertiary" style={s.footnote}>
					{footnote}
				</Text>
			) : null}
		</View>
	)
}

/**
 * A content section's heading on a tab screen: the title, and an optional
 * quiet action on the right ("See all").
 */
export function SectionHeader({
	title,
	action
}: {
	title: string
	action?: { label: string; onPress: () => void }
}) {
	const { colors: c } = useTheme()
	return (
		<View style={s.header}>
			<Text variant="h3" accessibilityRole="header">
				{title}
			</Text>
			{action ? (
				<PressableScale
					onPress={action.onPress}
					haptic="select"
					hitSlop={10}
					accessibilityRole="button"
				>
					<Text variant="label" style={{ color: c.brandInk }}>
						{action.label}
					</Text>
				</PressableScale>
			) : null}
		</View>
	)
}

/**
 * Rows sharing one surface, divided by hairlines that start at the text, not
 * the icon. For lists of like things (notifications, tasks).
 */
export function ListGroup({ children, inset = true }: { children: ReactNode; inset?: boolean }) {
	const { colors: c, radii } = useTheme()
	const items = Children.toArray(children).filter(Boolean)
	return (
		<View
			style={[
				s.group,
				{ backgroundColor: c.surface, borderColor: c.borderHairline, borderRadius: radii.card }
			]}
		>
			{items.map((child, i) => (
				<Fragment key={i}>
					{i > 0 ? (
						<View
							style={[
								s.divider,
								{ backgroundColor: c.borderHairline, marginLeft: inset ? 16 + CHIP + 12 : 16 }
							]}
						/>
					) : null}
					{child}
				</Fragment>
			))}
		</View>
	)
}

/**
 * One row. By default it is its own card (row-as-card: surface, rounded,
 * 60pt tall) — the settings pattern. Inside a ListGroup pass card={false}.
 */
export function ListRow({
	icon: Icon,
	tone = 'neutral',
	title,
	subtitle,
	value,
	accessory,
	onPress,
	destructive = false,
	disabled = false,
	card = true,
	accessibilityLabel
}: {
	icon?: IconComponent
	tone?: RowTone
	title: string
	subtitle?: string
	/** A short value shown before the chevron ("Dark", "1.0.0"). */
	value?: string
	/**
	 * Replaces the chevron: a Toggle, a badge; null for nothing. Rows with
	 * onPress get a chevron by default.
	 */
	accessory?: ReactNode
	onPress?: () => void
	destructive?: boolean
	disabled?: boolean
	card?: boolean
	accessibilityLabel?: string
}) {
	const { colors: c, radii } = useTheme()
	const t = destructive ? 'error' : tone
	const chip = {
		brand: { bg: c.brandDim, fg: c.brandInk },
		neutral: { bg: c.surface3, fg: c.textSecondary },
		success: { bg: c.successSoft, fg: c.successText },
		warning: { bg: c.warningSoft, fg: c.warningText },
		error: { bg: c.errorSoft, fg: c.errorText },
		info: { bg: c.infoSoft, fg: c.infoText }
	}[t]

	const body = (
		<>
			{Icon ? (
				<View style={[s.chip, { backgroundColor: chip.bg }]}>
					<Icon size={18} color={chip.fg} strokeWidth={2} />
				</View>
			) : null}
			<View style={s.text}>
				<Text
					variant="label"
					numberOfLines={1}
					style={{ color: destructive ? c.errorText : c.textPrimary }}
				>
					{title}
				</Text>
				{subtitle ? (
					<Text variant="caption" tone="secondary" numberOfLines={2}>
						{subtitle}
					</Text>
				) : null}
			</View>
			{value ? (
				<Text variant="bodySm" tone="tertiary" numberOfLines={1}>
					{value}
				</Text>
			) : null}
			{accessory !== undefined ? (
				accessory
			) : onPress && !destructive ? (
				<ChevronRight size={18} color={c.textTertiary} strokeWidth={2} />
			) : null}
		</>
	)

	const frame = [
		s.row,
		card && {
			backgroundColor: c.surface,
			borderColor: c.borderHairline,
			borderRadius: radii.row,
			borderWidth: StyleSheet.hairlineWidth
		},
		disabled && s.disabled
	]

	if (!onPress) {
		return (
			<View style={frame} accessibilityLabel={accessibilityLabel}>
				{body}
			</View>
		)
	}
	return (
		<PressableScale
			onPress={onPress}
			disabled={disabled}
			scaleTo="card"
			haptic="press"
			accessibilityLabel={accessibilityLabel ?? title}
			style={frame}
		>
			{body}
		</PressableScale>
	)
}

const s = StyleSheet.create({
	header: {
		flexDirection: 'row',
		alignItems: 'baseline',
		justifyContent: 'space-between',
		marginTop: 12
	},
	section: { gap: 10 },
	sectionTitle: { paddingHorizontal: 4 },
	sectionBody: { gap: 8 },
	footnote: { paddingHorizontal: 4 },
	group: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
	divider: { height: StyleSheet.hairlineWidth },
	row: {
		minHeight: ROW_MIN,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	chip: {
		width: CHIP,
		height: CHIP,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center'
	},
	text: { flex: 1, gap: 2 },
	disabled: { opacity: 0.55 }
})
