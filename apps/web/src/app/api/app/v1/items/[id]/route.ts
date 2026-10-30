import { endpoints } from '@app/contract'
import { createAppRoute, notFound } from '@/server/api/app-route'
import { toWireItem } from '@/server/api/wire'
import { itemStore } from '@/server/db/items'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/items/{id}: one of the person's items. Another person's item, a deleted
 * one and an id that doesn't exist are the same 404.
 */
export const GET = createAppRoute(endpoints.getItem, async ({ user, params }) => {
	const item = await itemStore.get(user.id, params.id)
	if (!item) throw notFound()
	return { body: { item: toWireItem(item) } }
})
