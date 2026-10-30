import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query'
import { itemParams, type Item, type Task } from '@app/contract'
import { api, ApiError, type ResponseOf } from '@/lib/api'
import type { ItemSummary, TaskItem } from '@/lib/types'
import { formatCalendarDate, formatRelativeDate } from '@/lib/utils'

// The person's items and their tasks, through GET /api/app/v1/items,
// items/{id} and tasks?item_id= (docs/rules/mobile-data.md). Lists are pages:
// `fetchNextPage()` asks for the next one with the last page's cursor, and
// `hasNextPage` is false once the API says there is none.

export const ITEMS_PAGE_SIZE = 20
export const TASKS_PAGE_SIZE = 50

export function toItemSummary(item: Item): ItemSummary {
	return {
		id: item.id,
		name: item.name,
		owner: item.owner,
		status: item.status,
		completion: item.completion,
		health: item.health,
		activeUsers: item.active_users,
		updatedAt: formatRelativeDate(item.updated_at),
		summary: item.summary ?? ''
	}
}

export function toTaskItem(task: Task): TaskItem {
	return {
		id: task.id,
		itemId: task.item_id,
		title: task.title,
		state: task.state,
		priority: task.priority,
		dueDate: task.due_date ? formatCalendarDate(task.due_date) : ''
	}
}

type ItemPages = InfiniteData<ResponseOf<'listItems'>, string | undefined>
type TaskPages = InfiniteData<ResponseOf<'listTasks'>, string | undefined>

// Module-level, so TanStack runs each only when the pages change.
const selectItems = (data: ItemPages) => data.pages.flatMap((page) => page.items.map(toItemSummary))
const selectTasks = (data: TaskPages) => data.pages.flatMap((page) => page.tasks.map(toTaskItem))

/** The person's items, most recently updated first; `data` is every page loaded so far. */
export function useItems() {
	return useInfiniteQuery({
		queryKey: ['items'],
		queryFn: ({ pageParam, signal }) =>
			api('listItems', { query: { limit: ITEMS_PAGE_SIZE, cursor: pageParam }, signal }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		select: selectItems
	})
}

/**
 * One item. `null` when it doesn't exist or isn't the person's (the API answers
 * both with the same 404), including an id that can't be one, like a stale
 * deep link: that is the "gone" state, not an error.
 */
export function useItem(id: string) {
	return useQuery<ItemSummary | null>({
		queryKey: ['items', id],
		queryFn: async ({ signal }) => {
			if (!itemParams.safeParse({ id }).success) return null
			try {
				const { item } = await api('getItem', { params: { id }, signal })
				return toItemSummary(item)
			} catch (error) {
				if (error instanceof ApiError && error.code === 'not_found') return null
				throw error
			}
		}
	})
}

/** An item's tasks, oldest first; `data` is every page loaded so far. */
export function useItemTasks(itemId: string) {
	return useInfiniteQuery({
		queryKey: ['tasks', itemId],
		queryFn: ({ pageParam, signal }) =>
			api('listTasks', {
				query: { item_id: itemId, limit: TASKS_PAGE_SIZE, cursor: pageParam },
				signal
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		enabled: itemParams.safeParse({ id: itemId }).success,
		select: selectTasks
	})
}
