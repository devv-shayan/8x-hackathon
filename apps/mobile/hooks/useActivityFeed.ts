import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import type { ActivityEntry } from '@app/contract'
import { api, type ResponseOf } from '@/lib/api'
import type { ActivityItem } from '@/lib/types'
import { formatRelativeDate } from '@/lib/utils'

// The person's activity feed through GET /api/app/v1/activity, newest first,
// a page at a time (docs/rules/mobile-data.md).

export const ACTIVITY_PAGE_SIZE = 20

export function toActivityItem(entry: ActivityEntry): ActivityItem {
	return {
		id: entry.id,
		itemId: entry.item_id,
		kind: entry.kind,
		title: entry.title,
		detail: entry.detail ?? '',
		timeAgo: formatRelativeDate(entry.created_at)
	}
}

type ActivityPages = InfiniteData<ResponseOf<'listActivity'>, string | undefined>

const selectActivity = (data: ActivityPages) =>
	data.pages.flatMap((page) => page.activity.map(toActivityItem))

/** The feed, or one item's part of it; `data` is every page loaded so far. */
export function useActivityFeed(itemId?: string) {
	return useInfiniteQuery({
		queryKey: itemId ? ['activity', itemId] : ['activity'],
		queryFn: ({ pageParam, signal }) =>
			api('listActivity', {
				query: { limit: ACTIVITY_PAGE_SIZE, cursor: pageParam, item_id: itemId },
				signal
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		select: selectActivity
	})
}
