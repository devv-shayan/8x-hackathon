import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { BellOff, Server, Sparkles, Users, Wallet } from 'lucide-react-native'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { LoadMore, QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListGroup, ListRow, type IconComponent } from '@/components/ui/List'
import { ScreenTitle } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { useNotifications } from '@/hooks/useNotifications'
import { track } from '@/lib/analytics'
import type { NotificationItem } from '@/lib/types'

type ReadFilter = 'all' | 'unread'

const CATEGORY: Record<NotificationItem['category'], { icon: IconComponent; label: string }> = {
	billing: { icon: Wallet, label: 'Billing' },
	system: { icon: Server, label: 'System' },
	product: { icon: Sparkles, label: 'Product' },
	team: { icon: Users, label: 'Team' }
}

export default function ActivityScreen() {
	const c = useColors()
	const { showToast } = useToast()
	const notifications = useNotifications()
	// Read state is kept on this device, over what the API says: v1 has no
	// route that writes it yet. 🎨 REPLACE with a write to your backend (a new
	// route in @app/contract) when notifications become real.
	const [readState, setReadState] = useState<Record<string, boolean>>({})
	const [view, setView] = useState<ReadFilter>('all')
	const [openId, setOpenId] = useState<string | null>(null)

	const items = useMemo(
		() =>
			(notifications.data ?? []).map((item) =>
				item.id in readState ? { ...item, read: readState[item.id] } : item
			),
		[notifications.data, readState]
	)

	const unread = useMemo(() => items.filter((i) => !i.read).length, [items])
	const visible = useMemo(
		() => (view === 'all' ? items : items.filter((i) => !i.read)),
		[view, items]
	)
	const open = items.find((i) => i.id === openId) ?? null

	function markAllRead() {
		const before = readState
		const count = unread
		setReadState((prev) => ({
			...prev,
			...Object.fromEntries(items.filter((i) => !i.read).map((i) => [i.id, true]))
		}))
		track('notifications_marked_read', { count })
		showToast(`Marked ${count} as read`, 'success', {
			action: {
				label: 'Undo',
				onPress: () => {
					setReadState(before)
					track('notifications_mark_read_undone', { count })
				}
			}
		})
	}

	function openItem(item: NotificationItem) {
		setOpenId(item.id)
		track('notification_opened', { category: item.category })
		if (!item.read) setReadState((prev) => ({ ...prev, [item.id]: true }))
	}

	function toggleRead(item: NotificationItem) {
		setReadState((prev) => ({ ...prev, [item.id]: !item.read }))
	}

	return (
		<Screen tabs>
			<FadeSlideIn index={0} style={s.header}>
				<View style={s.flex}>
					<ScreenTitle title="Activity" subtitle="Updates about your account and your items." />
				</View>
			</FadeSlideIn>

			<FadeSlideIn index={1} style={s.controls}>
				<View style={s.flex}>
					<SegmentedControl
						accessibilityLabel="Show"
						value={view}
						onChange={setView}
						segments={[
							{ value: 'all', label: `All ${items.length}` },
							{ value: 'unread', label: `Unread ${unread}` }
						]}
					/>
				</View>
				<Button
					label="Mark all read"
					variant="ghost"
					size="sm"
					disabled={unread === 0}
					onPress={markAllRead}
				/>
			</FadeSlideIn>

			{notifications.data === undefined && notifications.isError ? (
				<QueryErrorState
					error={notifications.error}
					title="Couldn't load activity"
					onRetry={() => notifications.refetch()}
				/>
			) : notifications.data === undefined ? (
				<CardSkeleton height={220} />
			) : visible.length === 0 ? (
				<EmptyState
					icon={BellOff}
					title={view === 'unread' ? "You're all caught up" : 'No activity yet'}
					body={
						view === 'unread'
							? 'Nothing unread. New updates will land here.'
							: 'Updates about your account and items will appear here.'
					}
				/>
			) : (
				<FadeSlideIn index={2}>
					<ListGroup>
						{visible.map((item) => {
							const cat = CATEGORY[item.category]
							return (
								<ListRow
									key={item.id}
									card={false}
									icon={cat.icon}
									tone={item.read ? 'neutral' : 'brand'}
									title={item.title}
									subtitle={item.body}
									value={item.timeAgo}
									accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}`}
									accessory={
										item.read ? null : <View style={[s.dot, { backgroundColor: c.brandInk }]} />
									}
									onPress={() => openItem(item)}
								/>
							)
						})}
					</ListGroup>
				</FadeSlideIn>
			)}

			<LoadMore
				hasMore={notifications.hasNextPage}
				loading={notifications.isFetchingNextPage}
				error={notifications.isFetchNextPageError ? notifications.error : undefined}
				onPress={() => notifications.fetchNextPage()}
			/>

			<Sheet open={!!open} onClose={() => setOpenId(null)}>
				{open ? (
					<View style={s.sheet}>
						<Text variant="eyebrow" tone="brand">
							{CATEGORY[open.category].label} · {open.timeAgo}
						</Text>
						<Text variant="h2" accessibilityRole="header">
							{open.title}
						</Text>
						<Text variant="body" tone="body">
							{open.body}
						</Text>
						<View style={s.sheetActions}>
							<Button
								label={open.read ? 'Mark as unread' : 'Mark as read'}
								variant="outline"
								fullWidth
								onPress={() => {
									toggleRead(open)
									setOpenId(null)
								}}
							/>
							<Button label="Done" fullWidth onPress={() => setOpenId(null)} />
						</View>
					</View>
				) : null}
			</Sheet>
		</Screen>
	)
}

const s = StyleSheet.create({
	flex: { flex: 1 },
	header: { flexDirection: 'row', alignItems: 'flex-end' },
	controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	dot: { width: 8, height: 8, borderRadius: 4 },
	sheet: { gap: 12, paddingBottom: 8 },
	sheetActions: { gap: 10, marginTop: 12 }
})
