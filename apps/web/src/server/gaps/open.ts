import type { ConceptResult } from '@/server/classroom/score-explanation'
import type { KeyConcept } from '@/server/video/key-concepts'

function conceptKey(title: string): string {
	return title.trim().toLowerCase()
}

/**
 * Missed or wrong concepts that do not already have an open gap.
 * A correct concept opens nothing, and an open gap keeps its schedule.
 */
export function conceptsNeedingGaps(input: {
	concepts: readonly KeyConcept[]
	results: readonly ConceptResult[]
	openTitles: readonly string[]
}): KeyConcept[] {
	const open = new Set(input.openTitles.map(conceptKey))
	const missedOrWrong = new Set(
		input.results
			.filter(({ result }) => result !== 'correct')
			.map(({ concept }) => conceptKey(concept))
	)
	return input.concepts.filter(
		(concept) =>
			missedOrWrong.has(conceptKey(concept.title)) && !open.has(conceptKey(concept.title))
	)
}
