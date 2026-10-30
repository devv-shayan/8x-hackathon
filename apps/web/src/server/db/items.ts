import { randomUUID } from 'node:crypto'
import type { Item, ItemStatus, Prisma, PrismaClient } from '@prisma/client'
import { db } from './client'
import { pageArgs, toPage, type Page, type PageRequest } from './page'

// The person's items (prisma/schema/app.prisma), for /api/app/v1. Every method takes the
// user id the route verified (requireUser), never one from the request, and scopes every
// query by it. A soft-deleted item (deleted_at set) no longer exists as far as the app knows.

export type ItemRecord = Pick<
	Item,
	| 'id'
	| 'name'
	| 'owner'
	| 'status'
	| 'completion'
	| 'health'
	| 'activeUsers'
	| 'summary'
	| 'createdAt'
	| 'updatedAt'
>

export type NewItem = {
	/** Generated on the device, so a retry of the same create finds its row. */
	id?: string
	name: string
	owner?: string
	summary?: string | null
	status?: ItemStatus
}

/**
 * A create that takes an optional id: made now, found from an earlier try of the same create
 * (the phone lost the response), or the id is already another person's (or a deleted row's).
 */
export type CreateResult<T> = { outcome: 'created' | 'existing'; row: T } | { outcome: 'conflict' }

const ITEM = {
	id: true,
	name: true,
	owner: true,
	status: true,
	completion: true,
	health: true,
	activeUsers: true,
	summary: true,
	createdAt: true,
	updatedAt: true
} as const satisfies Prisma.ItemSelect

export function createItemStore(client: PrismaClient) {
	return {
		/** A page of the person's items, most recently updated first. */
		async list(userId: string, page: PageRequest): Promise<Page<ItemRecord>> {
			const rows = await client.item.findMany({
				where: { userId, deletedAt: null },
				orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
				select: ITEM,
				...pageArgs(page)
			})
			return toPage(rows, page)
		},

		/** One of the person's items. Null when it is someone else's, deleted, or no such id. */
		async get(userId: string, id: string): Promise<ItemRecord | null> {
			return client.item.findFirst({ where: { id, userId, deletedAt: null }, select: ITEM })
		},

		/**
		 * Inserts unless the id exists (ON CONFLICT DO NOTHING), then reads the row back: one
		 * statement decides a race between two tries of the same create, and the read says whose
		 * row the id is.
		 */
		async create(userId: string, input: NewItem): Promise<CreateResult<ItemRecord>> {
			const id = input.id ?? randomUUID()
			const { count } = await client.item.createMany({
				data: [
					{
						id,
						userId,
						name: input.name,
						owner: input.owner,
						summary: input.summary,
						status: input.status
					}
				],
				skipDuplicates: true
			})
			const row = await client.item.findUnique({
				where: { id },
				select: { ...ITEM, userId: true, deletedAt: true }
			})
			if (!row || row.userId !== userId || row.deletedAt) return { outcome: 'conflict' }
			return { outcome: count === 1 ? 'created' : 'existing', row }
		}
	}
}

export type ItemStore = ReturnType<typeof createItemStore>

export const itemStore = createItemStore(db)
