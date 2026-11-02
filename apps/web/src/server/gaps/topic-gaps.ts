import type { TopicGaps } from '@app/contract'
import { keyConceptSchema } from '@/server/video/key-concepts'

type WarmUpRow = {
	id: string
	question: string
	answer: string | null
	isRight: boolean | null
	createdAt: Date
	student: { name: string }
}

export type TopicGapRow = {
	id: string
	concept: unknown
	rightStreak: number
	nextDueAt: Date
	closedAt: Date | null
	warmUps: WarmUpRow[]
}

/** The gaps response for one of the person's topics. No transcript. */
export function toTopicGaps(title: string, rows: TopicGapRow[]): TopicGaps {
	const gaps = rows.map((row) => {
		const concept = keyConceptSchema.parse(row.concept)
		return {
			id: row.id,
			concept_title: concept.title,
			quote: concept.quote,
			start_seconds: concept.startSeconds,
			right_streak: row.rightStreak,
			next_due_at: row.nextDueAt.toISOString(),
			closed_at: row.closedAt?.toISOString() ?? null,
			warm_ups: row.warmUps.map((warmUp) => ({
				id: warmUp.id,
				student_name: warmUp.student.name,
				question: warmUp.question,
				answer: warmUp.answer,
				is_right: warmUp.isRight,
				created_at: warmUp.createdAt.toISOString()
			}))
		}
	})
	const closed = gaps.filter((gap) => gap.closed_at !== null).length
	return {
		title,
		open_count: gaps.length - closed,
		closed_count: closed,
		gaps
	}
}
