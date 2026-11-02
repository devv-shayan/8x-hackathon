import type { DueWarmUp } from '@app/contract'
import type { DueGapRecord } from '@/server/db/warm-ups'

/**
 * A due gap as the app sees it. `studentName` is who asks: the student of the question
 * already saved, or else the one who will be picked when the warm-up starts, so Home can say
 * who has a question before it's written.
 */
export function toDueWarmUp(gap: DueGapRecord, studentName: string): DueWarmUp {
	return {
		gap_id: gap.id,
		topic_title: gap.topicTitle,
		concept_title: gap.concept.title,
		start_seconds: gap.concept.startSeconds ?? 0,
		has_timestamp: gap.concept.startSeconds != null,
		student_name: gap.openWarmUp?.studentName ?? studentName,
		open_warm_up: gap.openWarmUp
			? {
					id: gap.openWarmUp.id,
					question: gap.openWarmUp.question,
					student_name: gap.openWarmUp.studentName
				}
			: null
	}
}
