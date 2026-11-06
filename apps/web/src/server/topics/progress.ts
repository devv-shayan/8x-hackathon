import type { ProgressVideo, TopicGap } from '@app/contract'
import type { ConceptResult } from '@/server/classroom/score-explanation'
import { RIGHTS_TO_CLOSE } from '@/server/gaps/schedule'
import type { KeyConcept } from '@/server/video/key-concepts'

// One video's progress, from its latest finished class and its gaps: what Home's rows and the
// topic page show. Pure, so the counting is tested without a database.

export type StoredGap = {
	id: string
	concept: KeyConcept
	nextDueAt: Date
	closedAt: Date | null
	rightStreak: number
	/** Answered warm-ups, oldest first. */
	warmUps: {
		createdAt: Date
		studentName: string
		question: string
		answer: string | null
		isRight: boolean
	}[]
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
			quote: gap.concept.quote,
			right_streak: gap.rightStreak,
			rights_to_close: RIGHTS_TO_CLOSE,
			start_seconds: gap.concept.startSeconds ?? null,
			closed: gap.closedAt !== null,
			next_due_at: gap.closedAt ? null : gap.nextDueAt.toISOString(),
			taught_last_class: taught.has(gap.concept.title),
			warm_ups: gap.warmUps.map(({ createdAt, studentName, question, answer, isRight }) => ({
				asked_at: createdAt.toISOString(),
				student_name: studentName,
				question,
				answer,
				is_right: isRight
			}))
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

/**
 * A video's line on the dashboard, or null before a class on it has finished. An idea counts as
 * taught once the class ended with it right or warm-ups closed it, once either way. A gap closed
 * short of the right answers was marked "not in the video": that is not learning it.
 */
export function videoProgress(
	topic: { id: string; title: string; youtubeId: string },
	latest: { conceptResults: readonly ConceptResult[]; createdAt: Date } | undefined,
	gaps: readonly StoredGap[]
): ProgressVideo | null {
	const results = latest?.conceptResults ?? []
	if (!latest || results.length === 0) return null
	const learned = new Set(
		gaps
			.filter((gap) => gap.closedAt !== null && gap.rightStreak >= RIGHTS_TO_CLOSE)
			.map((gap) => gap.concept.title)
	)
	return {
		id: topic.id,
		title: topic.title,
		youtube_id: topic.youtubeId,
		idea_count: results.length,
		first_try: results.filter((r) => r.result === 'correct').length,
		taught: results.filter((r) => final(r) === 'correct' || learned.has(r.concept)).length,
		learned: results.filter((r) => learned.has(r.concept)).length,
		open_gaps: gaps.filter((gap) => gap.closedAt === null).length,
		taught_at: latest.createdAt.toISOString()
	}
}

const share = (video: ProgressVideo) => video.taught / video.idea_count

/** Best first; between equal shares, the video with more ideas. */
export function byStrength(a: ProgressVideo, b: ProgressVideo) {
	return share(b) - share(a) || b.idea_count - a.idea_count
}
