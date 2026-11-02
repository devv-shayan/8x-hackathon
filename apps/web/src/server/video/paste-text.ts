import { createHash } from 'node:crypto'
import { PASTE_TOPIC_PREFIX } from '@app/contract'
import { ApiError } from '@/server/api/app-errors'
import type { KeyConcept } from './key-concepts'
import type { TranscriptSegment } from './transcript'

// Shorter than this and there isn't enough to find a few ideas.
const MIN_PASTE_CHARS = 80
const TITLE_CHARS = 80
const DEMO_CONCEPTS = 4

/** Stable id for this text. The same paste from the same person is one topic. */
export function pasteTopicId(text: string): string {
	const hash = createHash('sha256').update(text.trim()).digest('hex').slice(0, 20)
	return `${PASTE_TOPIC_PREFIX}${hash}`
}

/** Paragraphs when there are a few, otherwise sentences, so quotes can be found. */
export function segmentsFromPaste(text: string): TranscriptSegment[] {
	const trimmed = text.trim()
	const paragraphs = trimmed
		.split(/\n\s*\n/)
		.map((part) => part.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
	const pieces =
		paragraphs.length >= 3
			? paragraphs
			: trimmed
					.split(/(?<=[.!?])\s+/)
					.map((part) => part.trim())
					.filter(Boolean)
	const segments = pieces.length > 0 ? pieces : [trimmed]
	return segments.map((part) => ({ startSeconds: 0, text: part }))
}

export function titleFromPaste(text: string): string {
	const first = text.trim().split('\n')[0]?.replace(/\s+/g, ' ').trim() ?? ''
	return first.slice(0, TITLE_CHARS) || 'Pasted notes'
}

export function assertPasteLength(text: string): void {
	if (text.trim().length < MIN_PASTE_CHARS) {
		throw new ApiError(
			'video_unreadable',
			'Paste a bit more of the text so we can find a few ideas.'
		)
	}
}

/** Local demo only: a few ideas taken from the text, with no video time. */
export function demoConceptsFromPaste(segments: TranscriptSegment[]): KeyConcept[] {
	const concepts = segments.slice(0, DEMO_CONCEPTS).flatMap((segment) => {
		const words = segment.text.split(/\s+/).filter(Boolean)
		if (words.length < 4) return []
		return [
			{
				title: words.slice(0, 3).join(' '),
				quote: words.slice(0, Math.min(12, words.length)).join(' '),
				startSeconds: null
			}
		]
	})
	if (concepts.length < 3) {
		throw new ApiError(
			'video_unreadable',
			"We couldn't find enough key ideas in this text. Paste a bit more."
		)
	}
	return concepts
}
