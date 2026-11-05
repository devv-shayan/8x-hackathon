import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { gapStore } from '@/server/db/gaps'
import { memoryIdeas } from '@/server/gaps/memory'
import { askersForTopics } from '@/server/warm-ups/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/memory: the caller's gaps, for the class's board, each with the student who
 * asks its warm-up (an open warm-up's own student, else the one the warm-up would pick). Ideas
 * they explained correctly the first time are absent, because those have no row and no date.
 */
export const GET = createAppRoute(endpoints.listMemory, async ({ user }) => {
	const rows = await gapStore.listMemory(user.id)
	const askers = await askersForTopics(
		user.id,
		rows.filter((row) => !row.askingStudent).map((row) => row.topicId)
	)
	const withStudents = rows.map((row) => ({
		...row,
		studentName: row.askingStudent ?? askers.get(row.topicId) ?? null
	}))
	return { body: { ideas: memoryIdeas(withStudents, new Date()) } }
})
