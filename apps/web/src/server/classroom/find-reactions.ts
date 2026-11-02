import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import { toVideoError } from '@/server/video/read-video'
import {
	buildReactionPrompt,
	parseReactions,
	REACTION_INSTRUCTION,
	REACTION_RESPONSE_JSON_SCHEMA,
	type ReactionStudent,
	type ReactionTurn,
	type StoredReaction
} from './reactions'

const REACTION_MODEL = 'gemini-3.5-flash-lite'
const REACTION_TEMPERATURE = 0.7

/** Best-effort closing lines. The caller catches failures so results still show. */
export async function findStudentReactions(input: {
	classId: string
	students: ReactionStudent[]
	turns: ReactionTurn[]
}): Promise<StoredReaction[]> {
	try {
		const response = await generateContent(
			{ feature: 'class_reactions', model: REACTION_MODEL, meta: { class_id: input.classId } },
			{
				contents: buildReactionPrompt(input),
				systemInstruction: REACTION_INSTRUCTION,
				temperature: REACTION_TEMPERATURE,
				responseMimeType: 'application/json',
				responseJsonSchema: REACTION_RESPONSE_JSON_SCHEMA
			}
		)
		return parseReactions(response.text, input.students)
	} catch (error) {
		throw toVideoError(error)
	}
}
