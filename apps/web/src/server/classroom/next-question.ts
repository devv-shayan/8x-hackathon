import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import { toVideoError } from '@/server/video/read-video'
import {
	buildFollowUpPrompt,
	buildStudentTurnPrompt,
	FOLLOW_UP_INSTRUCTION,
	FOLLOW_UP_RESPONSE_JSON_SCHEMA,
	otherStudent,
	parseFollowUp,
	parseStudentTurn,
	STUDENT_TURN_INSTRUCTION,
	STUDENT_TURN_RESPONSE_JSON_SCHEMA,
	studentWhoCanFollowUp,
	type StudentQuestion
} from './student-turn'

const STUDENT_TURN_MODEL = 'gemini-3.5-flash-lite'
const STUDENT_TURN_TEMPERATURE = 0.7

type NextQuestionInput = Parameters<typeof buildStudentTurnPrompt>[0] & { classId: string }

type Context = { feature: string; model: string; meta: { class_id: string } }

async function needsFollowUp(context: Context, input: NextQuestionInput): Promise<boolean> {
	const response = await generateContent(
		{ ...context, feature: 'student_follow_up' },
		{
			contents: buildFollowUpPrompt(input.turns),
			systemInstruction: FOLLOW_UP_INSTRUCTION,
			temperature: 0,
			responseMimeType: 'application/json',
			responseJsonSchema: FOLLOW_UP_RESPONSE_JSON_SCHEMA
		}
	)
	return parseFollowUp(response.text)
}

/** The next question from the class, or null when the model has none. */
export async function nextQuestion(input: NextQuestionInput): Promise<StudentQuestion | null> {
	const { classId, students, turns } = input
	const context = {
		feature: 'student_turn',
		model: STUDENT_TURN_MODEL,
		meta: { class_id: classId }
	}
	try {
		const follower = studentWhoCanFollowUp(students, turns)
		const followUp = follower !== null && (await needsFollowUp(context, input))
		const speaker = followUp && follower ? follower : otherStudent(students, turns)
		const response = await generateContent(context, {
			contents: buildStudentTurnPrompt(input, speaker, followUp),
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
