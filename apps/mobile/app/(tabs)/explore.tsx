import { useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { ReduceMotion } from 'react-native-reanimated'
import { useQueryClient } from '@tanstack/react-query'
import { Search, SearchX } from 'lucide-react-native'
import { ItemCard } from '@/components/ItemCard'
import { LoadMore, QueryErrorState } from '@/components/QueryError'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { PressableScale } from '@/components/motion/PressableScale'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScreenTitle } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useColors } from '@/contexts/ThemeContext'
import { useItems } from '@/hooks/useItems'
import { haptic } from '@/lib/haptics'
import { layoutTransition } from '@/lib/motion'
import type { ItemStatus } from '@/lib/types'

type Filter = 'all' | ItemStatus

const FILTERS: { key: Filter; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'active', label: 'Active' },
	{ key: 'pending', label: 'Pending' },
	{ key: 'archived', label: 'Archived' }
]

const listLayout = layoutTransition.reduceMotion(ReduceMotion.System)

export default function ExploreScreen() {
	const c = useColors()
	const queryClient = useQueryClient()
	const [refreshing, setRefreshing] = useState(false)
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState<Filter>('all')
	const items = useItems()

	const filtered = useMemo(() => {
		const all = items.data ?? []
		const byStatus = filter === 'all' ? all : all.filter((i) => i.status === filter)
		const q = query.trim().toLowerCase()
		if (!q) return byStatus
		return byStatus.filter(
			(i) =>
				i.name.toLowerCase().includes(q) ||
				i.owner.toLowerCase().includes(q) ||
				i.summary.toLowerCase().includes(q)
		)
	}, [filter, query, items.data])

	async function onRefresh() {
		setRefreshing(true)
		haptic.refresh()
		await queryClient.invalidateQueries({ queryKey: ['items'] })
		setRefreshing(false)
	}

	return (
		<Screen
			tabs
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={onRefresh}
					tintColor={c.brandInk}
					colors={[c.brandInk]}
					progressBackgroundColor={c.surface}
				/>
			}
		>
			<FadeSlideIn index={0}>
				<ScreenTitle title="Explore" subtitle="Search and browse everything in one place." />
			</FadeSlideIn>

			<FadeSlideIn index={1}>
				<TextInputField
					value={query}
					onChangeText={setQuery}
					placeholder="Search by name, owner or summary"
					accessibilityLabel="Search"
					icon={(color) => <Search size={18} color={color} strokeWidth={2} />}
					returnKeyType="search"
					clearButtonMode="while-editing"
					autoCorrect={false}
				/>
			</FadeSlideIn>

			<FadeSlideIn index={2}>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={s.filters}
					accessibilityRole="tablist"
				>
					{FILTERS.map((f) => {
						const active = f.key === filter
						return (
							<PressableScale
								key={f.key}
								haptic="select"
								scaleTo={0.94}
								hitSlop={{ top: 4, bottom: 4 }}
								onPress={() => setFilter(f.key)}
								accessibilityRole="tab"
								accessibilityState={{ selected: active }}
								style={[
									s.chip,
									{
										backgroundColor: active ? c.brandDim : c.surface,
										borderColor: active ? c.brandBorder : c.borderSoft
									}
								]}
							>
								<Text variant="label" style={{ color: active ? c.brandInk : c.textSecondary }}>
									{f.label}
								</Text>
							</PressableScale>
						)
					})}
				</ScrollView>
			</FadeSlideIn>

			{items.data === undefined && items.isError ? (
				<QueryErrorState
					error={items.error}
					title="Couldn't load items"
					onRetry={() => items.refetch()}
				/>
			) : items.data === undefined ? (
				<>
					<CardSkeleton />
					<CardSkeleton />
					<CardSkeleton />
				</>
			) : filtered.length === 0 ? (
				<>
					<EmptyState
						icon={SearchX}
						title={query ? 'No matches' : 'Nothing in this list'}
						body={
							items.hasNextPage
								? 'Nothing in what has loaded so far. Load more to look further.'
								: query
									? 'Try another word, or switch the filter to All.'
									: 'Items appear here as they are created.'
						}
						action={
							!items.hasNextPage && (query || filter !== 'all')
								? {
										label: 'Clear search',
										onPress: () => {
											setQuery('')
											setFilter('all')
										}
									}
								: undefined
						}
					/>
					<LoadMore
						hasMore={items.hasNextPage}
						loading={items.isFetchingNextPage}
						error={items.isFetchNextPageError ? items.error : undefined}
						onPress={() => items.fetchNextPage()}
						label="Load more"
					/>
				</>
			) : (
				<View style={s.list}>
					{filtered.map((item, i) => (
						<Animated.View key={item.id} layout={listLayout}>
							<FadeSlideIn index={3 + i}>
								<ItemCard item={item} />
							</FadeSlideIn>
						</Animated.View>
					))}
					<LoadMore
						hasMore={items.hasNextPage}
						loading={items.isFetchingNextPage}
						error={items.isFetchNextPageError ? items.error : undefined}
						onPress={() => items.fetchNextPage()}
					/>
				</View>
			)}
		</Screen>
	)
}

const s = StyleSheet.create({
	filters: { gap: 8, paddingRight: 8 },
	chip: {
		height: 36,
		paddingHorizontal: 16,
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center'
	},
	list: { gap: 12 }
})
