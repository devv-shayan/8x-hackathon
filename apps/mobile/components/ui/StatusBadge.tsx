import { StyleSheet, View } from 'react-native'
import { useColors } from '@/contexts/ThemeContext'
import type { ItemStatus } from '@/lib/types'
import { Text } from './Text'

export function statusLabel(status: ItemStatus) {
	return { active: 'Active', pending: 'Pending', archived: 'Archived' }[status]
}

/**
 * A status as a small tinted chip: the semantic soft fill with its AA text
 * colour, and a dot so the state is not carried by colour alone.
 */
export default function StatusBadge({ status, label }: { status: ItemStatus; label?: string }) {
	const c = useColors()
	const look = {
		active: { bg: c.successSoft, fg: c.successText },
		pending: { bg: c.warningSoft, fg: c.warningText },
		archived: { bg: c.surface3, fg: c.textSecondary }
	}[status]
	return (
		<View style={[s.badge, { backgroundColor: look.bg }]}>
			<View style={[s.dot, { backgroundColor: look.fg }]} />
			<Text variant="caption" style={[s.text, { color: look.fg }]}>
				{label ?? statusLabel(status)}
			</Text>
		</View>
	)
}

const s = StyleSheet.create({
	badge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
		alignSelf: 'flex-start'
	},
	dot: { width: 6, height: 6, borderRadius: 3 },
	text: { fontWeight: '600' }
})
