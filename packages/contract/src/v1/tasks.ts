import { z } from 'zod'
import { isoDate, isoDateTime, nextCursor, pageQuery, uuid } from './common'

// /api/app/v1/tasks: tasks on the person's own items.
//
// GET tasks?item_id= → one item's tasks, oldest first; 404 when the item isn't
//                      the person's
// POST tasks         → add a task to one of the person's items (404 otherwise).
//                      The same device-generated `id` rule as POST items.

export const TASK_STATES = ['todo', 'in-progress', 'review', 'done'] as const
export const taskStateSchema = z.enum(TASK_STATES)

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)

export const taskSchema = z.object({
	id: uuid,
	item_id: uuid,
	title: z.string(),
	state: taskStateSchema,
	priority: taskPrioritySchema,
	due_date: isoDate.nullable(),
	created_at: isoDateTime,
	updated_at: isoDateTime
})

export const listTasksQuery = pageQuery.extend({ item_id: uuid })

export const listTasksResponse = z.object({
	tasks: z.array(taskSchema),
	next_cursor: nextCursor
})

export const taskResponse = z.object({ task: taskSchema })

export const createTaskBody = z
	.object({
		id: uuid.optional(),
		item_id: uuid,
		title: z.string().trim().min(1).max(200),
		state: taskStateSchema.optional(),
		priority: taskPrioritySchema.optional(),
		due_date: isoDate.nullable().optional()
	})
	.strict()

export type Task = z.infer<typeof taskSchema>
export type CreateTaskBody = z.infer<typeof createTaskBody>
