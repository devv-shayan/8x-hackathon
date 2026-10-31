import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import { toVideoError } from '@/server/video/read-video'
import {
	buildFollowUpPrompt,
	buildStudentTurnPrompt,
	FOLLOW_UP_INSTRUCTION,
	FOLLOW_UP_RESPONSE_JSON_SCHEMA,
	parseFollowUp,
	parseStudentTurn,
	STUDENT_TURN_INSTRUCTION,
	STUDENT_TURN_RESPONSE_JSON_SCHEMA,
	type Speaker,
	type TurnMoment,
	type StudentQuestion,
	type TurnSoFar
} from './student-turn'

const STUDENT_TURN_MODEL = 'gemini-3.5-flash-lite'
const STUDENT_TURN_TEMPERATURE = 0.7

type NextQuestionInput = Parameters<typeof buildStudentTurnPrompt>[0] & {
	classId: string
	speaker: Speaker
	/** The speaker's question the person just dealt with, if any. */
	answered?: TurnSoFar
}

type Context = { feature: string; model: string; meta: { class_id: string } }

async function needsFollowUp(context: Context, turn: TurnSoFar): Promise<boolean> {
	const response = await generateContent(
		{ ...context, feature: 'student_follow_up' },
		{
			contents: buildFollowUpPrompt(turn),
			systemInstruction: FOLLOW_UP_INSTRUCTION,
			temperature: 0,
			responseMimeType: 'application/json',
			responseJsonSchema: FOLLOW_UP_RESPONSE_JSON_SCHEMA
		}
	)
	return parseFollowUp(response.text)
}

// A skip moves on: the teacher has said they don't know, and asking again would only press them.
async function momentFor(context: Context, answered?: TurnSoFar): Promise<TurnMoment> {
	if (!answered?.answer) return 'no_answer'
	return (await needsFollowUp(context, answered)) ? 'follow_up' : 'answered'
}

/** The speaker's next question, or null when the model has none. */
export async function nextQuestion(input: NextQuestionInput): Promise<StudentQuestion | null> {
	const { classId, speaker, answered } = input
	const context = {
		feature: 'student_turn',
		model: STUDENT_TURN_MODEL,
		meta: { class_id: classId }
	}
	try {
		const moment = await momentFor(context, answered)
		const response = await generateContent(context, {
			contents: buildStudentTurnPrompt(input, speaker, moment),
			systemInstruction: STUDENT_TURN_INSTRUCTION,
			temperature: STUDENT_TURN_TEMPERATURE,
			responseMimeType: 'application/json',
			responseJsonSchema: STUDENT_TURN_RESPONSE_JSON_SCHEMA
		})
		return parseStudentTurn(response.text, speaker.id)
	} catch (error) {
		throw toVideoError(error)
	}
}
