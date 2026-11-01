import { z } from 'zod'
import { ApiError } from '@/server/api/app-errors'
import { knowsTheSource } from '@/server/classroom/student-turn'

// The question a student asks about one gap, and the judgment of the answer.
// Nothing here calls the model; ask.ts does.

export const WARM_UP_QUESTION_INSTRUCTION = [
	'You are one student who remembers this teacher from a past class.',
	'Ask one question, in your own voice, about the gap they still owe you.',
	'One or two short spoken sentences. No multiple choice.',
	'Never give the answer away, and never quote the concept as the answer.',
	'Use only the transcript and the gap. Do not invent facts the transcript does not contain.',
	'If you spoke with them before, you may bring that up naturally.',
	'Vary how you start. Never start with "Wait", "What about" or "You mentioned".'
].join(' ')

export const WARM_UP_QUESTION_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: { question: { type: 'string' } },
	required: ['question']
}

export const WARM_UP_JUDGE_INSTRUCTION = [
	"You judge a teacher's answer to one question about one gap.",
	'Set is_right to true only if their own words state the idea in the concept, even in different words.',
	'Vague, wrong, off the point, or only restating the question is false.',
	'The quote and the transcript are the truth. Do not require the exact wording.',
	'Do not explain. Return only the judgment.'
].join(' ')

export const WARM_UP_JUDGE_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: { is_right: { type: 'boolean' } },
	required: ['is_right']
}

const questionSchema = z.object({ question: z.string() })
const judgmentSchema = z.object({ is_right: z.boolean() })

export type WarmUpStudent = { name: string; persona: string }

export type WarmUpConcept = { title: string; quote: string }

export type WarmUpMemory = { question: string; answer: string | null }

export type WarmUpQuestionInput = {
	student: WarmUpStudent
	concept: WarmUpConcept
	transcript: string
	past: WarmUpMemory[]
}

export type WarmUpJudgeInput = {
	concept: WarmUpConcept
	transcript: string
	question: string
	answer: string
}

function memoryLines(past: WarmUpMemory[]): string {
	if (past.length === 0) return 'You have not spoken with them about this video before.'
	return past
		.map(({ question, answer }) => `You asked: ${question}\nThey said: ${answer ?? '(no answer)'}`)
		.join('\n')
}

/** What the student is given. The quote is there so the question is about that gap, and the instruction forbids saying it. */
export function buildWarmUpQuestionPrompt(input: WarmUpQuestionInput): string {
	const { student, concept, transcript, past } = input
	const knows = knowsTheSource(student)
	return [
		`You are ${student.name}. ${student.persona}`,
		knows
			? 'You watched this video, so you may use its terms. Ask about this gap, not a new topic.'
			: 'Ask in plain words, the way someone who is still learning would. You may use what the video says, but do not lecture.',
		`The gap you are asking about: ${concept.title}`,
		`What the video says, which you must not give away: "${concept.quote}"`,
		`From earlier with this teacher:\n${memoryLines(past)}`,
		`Video transcript:\n${transcript}`
	].join('\n\n')
}

export function buildWarmUpJudgePrompt(input: WarmUpJudgeInput): string {
	const { concept, transcript, question, answer } = input
	return [
		`Concept: ${concept.title}`,
		`What the video says: "${concept.quote}"`,
		`Video transcript:\n${transcript}`,
		`The student asked: ${question}`,
		`The teacher answered: ${answer}`
	].join('\n\n')
}

/** The student's question. Empty or malformed replies throw. */
export function parseWarmUpQuestion(raw: string | undefined): string {
	const question = questionSchema.parse(JSON.parse(raw ?? '')).question.trim()
	if (question.length === 0) throw new SyntaxError('empty warm-up question')
	return question
}

/** Whether the answer was right. A malformed reply throws. */
export function parseWarmUpJudgment(raw: string | undefined): boolean {
	return judgmentSchema.parse(JSON.parse(raw ?? '')).is_right
}

/**
 * A model reply that is not the JSON we asked for. Other errors return null
 * so the caller can map Gemini's own failures the usual way.
 */
export function warmUpReplyError(error: unknown, message: string): ApiError | null {
	if (error instanceof SyntaxError || error instanceof z.ZodError) {
		return new ApiError('unavailable', message, { cause: error })
	}
	return null
}
