import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient, Task, TaskPriority, TaskState } from '@prisma/client'
import { db } from './client'
import type { CreateResult } from './items'
import { pageArgs, toPage, type Page, type PageRequest } from './page'

// Tasks on the person's own items (prisma/schema/app.prisma), for /api/app/v1. Scoped like
// ./items: by the verified user id, and a task or item with deleted_at set is gone. A task
// is only ever reached through an item that is the person's and not deleted.

export type TaskRecord = Pick<
	Task,
	'id' | 'itemId' | 'title' | 'state' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt'
>

export type NewTask = {
	/** Generated on the device, so a retry of the same create finds its row. */
	id?: string
	itemId: string
	title: string
	state?: TaskState
	priority?: TaskPriority
	/** A calendar date, at UTC midnight. */
	dueDate?: Date | null
}

const TASK = {
	id: true,
	itemId: true,
	title: true,
	state: true,
	priority: true,
	dueDate: true,
	createdAt: true,
	updatedAt: true
} as const satisfies Prisma.TaskSelect

export function createTaskStore(client: PrismaClient) {
	const ownsItem = async (userId: string, itemId: string) =>
		(await client.item.count({ where: { id: itemId, userId, deletedAt: null } })) > 0

	return {
		/**
		 * A page of one item's tasks, oldest first. Null when the item is not the person's (or
		 * is deleted), so the route can answer 404 rather than an empty list.
		 */
		async list(
			userId: string,
			itemId: string,
			page: PageRequest
		): Promise<Page<TaskRecord> | null> {
			if (!(await ownsItem(userId, itemId))) return null
			const rows = await client.task.findMany({
				where: { itemId, userId, deletedAt: null },
				orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
				select: TASK,
				...pageArgs(page)
			})
			return toPage(rows, page)
		},

		/**
		 * Adds a task to one of the person's items, idempotently by id as ./items' create does.
		 * An id already used for a task on another item is a conflict, not that other task.
		 */
		async create(
			userId: string,
			input: NewTask
		): Promise<CreateResult<TaskRecord> | { outcome: 'item_not_found' }> {
			if (!(await ownsItem(userId, input.itemId))) return { outcome: 'item_not_found' }
			const id = input.id ?? randomUUID()
			const { count } = await client.task.createMany({
				data: [
					{
						id,
						userId,
						itemId: input.itemId,
						title: input.title,
						state: input.state,
						priority: input.priority,
						dueDate: input.dueDate
					}
				],
				skipDuplicates: true
			})
			const row = await client.task.findUnique({
				where: { id },
				select: { ...TASK, userId: true, deletedAt: true }
			})
			if (!row || row.userId !== userId || row.deletedAt || row.itemId !== input.itemId) {
				return { outcome: 'conflict' }
			}
			return { outcome: count === 1 ? 'created' : 'existing', row }
		}
	}
}

export type TaskStore = ReturnType<typeof createTaskStore>

export const taskStore = createTaskStore(db)
