import { router } from 'expo-router'
import type { ClassSession, ClassTurn, TurnOutcome } from '@app/contract'
import { api, ApiError } from '@/lib/api'

// A student's next question is an AI call, so it takes longer than the API default.
export const CLASS_TIMEOUT_MS = 60 * 1000

export function studentName(session: ClassSession, turn: ClassTurn) {
	return session.students.find(({ id }) => id === turn.student_id)?.name ?? 'A student'
}

// A class opened from a link or a reload has nothing behind it to go back to.
export function leaveClass() {
	if (router.canGoBack()) router.back()
	else router.replace('/(tabs)')
}

/**
 * Answers or skips a question. That can take most of a minute (the next question is an AI
 * call), and if the app gives up first the server may still have recorded it, so trying again
 * says it's already answered. After a timeout or that conflict, the class is read back: if the
 * question is no longer open, the server's class stands and the person carries on from it.
 */
export async function answerOrCatchUp(
	classId: string,
	turnId: string,
	body: { outcome: TurnOutcome; answer?: string }
): Promise<{ class: ClassSession }> {
	try {
		return await api('answerTurn', {
			params: { id: classId, turn: turnId },
			body,
			timeoutMs: CLASS_TIMEOUT_MS
		})
	} catch (error) {
		if (!(error instanceof ApiError) || (error.code !== 'timeout' && error.code !== 'conflict')) {
			throw error
		}
		const latest = await api('getClass', { params: { id: classId } }).catch(() => null)
		const turn = latest?.class.turns.find(({ id }) => id === turnId)
		if (latest && turn && turn.outcome !== null) return latest
		throw error
	}
}
