import 'server-only'
import type { AnswerWarmUpResult, DueWarmUp, WarmUp } from '@app/contract'
import { recordUserEvent } from '@/lib/analytics/record'
import { WARM_UP_EVENTS } from '@/lib/analytics/events'
import { ApiError } from '@/server/api/app-errors'
import { notFound } from '@/server/api/app-route'
import { DEFAULT_STUDENTS } from '@/server/classroom/student-turn'
import { classStore } from '@/server/db/classes'
import { warmUpStore, type StoredWarmUp } from '@/server/db/warm-ups'
import { isLocalDemoUser } from '@/server/demo/local-demo'
import { isGapDue, scheduleAfterJudgment } from '@/server/gaps/schedule'
import { askWarmUpQuestion, judgeWarmUp } from './ask'

const NOTHING_DUE = 'Nothing is due for a warm-up right now.'

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

export async function listDueWarmUps(userId: string, now = new Date()): Promise<DueWarmUp[]> {
	if (isLocalDemoUser(userId)) return []
	const gaps = await warmUpStore.listDue(userId, now)
	return gaps.map((gap) => ({
		gap_id: gap.id,
		topic_title: gap.topicTitle,
		concept_title: gap.concept.title,
		start_seconds: gap.concept.startSeconds,
		open_warm_up: gap.openWarmUp
			? {
					id: gap.openWarmUp.id,
					question: gap.openWarmUp.question,
					student_name: gap.openWarmUp.studentName
				}
			: null
	}))
}

/** The question already saved for this gap, or a new one. `created` is false when it already existed. */
export async function startWarmUp(input: {
	userId: string
	gapId: string
	now?: Date
}): Promise<{ warmUp: WarmUp; created: boolean }> {
	const { userId, gapId } = input
	const now = input.now ?? new Date()
	if (isLocalDemoUser(userId)) throw new ApiError('not_found', NOTHING_DUE)

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
	if (isLocalDemoUser(userId)) throw new ApiError('not_found', NOTHING_DUE)

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
