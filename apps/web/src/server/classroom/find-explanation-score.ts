import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import type { KeyConcept } from '@/server/video/key-concepts'
import { AI_BUSY, toVideoError } from '@/server/video/read-video'
import type { TranscriptSegment } from '@/server/video/transcript'
import {
	buildAfterClassPrompt,
	buildScorePrompt,
	parseExplanationScore,
	SCORE_AFTER_CLASS_INSTRUCTION,
	SCORE_EXPLANATION_INSTRUCTION,
	scoreResponseJsonSchema,
	type ClassAnswer,
	type ConceptResult
} from './score-explanation'

const SCORE_MODEL = 'gemini-3.5-flash-lite'
const SCORE_TEMPERATURE = 0

type ScoreInput = {
	topicId: string
	segments: TranscriptSegment[]
	concepts: KeyConcept[]
	explanation: string
}

function transcriptOf(segments: TranscriptSegment[]): string {
	return segments.map(({ text }) => text).join('\n')
}

async function score(
	feature: string,
	topicId: string,
	concepts: KeyConcept[],
	contents: string,
	systemInstruction: string
): Promise<ConceptResult[]> {
	try {
		const response = await generateContent(
			{ feature, model: SCORE_MODEL, meta: { topic_id: topicId } },
			{
				contents,
				systemInstruction,
				temperature: SCORE_TEMPERATURE,
				responseMimeType: 'application/json',
				responseJsonSchema: scoreResponseJsonSchema(concepts)
			}
		)
		return parseExplanationScore(response.text, concepts)
	} catch (error) {
		throw toVideoError(error, AI_BUSY)
	}
}

/**
 * Scores the explanation against the concepts already stored for this video.
 * An empty concept list is not sent to the model.
 */
export async function scoreExplanation(input: ScoreInput): Promise<ConceptResult[]> {
	const { topicId, segments, concepts, explanation } = input
	if (concepts.length === 0) return []
	return score(
		'explanation_score',
		topicId,
		concepts,
		buildScorePrompt(explanation, concepts, transcriptOf(segments)),
		SCORE_EXPLANATION_INSTRUCTION
	)
}

/** Scores the same concepts again once the class ends, counting what the person said in it. */
export async function scoreAfterClass(
	input: ScoreInput & { answers: ClassAnswer[] }
): Promise<ConceptResult[]> {
	const { topicId, segments, concepts, explanation, answers } = input
	if (concepts.length === 0) return []
	return score(
		'explanation_score_after_class',
		topicId,
		concepts,
		buildAfterClassPrompt(explanation, answers, concepts, transcriptOf(segments)),
		SCORE_AFTER_CLASS_INSTRUCTION
	)
}
