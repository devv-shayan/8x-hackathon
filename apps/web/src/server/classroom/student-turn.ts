import { z } from 'zod'

// What a student says next, and the rules for accepting it. Nothing here calls anything, so it
// is all unit-testable; next-question.ts sends this to the model.

export const MAX_CLASS_QUESTIONS = 4

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

function knowsTheSource({ name }: { name: string }): boolean {
	return name === SOURCE_AWARE_STUDENT
}

export const STUDENT_TURN_INSTRUCTION = [
	'You play the students in a small class. A person is teaching them something they learned.',
	"Write what one student says next, in that student's voice, in one or two short spoken sentences.",
	"After an answer, first react to it in a few natural words, showing whether it helped or left the student confused. Never mark it right or wrong, and don't praise.",
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

const studentTurnSchema = z.object({ question: z.string() })
const followUpSchema = z.object({ follow_up: z.boolean() })

type Named = { id: string; name: string }
type TurnSoFar = { studentId: string; question: string; answer: string | null }

export type StudentQuestion = { studentId: string; question: string }

// Who speaks is decided here, not by the model: it tends to favour one student.
export function otherStudent<T extends Named>(students: T[], turns: TurnSoFar[]): T {
	const last = students.findIndex(({ id }) => id === turns.at(-1)?.studentId)
	const student = students[(last + 1) % students.length]
	if (!student) throw new Error('A class needs at least one student')
	return student
}

// One follow-up in a row, so a student never pins the teacher down. A skip moves on: the
// teacher has said they don't know, and asking again would only press them.
export function studentWhoCanFollowUp<T extends Named>(
	students: T[],
	turns: TurnSoFar[]
): T | null {
	const last = turns.at(-1)
	if (!last || last.answer === null || turns.at(-2)?.studentId === last.studentId) return null
	return students.find(({ id }) => id === last.studentId) ?? null
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
}

type Speaker = Named & { persona: string }

function describeTurns(turns: TurnSoFar[], students: Named[]): string {
	const lines = turns.map(({ studentId, question, answer }) => {
		const name = students.find(({ id }) => id === studentId)?.name ?? 'A student'
		return `${name} asked: ${question}\nThe teacher said: ${answer ?? '(no answer)'}`
	})
	return lines.join('\n') || 'Nothing yet.'
}

export function buildFollowUpPrompt(turns: TurnSoFar[]): string {
	const last = turns.at(-1)
	return `Question: ${last?.question ?? ''}\nAnswer: ${last?.answer ?? ''}`
}

/**
 * What the speaker gets. A student who hasn't seen the source is given none of it, so they
 * can't repeat it: what they know is exactly what the teacher has said.
 */
export function buildStudentTurnPrompt(
	input: PromptInput,
	speaker: Speaker,
	followUp: boolean
): string {
	const { transcript, explanation, focusConcepts, students, turns, pastTurns } = input
	const knows = knowsTheSource(speaker)
	return [
		`You are ${speaker.name}. ${speaker.persona}`,
		knows
			? 'You watched the video, so you may say what it says and use its terms.'
			: 'You have not seen the video. You only know what the teacher has told you. Ask about what confused you or seems to contradict itself.',
		`What the teacher said first:\n${explanation}`,
		`From earlier classes with this teacher:\n${describeTurns(pastTurns, students)}`,
		`This class so far:\n${describeTurns(turns, students)}`,
		...(knows
			? [`Focus concepts:\n${focusConcepts.join('\n')}`, `Video transcript:\n${transcript}`]
			: []),
		followUp
			? 'Your last question was not answered well. Ask it again in a simpler way.'
			: 'Ask your next question.'
	].join('\n\n')
}
