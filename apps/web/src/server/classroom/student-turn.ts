import { z } from 'zod'

// What a student says next, and the rules for accepting it. Nothing here calls anything, so it
// is all unit-testable; next-question.ts sends this to the model.

export const DEFAULT_STUDENTS = [
	{
		name: 'Maya',
		persona: 'A curious beginner who asks for plain explanations and everyday examples.'
	},
	{
		name: 'Omar',
		persona: 'A sharp student who knows the material and checks the teacher against it.'
	}
]

// The sharp student has seen the source and holds the teacher to it. The beginner hasn't, and
// only knows what they've been taught.
const SOURCE_AWARE_STUDENT = 'Omar'

export function knowsTheSource({ name }: { name: string }): boolean {
	return name === SOURCE_AWARE_STUDENT
}

export const STUDENT_TURN_INSTRUCTION = [
	'You play the students in a small class. A person is teaching them something they learned.',
	"Write what one student says next, in that student's voice, in one or two short spoken sentences.",
	"When you have just been answered, first react to it in a few natural words, showing whether it helped or left the student confused. Never mark it right or wrong, and don't praise.",
	'Then ask one question. Ask about what sounds wrong first, then the most important idea left out. Skip fine details.',
	'Never give the answer away. Do not repeat an earlier question.',
	'Do not claim what the teacher said unless you repeat their exact words in quotation marks.',
	'Vary how you start. Never start with "Wait", "What about" or "You mentioned".',
	'If a student has spoken with this person in an earlier class, they may bring it up naturally.'
].join(' ')

export const STUDENT_TURN_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: { question: { type: 'string' } },
	required: ['question']
}

export const FOLLOW_UP_INSTRUCTION =
	'A student asked a teacher a question. Decide whether the answer actually helped: it must address the question and make sense. Set follow_up to true if it was wrong, vague or off the point.'

export const FOLLOW_UP_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: { follow_up: { type: 'boolean' } },
	required: ['follow_up']
}

export const WAITING_CHECK_INSTRUCTION = [
	'A student has a question ready for a teacher, and you decide what happens to it.',
	'First write a one-line reason, then set status.',
	"Use answered only if the teacher's own words give the answer to this exact question. Being about the same topic is not enough.",
	'Use overlap if another student is about to ask for the same thing, even in different words.',
	'Otherwise use open.'
].join(' ')

const WAITING_STATUSES = ['open', 'answered', 'overlap'] as const

export type WaitingStatus = (typeof WAITING_STATUSES)[number]

export const WAITING_CHECK_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: {
		reason: { type: 'string' },
		status: { type: 'string', enum: [...WAITING_STATUSES] }
	},
	propertyOrdering: ['reason', 'status'],
	required: ['reason', 'status']
}

const waitingCheckSchema = z.object({ status: z.enum(WAITING_STATUSES) })

const studentTurnSchema = z.object({ question: z.string() })
const followUpSchema = z.object({ follow_up: z.boolean() })

type Named = { id: string; name: string }
export type TurnSoFar = { studentId: string; question: string; answer: string | null }

export type StudentQuestion = { studentId: string; question: string }

type Heard = { outcome: string | null; answeredAt: Date | null; createdAt: Date }

/** The questions the person dealt with, in the order they did. */
export function heardTurns<T extends Heard>(turns: T[]): T[] {
	const when = ({ answeredAt, createdAt }: T) => (answeredAt ?? createdAt).getTime()
	return turns.filter(({ outcome }) => outcome !== null).sort((a, b) => when(a) - when(b))
}

export function parseWaitingCheck(raw: string | undefined): WaitingStatus {
	return waitingCheckSchema.parse(JSON.parse(raw ?? '')).status
}

export function parseFollowUp(raw: string | undefined): boolean {
	return followUpSchema.parse(JSON.parse(raw ?? '')).follow_up
}

/** The speaker's question, or null when the model has no question. */
export function parseStudentTurn(
	raw: string | undefined,
	studentId: string
): StudentQuestion | null {
	const text = studentTurnSchema.parse(JSON.parse(raw ?? '')).question.trim()
	return text ? { studentId, question: text } : null
}

type PromptInput = {
	transcript: string
	explanation: string
	focusConcepts: string[]
	students: (Named & { persona: string })[]
	turns: TurnSoFar[]
	pastTurns: TurnSoFar[]
	/** Questions other students have ready, which the person hasn't heard yet. */
	waiting: string[]
}

export type Speaker = Named & { persona: string }

/** Whether the speaker has an answer to react to, and whether it helped. */
export type TurnMoment = 'no_answer' | 'answered' | 'follow_up' | 'question_answered'

const MOMENT_PROMPTS: Record<TurnMoment, string> = {
	no_answer:
		'The teacher has not answered you, so there is nothing to react to. Just ask your question, without saying how the explanation seemed to you.',
	answered: 'React to the answer you just got, then ask your next question.',
	question_answered:
		"Start by saying, in your own words, that the teacher just answered what you were going to ask, like 'Oh, that answers what I had in mind.' Don't praise. Then ask about something new.",
	follow_up: 'Your last question was not answered well. React, then ask it again in a simpler way.'
}

function describeTurns(turns: TurnSoFar[], students: Named[]): string {
	const lines = turns.map(({ studentId, question, answer }) => {
		const name = students.find(({ id }) => id === studentId)?.name ?? 'A student'
		return `${name} asked: ${question}\nThe teacher said: ${answer ?? '(no answer)'}`
	})
	return lines.join('\n') || 'Nothing yet.'
}

export function buildFollowUpPrompt({ question, answer }: TurnSoFar): string {
	return `Question: ${question}\nAnswer: ${answer ?? ''}`
}

export function buildWaitingCheckPrompt(
	question: string,
	turns: TurnSoFar[],
	otherQuestions: string[]
): string {
	const answers = turns.flatMap(({ answer }) => (answer ? [answer] : []))
	return [
		`The student's question: ${question}`,
		`What the teacher has said:\n${answers.join('\n')}`,
		`What other students are about to ask:\n${otherQuestions.join('\n') || 'Nothing.'}`
	].join('\n\n')
}

/**
 * What the speaker gets. A student who hasn't seen the source is given none of it, so they
 * can't repeat it: what they know is exactly what the teacher has said.
 */
export function buildStudentTurnPrompt(
	input: PromptInput,
	speaker: Speaker,
	moment: TurnMoment
): string {
	const { transcript, explanation, focusConcepts, students, turns, pastTurns, waiting } = input
	const knows = knowsTheSource(speaker)
	return [
		`You are ${speaker.name}. ${speaker.persona}`,
		knows
			? 'You watched the video, so you may say what it says and use its terms. Ask about an important idea in it that the teacher got wrong or left out, not just about what they said. Only ask about what the video actually says, and never bring in ideas it does not mention.'
			: 'You have not seen the video. You only know what the teacher has told you. Ask about what confused you or seems to contradict itself.',
		`What the teacher said first:\n${explanation}`,
		`From earlier classes with this teacher:\n${describeTurns(pastTurns, students)}`,
		`This class so far:\n${describeTurns(turns, students)}`,
		...(knows
			? [`Focus concepts:\n${focusConcepts.join('\n')}`, `Video transcript:\n${transcript}`]
			: []),
		MOMENT_PROMPTS[moment],
		// A waiting question may come from the video, so only a student who saw it can be told.
		...(knows && waiting.length > 0
			? [`Never ask this or anything close to it, another student has it:\n${waiting.join('\n')}`]
			: [])
	].join('\n\n')
}
