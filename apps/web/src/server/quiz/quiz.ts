import { z } from 'zod'
import {
	MAX_QUIZ_QUESTIONS,
	MIN_QUIZ_QUESTIONS,
	type QuizQuestion,
	type QuizQuestionType
} from '@app/contract'
import { conceptsStillInVideo, type KeyConcept } from '@/server/video/key-concepts'

// The daily quiz, without the model call (ask.ts). Code decides which ideas are asked and in
// which format, removes the blank from the stored quote, and shuffles the answers, so the
// model only writes words and can't make a blank that disagrees with its answer.

/** A longer line is too much to read as a fill-the-blank. */
const MAX_FILL_QUOTE_CHARS = 220
const MIN_BLANK_LETTERS = 3
const MAX_WORD_CHARS = 32
const MAX_ANSWER_CHARS = 90
const MAX_STATEMENT_CHARS = 170
const WRONG_OPTIONS = 3
const MAX_SHIMMER_WORDS = 14
const MAX_SHIMMER_CHARS = 24
/** Tries at an order with no type three times in a row, when a mix makes that possible. */
const ORDER_TRIES = 24

const QUESTION_TYPES: readonly QuizQuestionType[] = ['fill_blank', 'multiple_choice', 'true_false']

export type Random = () => number

export type QuizIdea = { topicTitle: string; concept: KeyConcept }

export type PlannedQuestion = {
	type: QuizQuestionType
	idea: QuizIdea
	/** For true_false: whether the statement should be true. Code decides, not the model. */
	isTrue: boolean
}

export function shuffled<T>(items: readonly T[], random: Random): T[] {
	const copy = [...items]
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		const swap = copy[i] as T
		copy[i] = copy[j] as T
		copy[j] = swap
	}
	return copy
}

function normalized(text: string): string {
	return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Every idea still in its video, once each, in random order. */
export function pickIdeas(
	topics: readonly { title: string; concepts: readonly KeyConcept[] }[],
	random: Random
): QuizIdea[] {
	const seen = new Set<string>()
	const ideas: QuizIdea[] = []
	for (const topic of topics) {
		for (const concept of conceptsStillInVideo([...topic.concepts])) {
			const key = normalized(concept.title)
			if (seen.has(key)) continue
			seen.add(key)
			ideas.push({ topicTitle: topic.title, concept })
		}
	}
	return shuffled(ideas, random)
}

function threeInARow(types: readonly QuizQuestionType[]): boolean {
	return types.some((type, i) => type === types[i + 1] && type === types[i + 2])
}

/**
 * Up to five questions, using every format, in random order. Fill-the-blank goes to ideas with
 * a short enough line; if there are none, those slots become multiple choice.
 */
export function planQuiz(ideas: readonly QuizIdea[], random: Random): PlannedQuestion[] {
	const picked = ideas.slice(0, MAX_QUIZ_QUESTIONS)
	const order = shuffled(QUESTION_TYPES, random)
	const types = picked.map((_, i) => order[i % order.length] as QuizQuestionType)
	const wantFill = types.filter((type) => type === 'fill_blank').length
	const others = types.filter((type) => type !== 'fill_blank')

	const short = picked.filter(({ concept }) => concept.quote.length <= MAX_FILL_QUOTE_CHARS)
	const forFill = short.slice(0, wantFill)
	const rest = picked.filter((idea) => !forFill.includes(idea))
	const restTypes = [...others, ...Array(wantFill - forFill.length).fill('multiple_choice')]

	const planned: PlannedQuestion[] = [
		...forFill.map((idea) => ({ type: 'fill_blank' as const, idea, isTrue: false })),
		...rest.map((idea, i) => ({
			type: restTypes[i] as QuizQuestionType,
			idea,
			isTrue: random() < 0.5
		}))
	]

	let best = shuffled(planned, random)
	for (let i = 0; i < ORDER_TRIES && threeInARow(best.map(({ type }) => type)); i++) {
		best = shuffled(planned, random)
	}
	return best
}

export const QUIZ_INSTRUCTION = [
	'You write quick quiz questions for someone who has taught these ideas from a video.',
	'Each item gives an idea, the line from the video, and what to write.',
	'Use only that line. Add no fact it does not contain.',
	'Plain words. No trick wording, no double negatives, nothing that needs the wording memorised.',
	'Wrong answers must tempt someone who half-remembers: real terms from the same subject as the line, never silly or unrelated, and still wrong according to the line.',
	'Reply with one entry per item, using its index.',
	'fill_blank: blank_word is one important word copied exactly from the line, and wrong_words are three other single words from the same subject that fit the sentence grammatically and could almost be right.',
	'multiple_choice: question is under 12 words, right_answer and three wrong_answers are each under 9 words and about the same length. Do not copy the line word for word.',
	'true_false: statement is under 18 words, in new words. A true one says what the line says. A false one is believable but the line contradicts it.'
].join(' ')

const STRING_LIST = { type: 'array', items: { type: 'string' } }

export const QUIZ_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: {
		items: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					index: { type: 'integer' },
					blank_word: { type: 'string' },
					wrong_words: STRING_LIST,
					question: { type: 'string' },
					right_answer: { type: 'string' },
					wrong_answers: STRING_LIST,
					statement: { type: 'string' }
				},
				required: ['index']
			}
		}
	},
	required: ['items']
}

function askFor(question: PlannedQuestion): string {
	if (question.type === 'fill_blank') return 'fill_blank'
	if (question.type === 'multiple_choice') return 'multiple_choice'
	return `true_false, and the statement must be ${question.isTrue ? 'TRUE' : 'FALSE'}`
}

export function buildQuizPrompt(planned: readonly PlannedQuestion[]): string {
	return planned
		.map(
			(question, index) =>
				`Item ${index}\nIdea: ${question.idea.concept.title}\nLine from the video: "${question.idea.concept.quote}"\nWrite: ${askFor(question)}`
		)
		.join('\n\n')
}

const replySchema = z.object({ items: z.array(z.unknown()) })
const indexSchema = z.object({ index: z.number().int().nonnegative() })
const fillSchema = z.object({
	blank_word: z.string(),
	wrong_words: z.array(z.string())
})
const choiceSchema = z.object({
	question: z.string(),
	right_answer: z.string(),
	wrong_answers: z.array(z.string())
})
const statementSchema = z.object({ statement: z.string() })

function usable(text: string, max: number): boolean {
	const trimmed = text.trim()
	return trimmed.length > 0 && trimmed.length <= max
}

/** `count` wrong answers, none the right one or each other. Null if there aren't enough. */
function wrongOptions(right: string, candidates: readonly string[], max: number): string[] | null {
	const seen = new Set([normalized(right)])
	const wrong: string[] = []
	for (const candidate of candidates) {
		const key = normalized(candidate)
		if (seen.has(key) || !usable(candidate, max)) continue
		seen.add(key)
		wrong.push(candidate.trim())
	}
	return wrong.length >= WRONG_OPTIONS ? wrong.slice(0, WRONG_OPTIONS) : null
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Finds a whole word in the line, keeping the line's own spelling. */
export function cutBlank(
	quote: string,
	word: string
): { before: string; answer: string; after: string } | null {
	const target = word.trim()
	if (target.length < MIN_BLANK_LETTERS || /\s/.test(target)) return null
	const match = new RegExp(
		`(?<![\\p{L}\\p{N}])${escapeRegExp(target)}(?![\\p{L}\\p{N}])`,
		'iu'
	).exec(quote)
	if (!match) return null
	return {
		before: quote.slice(0, match.index),
		answer: match[0],
		after: quote.slice(match.index + match[0].length)
	}
}

function withRightAnswer(right: string, wrong: readonly string[], random: Random) {
	const options = shuffled([right, ...wrong], random)
	return { options, right_index: options.indexOf(right) }
}

function assembleOne(
	planned: PlannedQuestion,
	index: number,
	item: unknown,
	random: Random
): QuizQuestion | null {
	const { concept, topicTitle } = planned.idea
	const shared = {
		id: String(index),
		topic_title: topicTitle,
		concept_title: concept.title,
		quote: concept.quote,
		start_seconds: concept.startSeconds
	}

	if (planned.type === 'fill_blank') {
		const reply = fillSchema.safeParse(item)
		if (!reply.success) return null
		const cut = cutBlank(concept.quote, reply.data.blank_word)
		if (!cut) return null
		const wrong = wrongOptions(cut.answer, reply.data.wrong_words, MAX_WORD_CHARS)
		if (!wrong) return null
		return {
			type: 'fill_blank',
			before: cut.before,
			after: cut.after,
			...shared,
			...withRightAnswer(cut.answer, wrong, random)
		}
	}

	if (planned.type === 'multiple_choice') {
		const reply = choiceSchema.safeParse(item)
		if (!reply.success) return null
		const { question, right_answer: right, wrong_answers: candidates } = reply.data
		if (!usable(question, MAX_STATEMENT_CHARS) || !usable(right, MAX_ANSWER_CHARS)) return null
		const wrong = wrongOptions(right, candidates, MAX_ANSWER_CHARS)
		if (!wrong) return null
		return {
			type: 'multiple_choice',
			question: question.trim(),
			...shared,
			...withRightAnswer(right.trim(), wrong, random)
		}
	}

	const reply = statementSchema.safeParse(item)
	if (!reply.success || !usable(reply.data.statement, MAX_STATEMENT_CHARS)) return null
	return {
		type: 'true_false',
		statement: reply.data.statement.trim(),
		...shared,
		options: ['True', 'False'],
		right_index: planned.isTrue ? 0 : 1
	}
}

/**
 * The quiz from the model's reply, in the planned order. An entry that doesn't hold up is
 * dropped, not repaired; a reply that isn't the JSON we asked for throws.
 */
export function assembleQuiz(
	planned: readonly PlannedQuestion[],
	raw: string | undefined,
	random: Random
): QuizQuestion[] {
	const { items } = replySchema.parse(JSON.parse(raw ?? ''))
	const byIndex = new Map<number, unknown>()
	for (const item of items) {
		const parsed = indexSchema.safeParse(item)
		if (parsed.success && !byIndex.has(parsed.data.index)) byIndex.set(parsed.data.index, item)
	}
	return planned.flatMap((question, index) => {
		const assembled = assembleOne(question, index, byIndex.get(index), random)
		return assembled ? [assembled] : []
	})
}

/** The person's own ideas, short enough to fill a line of the shimmering background. */
export function shimmerWords(ideas: readonly QuizIdea[]): string[] {
	return ideas
		.map(({ concept }) => concept.title.trim())
		.filter((title) => title.length <= MAX_SHIMMER_CHARS)
		.slice(0, MAX_SHIMMER_WORDS)
}

export function enoughForQuiz(count: number): boolean {
	return count >= MIN_QUIZ_QUESTIONS
}
