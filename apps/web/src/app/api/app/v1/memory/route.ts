import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { gapStore } from '@/server/db/gaps'
import { memoryIdeas } from '@/server/gaps/memory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/memory: the caller's gaps, for Maya's board. Ideas they explained
 * correctly the first time are absent, because those have no row and no due date.
 */
export const GET = createAppRoute(endpoints.listMemory, async ({ user }) => {
	const rows = await gapStore.listMemory(user.id)
	return { body: { ideas: memoryIdeas(rows, new Date()) } }
})
