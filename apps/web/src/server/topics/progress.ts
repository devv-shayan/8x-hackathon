import type { TopicGap } from '@app/contract'
import type { ConceptResult } from '@/server/classroom/score-explanation'
import type { KeyConcept } from '@/server/video/key-concepts'

// One video's progress, from its latest finished class and its gaps: what Home's rows and the
// topic page show. Pure, so the counting is tested without a database.

export type StoredGap = {
	id: string
	concept: KeyConcept
	nextDueAt: Date
	closedAt: Date | null
}

export type Score = { correct: number; total: number }

const final = (item: ConceptResult) => item.resultAfterClass ?? item.result

/** The explanation's score, and the one after class when the class was scored again. */
export function scoresOf(results: readonly ConceptResult[]): {
	explanation: Score | null
	afterClass: Score | null
} {
	if (results.length === 0) return { explanation: null, afterClass: null }
	const total = results.length
	return {
		explanation: { correct: results.filter((r) => r.result === 'correct').length, total },
		afterClass: results.some((r) => r.resultAfterClass !== undefined)
			? { correct: results.filter((r) => final(r) === 'correct').length, total }
			: null
	}
}

/**
 * Open gaps first, soonest due first; then closed ones, most recently closed first. A gap from
 * an earlier class can be taught in the latest one: it stays open until warm-ups close it.
 */
export function topicGaps(
	gaps: readonly StoredGap[],
	results: readonly ConceptResult[]
): TopicGap[] {
	const taught = new Set(results.filter((r) => final(r) === 'correct').map((r) => r.concept))
	return [...gaps]
		.sort((a, b) => {
			if (!a.closedAt !== !b.closedAt) return a.closedAt ? 1 : -1
			if (a.closedAt && b.closedAt) return b.closedAt.getTime() - a.closedAt.getTime()
			return a.nextDueAt.getTime() - b.nextDueAt.getTime()
		})
		.map((gap) => ({
			id: gap.id,
			concept_title: gap.concept.title,
			start_seconds: gap.concept.startSeconds ?? null,
			closed: gap.closedAt !== null,
			next_due_at: gap.closedAt ? null : gap.nextDueAt.toISOString(),
			taught_last_class: taught.has(gap.concept.title)
		}))
}

/** Home's row for a video: ideas taught after its latest class, and its next warm-up. */
export function rowProgress(results: readonly ConceptResult[], gaps: readonly StoredGap[]) {
	const { explanation, afterClass } = scoresOf(results)
	const score = afterClass ?? explanation
	const open = gaps.filter((gap) => gap.closedAt === null)
	const next = open.reduce<Date | null>(
		(soonest, gap) => (!soonest || gap.nextDueAt < soonest ? gap.nextDueAt : soonest),
		null
	)
	return {
		...(score ? { idea_count: score.total, ideas_taught: score.correct } : {}),
		...(gaps.length > 0 ? { open_gaps: open.length } : {}),
		...(next ? { next_due_at: next.toISOString() } : {})
	}
}
