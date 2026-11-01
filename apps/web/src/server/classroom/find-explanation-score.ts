import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import type { KeyConcept } from '@/server/video/key-concepts'
import { toVideoError } from '@/server/video/read-video'
import type { TranscriptSegment } from '@/server/video/transcript'
import {
	buildScorePrompt,
	parseExplanationScore,
	SCORE_EXPLANATION_INSTRUCTION,
	scoreResponseJsonSchema,
	type ConceptResult
} from './score-explanation'

const SCORE_MODEL = 'gemini-3.5-flash-lite'
const SCORE_TEMPERATURE = 0

/**
 * Scores the explanation against the concepts already stored for this video.
 * An empty concept list is not sent to the model.
 */
export async function scoreExplanation(input: {
	topicId: string
	segments: TranscriptSegment[]
	concepts: KeyConcept[]
	explanation: string
}): Promise<ConceptResult[]> {
	const { topicId, segments, concepts, explanation } = input
	if (concepts.length === 0) return []
	const transcript = segments.map(({ text }) => text).join('\n')
	try {
		const response = await generateContent(
			{ feature: 'explanation_score', model: SCORE_MODEL, meta: { topic_id: topicId } },
			{
				contents: buildScorePrompt(explanation, concepts, transcript),
				systemInstruction: SCORE_EXPLANATION_INSTRUCTION,
				temperature: SCORE_TEMPERATURE,
				responseMimeType: 'application/json',
				responseJsonSchema: scoreResponseJsonSchema(concepts)
			}
		)
		return parseExplanationScore(response.text, concepts)
	} catch (error) {
		throw toVideoError(error)
	}
}
