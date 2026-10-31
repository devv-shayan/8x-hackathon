import 'server-only'
import type { ClassSession } from '@app/contract'
import { notFound } from '@/server/api/app-route'
import { ApiError } from '@/server/api/app-errors'
import { classStore } from '@/server/db/classes'
import { topicStore, type TopicRecord } from '@/server/db/topics'
import { nextQuestion } from './next-question'
import { DEFAULT_STUDENTS, MAX_CLASS_QUESTIONS } from './student-turn'

type StoredClass = NonNullable<Awaited<ReturnType<typeof classStore.find>>>

type Outcome = 'answered' | 'needed_help' | 'skipped'

// Until scoring exists (8X-15) every concept is fair game. After that, this becomes the
// concepts the explanation missed or got wrong.
function focusConcepts(topic: TopicRecord): string[] {
	return topic.concepts.map(({ title, quote }) => `${title}: "${quote}"`)
}

async function askNext(userId: string, topic: TopicRecord, session: StoredClass) {
	const open = session.turns.some(({ outcome }) => outcome === null)
	if (open || session.turns.length >= MAX_CLASS_QUESTIONS) return null
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	const pastTurns = await classStore.pastTurns(
		students.map(({ id }) => id),
		session.id
	)
	const question = await nextQuestion({
		classId: session.id,
		transcript: topic.segments.map(({ text }) => text).join('\n'),
		explanation: session.explanation,
		focusConcepts: focusConcepts(topic),
		students,
		turns: session.turns,
		pastTurns
	})
	return question && classStore.addTurn(session.id, question.studentId, question.question)
}

async function toWireClass(userId: string, classId: string): Promise<ClassSession> {
	const session = await classStore.find(userId, classId)
	if (!session) throw notFound()
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	const last = session.turns.at(-1)
	return {
		id: session.id,
		topic_id: session.topicId,
		students: students.map(({ id, name, persona }) => ({ id, name, persona })),
		turns: session.turns.map(({ id, studentId, question, answer, outcome }) => ({
			id,
			student_id: studentId,
			question,
			answer,
			outcome
		})),
		finished: last === undefined || last.outcome !== null
	}
}

export async function startClass(userId: string, topicId: string, explanation: string) {
	const topic = await topicStore.findById(userId, topicId)
	if (!topic) throw notFound()
	const session = await classStore.create(topicId, explanation)
	await askNext(userId, topic, session)
	return toWireClass(userId, session.id)
}

export async function answerTurn(
	userId: string,
	classId: string,
	turnId: string,
	outcome: Outcome,
	answer: string | undefined
) {
	const session = await classStore.find(userId, classId)
	if (!session) throw notFound()
	const saved = await classStore.answerTurn(classId, turnId, { answer: answer ?? null, outcome })
	if (!saved) throw new ApiError('conflict', 'That question has already been answered.')
	const topic = await topicStore.findById(userId, session.topicId)
	if (!topic) throw notFound()
	const updated = await classStore.find(userId, classId)
	if (updated) await askNext(userId, topic, updated)
	return toWireClass(userId, classId)
}
