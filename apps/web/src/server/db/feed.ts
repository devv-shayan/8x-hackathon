import type { Activity, Notification, Prisma, PrismaClient } from '@prisma/client'
import { db } from './client'
import { pageArgs, toPage, type Page, type PageRequest } from './page'

// What happened to the person's items, and what the app tells them
// (prisma/schema/app.prisma: activity_feed, notifications), for /api/app/v1. Read-only here,
// newest first, scoped by the verified user id.

export type ActivityRecord = Pick<
	Activity,
	'id' | 'itemId' | 'kind' | 'title' | 'detail' | 'createdAt'
>

export type NotificationRecord = Pick<
	Notification,
	'id' | 'title' | 'body' | 'category' | 'read' | 'createdAt'
>

const ACTIVITY = {
	id: true,
	itemId: true,
	kind: true,
	title: true,
	detail: true,
	createdAt: true
} as const satisfies Prisma.ActivitySelect

const NOTIFICATION = {
	id: true,
	title: true,
	body: true,
	category: true,
	read: true,
	createdAt: true
} as const satisfies Prisma.NotificationSelect

export function createFeedStore(client: PrismaClient) {
	return {
		/**
		 * A page of the person's activity, newest first, for one item when given. An item that
		 * isn't theirs matches none of their rows: an empty page, never another person's.
		 */
		async activity(
			userId: string,
			{ itemId, ...page }: PageRequest & { itemId?: string }
		): Promise<Page<ActivityRecord>> {
			const rows = await client.activity.findMany({
				where: { userId, ...(itemId ? { itemId } : {}) },
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				select: ACTIVITY,
				...pageArgs(page)
			})
			return toPage(rows, page)
		},

		/** A page of the person's notifications, newest first. */
		async notifications(userId: string, page: PageRequest): Promise<Page<NotificationRecord>> {
			const rows = await client.notification.findMany({
				where: { userId },
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				select: NOTIFICATION,
				...pageArgs(page)
			})
			return toPage(rows, page)
		}
	}
}

export type FeedStore = ReturnType<typeof createFeedStore>

export const feedStore = createFeedStore(db)
