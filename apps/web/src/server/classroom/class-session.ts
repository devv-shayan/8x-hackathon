import 'server-only'
import { MAX_CLASS_QUESTIONS, type ClassSession } from '@app/contract'
import { notFound } from '@/server/api/app-route'
import { ApiError } from '@/server/api/app-errors'
import { classStore } from '@/server/db/classes'
import { topicStore, type TopicRecord } from '@/server/db/topics'
import { explainFromVideo } from './help'
import { nextQuestion } from './next-question'
import { DEFAULT_STUDENTS, heardTurns } from './student-turn'

type StoredClass = NonNullable<Awaited<ReturnType<typeof classStore.find>>>

type Outcome = 'answered' | 'needed_help' | 'skipped'

// Until scoring exists (8X-15) every concept is fair game. After that, this becomes the
// concepts the explanation missed or got wrong.
function focusConcepts(topic: TopicRecord): string[] {
	return topic.concepts.map(({ title, quote }) => `${title}: "${quote}"`)
}

type StoredTurn = StoredClass['turns'][number]

function isOpen({ outcome }: StoredTurn) {
	return outcome === null
}

type Student = Awaited<ReturnType<typeof classStore.studentsFor>>[number]

// Every student keeps a hand up with their question ready, and the person picks who to answer.
// So a student only thinks of a new question once theirs has been dealt with.
async function raiseHand(
	topic: TopicRecord,
	session: StoredClass,
	students: Student[],
	speaker: Student,
	answered?: StoredTurn
) {
	if (session.turns.length >= MAX_CLASS_QUESTIONS) return
	const pastTurns = await classStore.pastTurns(
		students.map(({ id }) => id),
		session.id,
		session.topicId
	)
	const question = await nextQuestion({
		classId: session.id,
		speaker,
		answered,
		transcript: topic.segments.map(({ text }) => text).join('\n'),
		explanation: session.explanation,
		focusConcepts: focusConcepts(topic),
		students,
		// A question nobody has heard yet isn't part of the class, and Omar's may come from the
		// video, which Maya must not see.
		turns: heardTurns(session.turns),
		pastTurns
	})
	if (question) await classStore.addTurn(session.id, question.studentId, question.question)
}

async function toWireClass(userId: string, classId: string): Promise<ClassSession> {
	const session = await classStore.find(userId, classId)
	if (!session) throw notFound()
	return toWire(userId, session)
}

async function toWire(userId: string, session: StoredClass): Promise<ClassSession> {
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	return {
		id: session.id,
		topic_id: session.topicId,
		students: students.map(({ id, name, persona }) => ({ id, name, persona })),
		turns: [...heardTurns(session.turns), ...session.turns.filter(isOpen)].map(
			({ id, studentId, question, answer, outcome }) => ({
				id,
				student_id: studentId,
				question,
				answer,
				outcome
			})
		),
		finished: !session.turns.some(isOpen)
	}
}

/** The class to go back to on this topic, if one was left with hands still up. */
export async function openClass(userId: string, topicId: string) {
	const session = await classStore.findOpen(userId, topicId)
	return session && toWire(userId, session)
}

export async function startClass(userId: string, topicId: string, explanation: string) {
	const topic = await topicStore.findById(userId, topicId)
	if (!topic) throw notFound()
	const session = await classStore.create(topicId, explanation)
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	await Promise.all(students.map((student) => raiseHand(topic, session, students, student)))
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
	const helped = session.turns.some(({ id, helpUsedAt }) => id === turnId && helpUsedAt)
	const saved = await classStore.answerTurn(classId, turnId, {
		answer: answer ?? null,
		outcome: helped && outcome === 'answered' ? 'needed_help' : outcome
	})
	if (!saved) throw new ApiError('conflict', 'That question has already been answered.')
	const topic = await topicStore.findById(userId, session.topicId)
	if (!topic) throw notFound()
	const updated = await classStore.find(userId, classId)
	const answered = updated?.turns.find(({ id }) => id === turnId)
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	const speaker = students.find(({ id }) => id === answered?.studentId)
	if (updated && speaker) await raiseHand(topic, updated, students, speaker, answered)
	return toWireClass(userId, classId)
}

/** Private help for a question still waiting on an answer. The class never sees it. */
export async function helpWithTurn(
	userId: string,
	classId: string,
	turnId: string,
	cancelled: AbortSignal
) {
	const session = await classStore.find(userId, classId)
	const turn = session?.turns.find(({ id }) => id === turnId)
	if (!session || !turn) throw notFound()
	if (!isOpen(turn)) throw new ApiError('conflict', 'That question has already been answered.')
	const topic = await topicStore.findById(userId, session.topicId)
	if (!topic) throw notFound()
	const { explanation, startSeconds } = await explainFromVideo(
		classId,
		topic.segments,
		turn.question
	)
	// Closing the panel before the help arrives means the person never saw it.
	if (!cancelled.aborted) await classStore.markHelpUsed(classId, turnId)
	return { explanation, start_seconds: startSeconds }
}

/** Ends the class early. Questions the person hadn't picked were never asked, so they go. */
export async function endClass(userId: string, classId: string) {
	const session = await classStore.find(userId, classId)
	if (!session) throw notFound()
	await classStore.dropOpenTurns(classId)
	return toWireClass(userId, classId)
}
