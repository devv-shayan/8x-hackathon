import { z } from 'zod'
import { ApiError } from '@/server/api/app-errors'
import type { TranscriptSegment } from './transcript'

// Key concepts are the checklist every later result is measured against, so a
// wrong one skews everything after it. The rules for accepting one live here,
// away from the model call in find-key-concepts.ts, so they
// can be tested without it.

const MIN_KEY_CONCEPTS = 3
export const MAX_KEY_CONCEPTS = 10

export const keyConceptSchema = z.object({
	title: z.string().min(1),
	quote: z.string().min(1),
	startSeconds: z.number().int().nonnegative()
})

export type KeyConcept = z.infer<typeof keyConceptSchema>

// The model picks the quote and code works out the timestamp from the
// transcript, so a timestamp can never disagree with the words it points at.
export const KEY_CONCEPTS_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: {
		concepts: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					title: { type: 'string' },
					quote: { type: 'string' }
				},
				required: ['title', 'quote']
			}
		}
	},
	required: ['concepts']
}

const keyConceptsResponseSchema = z.object({
	concepts: z.array(z.object({ title: z.string(), quote: z.string() }))
})

function toWords(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean)
}

/**
 * Where a quote starts in the transcript, or null if it isn't there. Compares
 * words, not characters, so a change in punctuation or capitals doesn't count
 * as a misquote, and a quote may run across segments.
 */
export function findQuoteStart(quote: string, segments: TranscriptSegment[]): number | null {
	const quoteWords = toWords(quote)
	if (quoteWords.length === 0) return null
	const transcript = segments.flatMap(({ startSeconds, text }) =>
		toWords(text).map((word) => ({ word, startSeconds }))
	)
	const lastStart = transcript.length - quoteWords.length
	for (let start = 0; start <= lastStart; start++) {
		if (quoteWords.every((word, offset) => transcript[start + offset]?.word === word)) {
			return transcript[start]?.startSeconds ?? null
		}
	}
	return null
}

export type ParsedKeyConcepts = {
	concepts: KeyConcept[]
	droppedCount: number
}

/**
 * Turns the model's raw reply into key concepts in video order, dropping any
 * whose quote isn't in the transcript. A malformed reply throws plainly; too
 * few surviving concepts is an ApiError, since the user can try another video.
 */
export function parseKeyConcepts(
	raw: string | undefined,
	segments: TranscriptSegment[]
): ParsedKeyConcepts {
	const { concepts } = keyConceptsResponseSchema.parse(JSON.parse(raw ?? ''))
	const seenQuotes = new Set<string>()
	const verified = concepts.flatMap(({ title, quote }) => {
		const key = toWords(quote).join(' ')
		const startSeconds = findQuoteStart(quote, segments)
		if (startSeconds === null || seenQuotes.has(key)) return []
		seenQuotes.add(key)
		return [{ title: title.trim(), quote: quote.trim(), startSeconds }]
	})

	if (verified.length < MIN_KEY_CONCEPTS) {
		throw new ApiError(
			'video_unreadable',
			"We couldn't find enough key ideas in this video. Try another one."
		)
	}
	return {
		concepts: [...verified]
			.sort((a, b) => a.startSeconds - b.startSeconds)
			.slice(0, MAX_KEY_CONCEPTS),
		droppedCount: concepts.length - verified.length
	}
}
