import type { ConceptResult } from '@app/contract'
import { summarizeResults } from '../lib/assessment'

function concept(
	name: string,
	result: ConceptResult['result'],
	resultAfterClass: ConceptResult['result'] | null
): ConceptResult {
	return {
		concept: name,
		result,
		result_after_class: resultAfterClass,
		start_seconds: 10,
		quote: `${name} quote`
	}
}

const names = (items: ConceptResult[]) => items.map(({ concept: name }) => name)

describe('summarizeResults', () => {
	it('counts both scores and splits what was fixed from what is left', () => {
		const summary = summarizeResults([
			concept('Kept', 'correct', 'correct'),
			concept('Corrected', 'wrong', 'correct'),
			concept('Filled in', 'missed', 'correct'),
			concept('Left out', 'missed', 'missed'),
			concept('Still wrong', 'wrong', 'wrong')
		])
		expect(summary.correct).toBe(1)
		expect(summary.finalCorrect).toBe(3)
		expect(summary.scoredAfterClass).toBe(true)
		expect(names(summary.fixed)).toEqual(['Corrected', 'Filled in'])
		expect(names(summary.gaps)).toEqual(['Left out', 'Still wrong'])
	})

	it('falls back to the first score when the class was not scored', () => {
		const summary = summarizeResults([
			concept('Kept', 'correct', null),
			concept('Left out', 'missed', null)
		])
		expect(summary.scoredAfterClass).toBe(false)
		expect(summary.finalCorrect).toBe(1)
		expect(summary.fixed).toEqual([])
		expect(names(summary.gaps)).toEqual(['Left out'])
	})
})
