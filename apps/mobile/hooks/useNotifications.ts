import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import type { Notification } from '@app/contract'
import { api, type ResponseOf } from '@/lib/api'
import type { NotificationItem } from '@/lib/types'
import { formatRelativeDate } from '@/lib/utils'

// The person's notifications through GET /api/app/v1/notifications, newest
// first, a page at a time (docs/rules/mobile-data.md).

export const NOTIFICATIONS_PAGE_SIZE = 30

export function toNotificationItem(notification: Notification): NotificationItem {
	return {
		id: notification.id,
		title: notification.title,
		body: notification.body ?? '',
		timeAgo: formatRelativeDate(notification.created_at),
		category: notification.category,
		read: notification.read
	}
}

type NotificationPages = InfiniteData<ResponseOf<'listNotifications'>, string | undefined>

const selectNotifications = (data: NotificationPages) =>
	data.pages.flatMap((page) => page.notifications.map(toNotificationItem))

/** `data` is every page loaded so far. */
export function useNotifications() {
	return useInfiniteQuery({
		queryKey: ['notifications'],
		queryFn: ({ pageParam, signal }) =>
			api('listNotifications', {
				query: { limit: NOTIFICATIONS_PAGE_SIZE, cursor: pageParam },
				signal
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		select: selectNotifications
	})
}
