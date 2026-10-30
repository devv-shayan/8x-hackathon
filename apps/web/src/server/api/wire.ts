import type { ActivityEntry, Item, Notification, Task } from '@app/contract'
import type { TaskState } from '@prisma/client'
import type { ActivityRecord, NotificationRecord } from '@/server/db/feed'
import type { ItemRecord } from '@/server/db/items'
import type { TaskRecord } from '@/server/db/tasks'

// Store rows → the /api/app/v1 wire format (@app/contract): snake_case keys, ISO 8601 UTC
// instants, YYYY-MM-DD dates. The one place a column name meets a field name, so the schema
// can change behind a v1 route without the route changing shape
// (docs/rules/migrations.md, "The phone is the oldest client").

type WireTaskState = Task['state']

// The database's `in-progress` is Prisma's `in_progress` (an enum key can't hold a dash).
const WIRE_TASK_STATE = {
	todo: 'todo',
	in_progress: 'in-progress',
	review: 'review',
	done: 'done'
} as const satisfies Record<TaskState, WireTaskState>

const DB_TASK_STATE = {
	todo: 'todo',
	'in-progress': 'in_progress',
	review: 'review',
	done: 'done'
} as const satisfies Record<WireTaskState, TaskState>

export function toTaskState(state: WireTaskState): TaskState {
	return DB_TASK_STATE[state]
}

/** A `date` column arrives as a Date at UTC midnight. */
function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` (already validated by the contract) → the Date Prisma writes to a `date` column. */
export function fromIsoDate(date: string): Date {
	return new Date(`${date}T00:00:00.000Z`)
}

export function toWireItem(row: ItemRecord): Item {
	return {
		id: row.id,
		name: row.name,
		owner: row.owner,
		status: row.status,
		completion: row.completion,
		health: row.health,
		active_users: row.activeUsers,
		summary: row.summary,
		created_at: row.createdAt.toISOString(),
		updated_at: row.updatedAt.toISOString()
	}
}

export function toWireTask(row: TaskRecord): Task {
	return {
		id: row.id,
		item_id: row.itemId,
		title: row.title,
		state: WIRE_TASK_STATE[row.state],
		priority: row.priority,
		due_date: row.dueDate ? toIsoDate(row.dueDate) : null,
		created_at: row.createdAt.toISOString(),
		updated_at: row.updatedAt.toISOString()
	}
}

export function toWireActivity(row: ActivityRecord): ActivityEntry {
	return {
		id: row.id,
		item_id: row.itemId,
		kind: row.kind,
		title: row.title,
		detail: row.detail,
		created_at: row.createdAt.toISOString()
	}
}

export function toWireNotification(row: NotificationRecord): Notification {
	return {
		id: row.id,
		title: row.title,
		body: row.body,
		category: row.category,
		read: row.read,
		created_at: row.createdAt.toISOString()
	}
}
