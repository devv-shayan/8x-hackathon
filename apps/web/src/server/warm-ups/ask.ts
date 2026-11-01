import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import { toVideoError } from '@/server/video/read-video'
import {
	buildWarmUpJudgePrompt,
	buildWarmUpQuestionPrompt,
	parseWarmUpJudgment,
	parseWarmUpQuestion,
	WARM_UP_JUDGE_INSTRUCTION,
	WARM_UP_JUDGE_RESPONSE_JSON_SCHEMA,
	WARM_UP_QUESTION_INSTRUCTION,
	WARM_UP_QUESTION_RESPONSE_JSON_SCHEMA,
	warmUpReplyError,
	type WarmUpJudgeInput,
	type WarmUpQuestionInput
} from './turn'

const WARM_UP_MODEL = 'gemini-3.5-flash-lite'
const QUESTION_TEMPERATURE = 0.7
const JUDGE_TEMPERATURE = 0

const QUESTION_FAILED = "We couldn't think of a question. Try again."
const JUDGE_FAILED = "We couldn't judge that answer. Try again."

/** One in-character question about this gap. The transcript is the one already stored. */
export async function askWarmUpQuestion(
	input: WarmUpQuestionInput & { gapId: string }
): Promise<string> {
	const { gapId, ...prompt } = input
	try {
		const response = await generateContent(
			{ feature: 'warm_up_question', model: WARM_UP_MODEL, meta: { gap_id: gapId } },
			{
				contents: buildWarmUpQuestionPrompt(prompt),
				systemInstruction: WARM_UP_QUESTION_INSTRUCTION,
				temperature: QUESTION_TEMPERATURE,
				responseMimeType: 'application/json',
				responseJsonSchema: WARM_UP_QUESTION_RESPONSE_JSON_SCHEMA
			}
		)
		return parseWarmUpQuestion(response.text)
	} catch (error) {
		throw warmUpReplyError(error, QUESTION_FAILED) ?? toVideoError(error)
	}
}

/** Right or wrong, from the stored concept and transcript. */
export async function judgeWarmUp(input: WarmUpJudgeInput & { gapId: string }): Promise<boolean> {
	const { gapId, ...prompt } = input
	try {
		const response = await generateContent(
			{ feature: 'warm_up_judgment', model: WARM_UP_MODEL, meta: { gap_id: gapId } },
			{
				contents: buildWarmUpJudgePrompt(prompt),
				systemInstruction: WARM_UP_JUDGE_INSTRUCTION,
				temperature: JUDGE_TEMPERATURE,
				responseMimeType: 'application/json',
				responseJsonSchema: WARM_UP_JUDGE_RESPONSE_JSON_SCHEMA
			}
		)
		return parseWarmUpJudgment(response.text)
	} catch (error) {
		throw warmUpReplyError(error, JUDGE_FAILED) ?? toVideoError(error)
	}
}
