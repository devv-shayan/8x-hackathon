import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SearchX } from 'lucide-react-native'
import { NumberTicker } from '@/components/motion/NumberTicker'
import { LoadMore, QueryErrorState } from '@/components/QueryError'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListGroup, ListRow, SectionHeader } from '@/components/ui/List'
import { ProgressBar } from '@/components/ui/Marks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton'
import StatusBadge from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { useItem, useItemTasks } from '@/hooks/useItems'
import type { TaskItem } from '@/lib/types'

const STATE_LABEL: Record<TaskItem['state'], string> = {
	todo: 'To do',
	'in-progress': 'In progress',
	review: 'In review',
	done: 'Done'
}

export default function DetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const item = useItem(id)
	const tasks = useItemTasks(id)

	if (item.data === undefined && !item.isError) {
		return (
			<Screen header={<PageHeader />}>
				<Skeleton width="30%" height={22} radius={11} />
				<Skeleton width="70%" height={34} />
				<CardSkeleton height={180} />
				<CardSkeleton />
			</Screen>
		)
	}

	if (!item.data) {
		return (
			<Screen header={<PageHeader />}>
				{item.isError ? (
					<QueryErrorState
						error={item.error}
						title="Couldn't load this item"
						onRetry={() => item.refetch()}
					/>
				) : (
					<EmptyState
						icon={SearchX}
						title="This item is gone"
						body="It may have been deleted, or the link is out of date."
						action={{ label: 'Go back', onPress: () => router.back() }}
					/>
				)}
			</Screen>
		)
	}

	const it = item.data
	return (
		<Screen header={<PageHeader />} gap={18}>
			<View style={s.titleBlock}>
				<StatusBadge status={it.status} />
				<Text variant="h1" accessibilityRole="header">
					{it.name}
				</Text>
				<Text variant="bodySm" tone="tertiary">
					{[it.owner, it.updatedAt && `Updated ${it.updatedAt}`].filter(Boolean).join(' · ')}
				</Text>
			</View>

			{it.summary ? (
				<Text variant="lead" tone="body">
					{it.summary}
				</Text>
			) : null}

			<Card tier="raised" padding="spacious">
				<View style={s.metrics}>
					<Metric label="Complete" value={it.completion} unit="%" />
					<Metric label="Health" value={it.health} />
					<Metric label="Active" value={it.activeUsers} />
				</View>
				<View style={s.bar}>
					<ProgressBar value={it.completion / 100} height={8} accessibilityLabel="Completion" />
				</View>
			</Card>

			<SectionHeader title="Tasks" />
			{tasks.data === undefined && tasks.isError ? (
				<QueryErrorState
					error={tasks.error}
					title="Couldn't load tasks"
					onRetry={() => tasks.refetch()}
				/>
			) : (
				<TaskList tasks={tasks.data} />
			)}
			<LoadMore
				hasMore={tasks.hasNextPage}
				loading={tasks.isFetchingNextPage}
				error={tasks.isFetchNextPageError ? tasks.error : undefined}
				onPress={() => tasks.fetchNextPage()}
				label="Show more tasks"
			/>
		</Screen>
	)
}

function Metric({ label, value, unit = '' }: { label: string; value: number; unit?: string }) {
	return (
		<View style={s.metric}>
			<NumberTicker value={value} format={(n) => `${Math.round(n)}${unit}`} />
			<Text variant="caption" tone="secondary">
				{label}
			</Text>
		</View>
	)
}

function TaskList({ tasks }: { tasks: TaskItem[] | undefined }) {
	const c = useColors()
	if (tasks === undefined) return <CardSkeleton />
	if (tasks.length === 0) {
		return (
			<Text variant="bodySm" tone="secondary">
				No tasks on this item yet.
			</Text>
		)
	}
	const priority = {
		high: { bg: c.errorSoft, fg: c.errorText, label: 'High' },
		medium: { bg: c.warningSoft, fg: c.warningText, label: 'Medium' },
		low: { bg: c.successSoft, fg: c.successText, label: 'Low' }
	}
	return (
		<ListGroup inset={false}>
			{tasks.map((t) => {
				const p = priority[t.priority]
				return (
					<ListRow
						key={t.id}
						card={false}
						title={t.title}
						subtitle={[STATE_LABEL[t.state], t.dueDate && `Due ${t.dueDate}`]
							.filter(Boolean)
							.join(' · ')}
						accessory={
							<View style={[s.chip, { backgroundColor: p.bg }]}>
								<Text variant="caption" style={{ color: p.fg, fontWeight: '600' }}>
									{p.label}
								</Text>
							</View>
						}
					/>
				)
			})}
		</ListGroup>
	)
}

const s = StyleSheet.create({
	titleBlock: { gap: 10 },
	metrics: { flexDirection: 'row' },
	metric: { flex: 1, gap: 4 },
	bar: { marginTop: 18 },
	chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }
})
