import { router } from 'expo-router'
import type { ClassSession, ClassTurn } from '@app/contract'

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
