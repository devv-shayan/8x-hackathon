import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Marks'
import StatusBadge from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Text'
import type { ItemSummary } from '@/lib/types'

/**
 * One item in a list (home, explore): its name and state, who owns it, a
 * line of summary, and how far along it is. Tapping opens the detail screen.
 */
export function ItemCard({ item }: { item: ItemSummary }) {
	return (
		<Card
			onPress={() => router.push(`/detail/${item.id}`)}
			accessibilityLabel={`${item.name}, ${item.completion}% complete`}
		>
			<View style={s.top}>
				<View style={s.title}>
					<Text variant="label" numberOfLines={1}>
						{item.name}
					</Text>
					<Text variant="caption" tone="tertiary" numberOfLines={1}>
						{[item.owner, item.updatedAt && `Updated ${item.updatedAt}`]
							.filter(Boolean)
							.join(' · ')}
					</Text>
				</View>
				<StatusBadge status={item.status} />
			</View>
			{item.summary ? (
				<Text variant="bodySm" tone="secondary" numberOfLines={2} style={s.summary}>
					{item.summary}
				</Text>
			) : null}
			<View style={s.progress}>
				<ProgressBar value={item.completion / 100} accessibilityLabel="Completion" />
				<Text variant="caption" tone="secondary" tabular>
					{item.completion}% complete · {item.activeUsers} active
				</Text>
			</View>
		</Card>
	)
}

const s = StyleSheet.create({
	top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
	title: { flex: 1, gap: 3 },
	summary: { marginTop: 10 },
	progress: { marginTop: 14, gap: 8 }
})
