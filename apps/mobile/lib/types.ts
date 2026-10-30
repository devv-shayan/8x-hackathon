/**
 * The app's shared domain types: what the data hooks return and the screens
 * render.
 *
 * The data hooks map the API's responses (`@app/contract`, snake_case, ISO
 * dates) into these, so a screen never depends on the wire shape. Every enum is
 * the contract's own, so the two can't drift: a status the API adds is a type
 * error here before it is a blank chip on a phone.
 */
import type { ActivityEntry, Item, Notification, Task } from '@app/contract'

export type ItemStatus = Item['status']
export type TaskState = Task['state']
export type TaskPriority = Task['priority']

export type ItemSummary = {
	id: string
	name: string
	owner: string
	status: ItemStatus
	completion: number
	health: number
	activeUsers: number
	/** Display date, e.g. "Sep 24". */
	updatedAt: string
	summary: string
}

export type TaskItem = {
	id: string
	itemId: string
	title: string
	state: TaskState
	priority: TaskPriority
	/** Display date, or '' when there is none. */
	dueDate: string
}

export type ActivityItem = {
	id: string
	itemId: string
	kind: ActivityEntry['kind']
	title: string
	detail: string
	timeAgo: string
}

export type NotificationItem = {
	id: string
	title: string
	body: string
	timeAgo: string
	category: Notification['category']
	read: boolean
}
