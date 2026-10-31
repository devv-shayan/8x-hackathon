import { z } from 'zod'

// Scoring an explanation against the concepts already stored for the video.
// The model call lives in find-explanation-score.ts; the rules for accepting
// a judgment live here so they can be tested without it.

export const CONCEPT_RESULTS = ['correct', 'missed', 'wrong'] as const

export const conceptResultSchema = z.object({
	concept: z.string().min(1),
	result: z.enum(CONCEPT_RESULTS)
})

export type ConceptResult = z.infer<typeof conceptResultSchema>

const conceptResultsSchema = z.array(conceptResultSchema)

export const SCORE_EXPLANATION_INSTRUCTION = [
	"You score a teacher's explanation of a video against its key concepts.",
	'For every concept listed, set result to correct, missed, or wrong.',
	'correct: the explanation states that idea, even in different words.',
	'missed: the explanation never covers that idea.',
	'wrong: the explanation contradicts that idea.',
	'Use only the explanation, the listed concepts, and the transcript.',
	'Do not add concepts. Copy each concept title exactly as given.'
].join(' ')

export const SCORE_EXPLANATION_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: {
		results: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					concept: { type: 'string' },
					result: { type: 'string', enum: [...CONCEPT_RESULTS] }
				},
				required: ['concept', 'result']
			}
		}
	},
	required: ['results']
}

const scoreResponseSchema = z.object({
	results: z.array(z.object({ concept: z.string(), result: z.string() }))
})

type StoredConcept = { title: string; quote: string }

function conceptKey(title: string): string {
	return title.trim().toLowerCase()
}

/**
 * One result for each stored concept. A concept the model invents is dropped.
 * A stored concept it skips, or labels with something other than correct,
 * missed, or wrong, counts as missed: the class should still ask about it.
 * A malformed reply throws.
 */
export function parseExplanationScore(
	raw: string | undefined,
	concepts: StoredConcept[]
): ConceptResult[] {
	const { results } = scoreResponseSchema.parse(JSON.parse(raw ?? ''))
	const judged = new Map<string, ConceptResult['result']>()
	for (const { concept, result } of results) {
		const key = conceptKey(concept)
		if (key.length === 0 || judged.has(key)) continue
		const parsed = z.enum(CONCEPT_RESULTS).safeParse(result)
		if (parsed.success) judged.set(key, parsed.data)
	}
	return concepts.map(({ title }) => ({
		concept: title,
		result: judged.get(conceptKey(title)) ?? 'missed'
	}))
}

/** What the class should ask about: concepts the explanation missed or got wrong. */
export function focusConceptLines(concepts: StoredConcept[], results: ConceptResult[]): string[] {
	const missedOrWrong = new Set(
		results.filter(({ result }) => result !== 'correct').map(({ concept }) => concept)
	)
	return concepts
		.filter(({ title }) => missedOrWrong.has(title))
		.map(({ title, quote }) => `${title}: "${quote}"`)
}

export function parseStoredConceptResults(value: unknown): ConceptResult[] {
	return conceptResultsSchema.parse(value)
}

export function buildScorePrompt(
	explanation: string,
	concepts: StoredConcept[],
	transcript: string
): string {
	const listed = concepts.map(({ title, quote }) => `${title}: "${quote}"`).join('\n')
	return [
		`What the teacher said:\n${explanation}`,
		`Key concepts:\n${listed}`,
		`Video transcript:\n${transcript}`
	].join('\n\n')
}
