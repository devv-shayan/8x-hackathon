import 'server-only'
import { MAX_CLASS_QUESTIONS, type ClassSession } from '@app/contract'
import { notFound } from '@/server/api/app-route'
import { ApiError } from '@/server/api/app-errors'
import { classStore } from '@/server/db/classes'
import { gapStore } from '@/server/db/gaps'
import { log } from '@/server/lib/logger'
import { topicStore, type TopicRecord } from '@/server/db/topics'
import { isLocalDemoUser } from '@/server/demo/local-demo'
import { demoStudentQuestion, scoreDemoExplanation } from '@/server/demo/score-demo-explanation'
import { explainFromVideo } from './help'
import { scoreExplanation } from './find-explanation-score'
import { checkWaitingQuestion, nextQuestion } from './next-question'
import { focusConceptLines } from './score-explanation'
import { DEFAULT_STUDENTS, heardTurns, knowsTheSource } from './student-turn'

type StoredClass = NonNullable<Awaited<ReturnType<typeof classStore.find>>>

type Outcome = 'answered' | 'needed_help' | 'skipped'

// Scoring never holds a class up: without a score the students ask about every concept, and the
// class is scored again when it ends.
async function tryScore(topic: TopicRecord, explanation: string) {
	try {
		return await scoreExplanation({
			topicId: topic.id,
			segments: topic.segments,
			concepts: topic.concepts,
			explanation
		})
	} catch (error) {
		log.warn('could not score the explanation', {
			source: 'classroom/class-session',
			topic_id: topic.id,
			error: error instanceof Error ? error.message : String(error)
		})
		return []
	}
}

function focusConcepts(topic: TopicRecord, results: StoredClass['conceptResults']): string[] {
	return focusConceptLines(topic.concepts, results)
}

type StoredTurn = StoredClass['turns'][number]

function isOpen({ outcome }: StoredTurn) {
	return outcome === null
}

type Student = Awaited<ReturnType<typeof classStore.studentsFor>>[number]

// What a student needs to write a question, from the class as it stands now.
async function questionInput(topic: TopicRecord, session: StoredClass, students: Student[]) {
	return {
		classId: session.id,
		transcript: topic.segments.map(({ text }) => text).join('\n'),
		explanation: session.explanation,
		focusConcepts: focusConcepts(topic, session.conceptResults),
		students,
		// A question nobody has heard yet isn't part of the class, and Omar's may come from the
		// video, which Maya must not see.
		turns: heardTurns(session.turns),
		pastTurns: await classStore.pastTurns(
			students.map(({ id }) => id),
			session.id,
			session.topicId
		)
	}
}

function waitingFrom(session: StoredClass, speaker: Student) {
	return session.turns
		.filter((turn) => isOpen(turn) && turn.studentId !== speaker.id)
		.map(({ question }) => question)
}

// Every student keeps a hand up with their question ready, and the person picks who to answer.
// So a student only thinks of a new question once theirs has been dealt with.
async function raiseHand(
	userId: string,
	topic: TopicRecord,
	session: StoredClass,
	students: Student[],
	speaker: Student,
	answered?: StoredTurn
) {
	if (session.turns.length >= MAX_CLASS_QUESTIONS) return
	if (isLocalDemoUser(userId)) {
		const focus = focusConcepts(topic, session.conceptResults)
		await classStore.addTurn(
			session.id,
			speaker.id,
			demoStudentQuestion({
				studentName: speaker.name,
				knowsSource: knowsTheSource(speaker),
				focusConcepts: focus,
				turnIndex: session.turns.length
			})
		)
		return
	}
	const question = await nextQuestion({
		...(await questionInput(topic, session, students)),
		speaker,
		answered,
		waiting: waitingFrom(session, speaker)
	})
	if (question) await classStore.addTurn(session.id, question.studentId, question.question)
}

// A question written earlier can go stale once the person answers someone else, or match what
// another student just raised. Only then does a waiting student change theirs. Best effort: the
// one they have still works.
async function rethinkWaiting(
	userId: string,
	topic: TopicRecord,
	session: StoredClass,
	students: Student[],
	answeredStudentId: string
) {
	if (isLocalDemoUser(userId)) return
	const waiting = session.turns.filter(
		(turn) => isOpen(turn) && turn.studentId !== answeredStudentId
	)
	await Promise.all(
		waiting.map(async ({ id, question, studentId }) => {
			const speaker = students.find((student) => student.id === studentId)
			if (!speaker) return
			try {
				const others = waitingFrom(session, speaker)
				// Maya never hears of Omar's question: it may come from the video.
				const status = await checkWaitingQuestion(
					session.id,
					question,
					heardTurns(session.turns),
					knowsTheSource(speaker) ? others : []
				)
				if (status === 'open') return
				const replacement = await nextQuestion({
					...(await questionInput(topic, session, students)),
					speaker,
					waiting: others,
					moment: status === 'answered' ? 'question_answered' : 'no_answer'
				})
				if (replacement) await classStore.updateQuestion(id, replacement.question)
			} catch (error) {
				log.warn('student could not rethink their question', {
					source: 'classroom/class-session',
					class_id: session.id,
					error: error instanceof Error ? error.message : String(error)
				})
			}
		})
	)
}

async function toWireClass(userId: string, classId: string): Promise<ClassSession> {
	const session = await classStore.find(userId, classId)
	if (!session) throw notFound()
	return toWire(userId, session)
}

async function toWire(userId: string, session: StoredClass): Promise<ClassSession> {
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	const finished = !session.turns.some(isOpen)
	const topic = finished ? await topicStore.findById(userId, session.topicId) : null
	const starts = new Map(
		(topic?.concepts ?? []).map(({ title, startSeconds }) => [title, startSeconds])
	)
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
		finished,
		// Scoring stays off the wire until the class ends (docs/product/context.md).
		concept_results: finished
			? session.conceptResults.map(({ concept, result }) => ({
					concept,
					result,
					start_seconds: starts.get(concept) ?? null
				}))
			: null
	}
}

async function scoreIfMissed(userId: string, classId: string) {
	if (isLocalDemoUser(userId)) return
	const session = await classStore.find(userId, classId)
	if (!session || session.conceptResults.length > 0 || session.turns.some(isOpen)) return
	const topic = await topicStore.findById(userId, session.topicId)
	if (!topic) return
	const results = await tryScore(topic, session.explanation)
	if (results.length === 0) return
	await classStore.saveConceptResults(classId, results)
	await rememberGaps({ userId, topic, results })
}

/** A missed or wrong concept becomes a gap, due two days later. */
async function rememberGaps(input: {
	userId: string
	topic: TopicRecord
	results: StoredClass['conceptResults']
}) {
	if (isLocalDemoUser(input.userId) || input.results.length === 0) return
	await gapStore.saveFromResults({
		userId: input.userId,
		topicId: input.topic.id,
		concepts: input.topic.concepts,
		results: input.results,
		foundAt: new Date()
	})
}

/** The class to go back to on this topic, if one was left with hands still up. */
export async function openClass(userId: string, topicId: string) {
	const session = await classStore.findOpen(userId, topicId)
	return session && toWire(userId, session)
}

export async function startClass(userId: string, topicId: string, explanation: string) {
	const topic = await topicStore.findById(userId, topicId)
	if (!topic) throw notFound()
	const conceptResults = isLocalDemoUser(userId)
		? scoreDemoExplanation(explanation, topic.concepts)
		: await tryScore(topic, explanation)
	const session = await classStore.create(topicId, explanation, conceptResults)
	await rememberGaps({ userId, topic, results: conceptResults })
	const students = await classStore.studentsFor(userId, DEFAULT_STUDENTS)
	// One at a time, so a student who saw the video can steer clear of the question before theirs.
	for (const student of students) {
		const current = await classStore.find(userId, session.id)
		await raiseHand(userId, topic, current ?? session, students, student)
	}
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
	if (updated && speaker) {
		await raiseHand(userId, topic, updated, students, speaker, answered)
		const raised = await classStore.find(userId, classId)
		if (raised) await rethinkWaiting(userId, topic, raised, students, speaker.id)
	}
	await scoreIfMissed(userId, classId)
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
	await scoreIfMissed(userId, classId)
	return toWireClass(userId, classId)
}
