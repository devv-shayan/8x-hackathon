import 'server-only'
import type { AnswerWarmUpResult, DueWarmUp, WarmUp } from '@app/contract'
import { recordUserEvent } from '@/lib/analytics/record'
import { WARM_UP_EVENTS } from '@/lib/analytics/events'
import { ApiError } from '@/server/api/app-errors'
import { notFound } from '@/server/api/app-route'
import { DEFAULT_STUDENTS } from '@/server/classroom/student-turn'
import { toDueWarmUp } from './due'
import { classStore } from '@/server/db/classes'
import { warmUpStore, type StoredWarmUp } from '@/server/db/warm-ups'
import { isGapDue, scheduleAfterJudgment } from '@/server/gaps/schedule'
import { askWarmUpQuestion, judgeWarmUp } from './ask'

function toWarmUp(row: StoredWarmUp): WarmUp {
	return {
		id: row.id,
		gap_id: row.gapId,
		question: row.question,
		student_name: row.studentName
	}
}

function transcriptOf(segments: { text: string }[]): string {
	return segments.map(({ text }) => text).join('\n')
}

/** Someone who spoke in a class on this topic, or else the person's own students. */
async function studentFor(userId: string, topicId: string) {
	const remembered = await warmUpStore.rememberedStudent(userId, topicId)
	if (remembered) return remembered
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	const student = students[0]
	if (!student) {
		throw new ApiError('internal', 'Something went wrong on our side. Try again.')
	}
	return student
}

/**
 * Who will ask each of these topics' warm-ups, as `studentFor` picks: the student the person
 * answered last on that topic, or else their first student. One query for all of them.
 */
export async function askersForTopics(
	userId: string,
	topicIds: string[]
): Promise<Map<string, string>> {
	const unique = [...new Set(topicIds)]
	if (unique.length === 0) return new Map()
	const askers = await warmUpStore.rememberedStudents(userId, unique)
	if (unique.every((id) => askers.has(id))) return askers
	const fallback = (await classStore.studentsFor(userId, DEFAULT_STUDENTS))[0]
	if (fallback) for (const id of unique) if (!askers.has(id)) askers.set(id, fallback.name)
	return askers
}

/**
 * The due warm-ups, each naming who asks: an open warm-up's own student, or else the one
 * `askersForTopics` finds, in one query for every video rather than one per gap.
 */
export async function listDueWarmUps(userId: string, now = new Date()): Promise<DueWarmUp[]> {
	const gaps = await warmUpStore.listDue(userId, now)
	const askers = await askersForTopics(
		userId,
		gaps.filter((gap) => !gap.openWarmUp).map((gap) => gap.topicId)
	)
	return gaps.map((gap) => {
		if (gap.openWarmUp) return toDueWarmUp(gap, '')
		const asker = askers.get(gap.topicId)
		if (!asker) throw new ApiError('internal', 'Something went wrong on our side. Try again.')
		return toDueWarmUp(gap, asker)
	})
}

/** The question already saved for this gap, or a new one. `created` is false when it already existed. */
export async function startWarmUp(input: {
	userId: string
	gapId: string
	now?: Date
}): Promise<{ warmUp: WarmUp; created: boolean }> {
	const { userId, gapId } = input
	const now = input.now ?? new Date()

	const gap = await warmUpStore.findGap(userId, gapId)
	if (!gap) throw notFound()
	if (gap.closedAt) throw new ApiError('conflict', 'That gap is already closed.')
	if (!isGapDue(gap, now)) throw new ApiError('conflict', "That warm-up isn't due yet.")

	const open = await warmUpStore.findOpen(gapId)
	if (open) return { warmUp: toWarmUp(open), created: false }

	const student = await studentFor(userId, gap.topicId)
	const past = await warmUpStore.pastExchanges(student.id, gap.topicId)
	const question = await askWarmUpQuestion({
		gapId,
		student,
		concept: { title: gap.concept.title, quote: gap.concept.quote },
		transcript: transcriptOf(gap.segments),
		past
	})
	const saved = await warmUpStore.saveQuestion({
		gapId,
		studentId: student.id,
		question
	})
	if (saved.created) {
		await recordUserEvent(userId, WARM_UP_EVENTS.started, {
			path: '/api/app/v1/warm-ups',
			metadata: { gap_id: gapId },
			dedupeDaily: false
		})
	}
	return { warmUp: toWarmUp(saved.warmUp), created: saved.created }
}

export async function answerWarmUp(input: {
	userId: string
	warmUpId: string
	answer: string
	now?: Date
}): Promise<AnswerWarmUpResult> {
	const { userId, warmUpId, answer } = input
	const now = input.now ?? new Date()

	const row = await warmUpStore.findForAnswer(userId, warmUpId)
	if (!row) throw notFound()
	if (row.answer != null || row.isRight != null) {
		throw new ApiError('conflict', "You've already answered this one.")
	}
	if (row.closedAt) throw new ApiError('conflict', 'That gap is already closed.')

	const isRight = await judgeWarmUp({
		gapId: row.gapId,
		concept: { title: row.concept.title, quote: row.concept.quote },
		transcript: transcriptOf(row.segments),
		question: row.question,
		answer
	})
	const schedule = scheduleAfterJudgment({ rightStreak: row.rightStreak }, isRight, now)
	const outcome = await warmUpStore.saveJudgment({
		userId,
		warmUpId,
		answer,
		isRight,
		schedule
	})
	if (outcome === 'missing') throw notFound()
	if (outcome === 'answered') {
		throw new ApiError('conflict', "You've already answered this one.")
	}
	await recordUserEvent(userId, WARM_UP_EVENTS.answered, {
		path: '/api/app/v1/warm-ups',
		metadata: { gap_id: row.gapId, is_right: isRight },
		dedupeDaily: false
	})
	return {
		is_right: isRight,
		closed: schedule.closedAt != null,
		next_due_at: schedule.closedAt == null ? schedule.nextDueAt.toISOString() : null
	}
}
