import { z } from 'zod'

// Scoring an explanation against the concepts already stored for the video.
// The model call lives in find-explanation-score.ts; the rules for accepting
// a judgment live here so they can be tested without it.

export const CONCEPT_RESULTS = ['correct', 'missed', 'wrong'] as const

export const conceptResultSchema = z.object({
	concept: z.string().min(1),
	/** From the first explanation alone. Gaps come from this. */
	result: z.enum(CONCEPT_RESULTS),
	/** Set when the class ends, counting what the person said while teaching. */
	resultAfterClass: z.enum(CONCEPT_RESULTS).optional()
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

export const SCORE_AFTER_CLASS_INSTRUCTION = [
	"You score what a teacher understands by the end of a class, against a video's key concepts.",
	"You get the teacher's first explanation, then their answers to students' questions.",
	'For every concept listed, set result to correct, missed, or wrong.',
	'correct: by the end, the teacher has stated that idea, even in different words.',
	'missed: the teacher never covers that idea.',
	'wrong: the last thing the teacher said about that idea contradicts it.',
	'A later correction replaces what they said earlier.',
	'Admitting a mistake, or saying they are unsure, does not count unless they also state the idea.',
	'Use only what the teacher said, the listed concepts, and the transcript.',
	'Do not add concepts. Copy each concept title exactly as given.'
].join(' ')

/** The titles are an enum because the model otherwise copies each concept's quote in with them. */
export function scoreResponseJsonSchema(concepts: StoredConcept[]) {
	return {
		type: 'object',
		properties: {
			results: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						concept: { type: 'string', enum: concepts.map(({ title }) => title) },
						result: { type: 'string', enum: [...CONCEPT_RESULTS] }
					},
					required: ['concept', 'result']
				}
			}
		},
		required: ['results']
	}
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
 * A malformed reply throws, and so does one that judges none of the stored concepts: that is
 * a failed scoring, not an explanation that missed everything.
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
	if (!concepts.some(({ title }) => judged.has(conceptKey(title)))) {
		throw new Error('The score matched none of the stored concepts.')
	}
	return concepts.map(({ title }) => ({
		concept: title,
		result: judged.get(conceptKey(title)) ?? 'missed'
	}))
}

/**
 * What the class should ask about: concepts the explanation missed or got wrong, or all of them
 * when it has no score.
 */
export function focusConceptLines(concepts: StoredConcept[], results: ConceptResult[]): string[] {
	const missedOrWrong = new Set(
		results.filter(({ result }) => result !== 'correct').map(({ concept }) => concept)
	)
	return concepts
		.filter(({ title }) => results.length === 0 || missedOrWrong.has(title))
		.map(({ title, quote }) => `${title}: "${quote}"`)
}

/** Teaching can only raise a result: being unsure in class isn't the same as being wrong. */
export function withResultsAfterClass(
	first: ConceptResult[],
	afterClass: ConceptResult[]
): ConceptResult[] {
	const fixed = new Set(
		afterClass.filter(({ result }) => result === 'correct').map(({ concept }) => concept)
	)
	return first.map((item) => ({
		...item,
		resultAfterClass: fixed.has(item.concept) ? 'correct' : item.result
	}))
}

export function parseStoredConceptResults(value: unknown): ConceptResult[] {
	return conceptResultsSchema.parse(value)
}

function buildConceptLines(concepts: StoredConcept[], transcript: string): string {
	const listed = concepts.map(({ title, quote }) => `${title}: "${quote}"`).join('\n')
	return `Key concepts:\n${listed}\n\nVideo transcript:\n${transcript}`
}

export function buildScorePrompt(
	explanation: string,
	concepts: StoredConcept[],
	transcript: string
): string {
	return [`What the teacher said:\n${explanation}`, buildConceptLines(concepts, transcript)].join(
		'\n\n'
	)
}

export type ClassAnswer = { question: string; answer: string }

export function buildAfterClassPrompt(
	explanation: string,
	answers: ClassAnswer[],
	concepts: StoredConcept[],
	transcript: string
): string {
	const said = answers.map(
		({ question, answer }) => `Asked: ${question}\nThe teacher said: ${answer}`
	)
	return [
		`What the teacher said first:\n${explanation}`,
		`What the teacher said in class, in order:\n${said.join('\n')}`,
		buildConceptLines(concepts, transcript)
	].join('\n\n')
}
