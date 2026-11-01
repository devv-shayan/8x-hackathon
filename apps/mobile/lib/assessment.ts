import type { ConceptResult } from '@app/contract'

export function finalResult({ result, result_after_class }: ConceptResult) {
	return result_after_class ?? result
}

/** What the results screen shows: the first score, where the class left it, and what changed. */
export function summarizeResults(results: ConceptResult[]) {
	const correct = results.filter(({ result }) => result === 'correct').length
	const finalCorrect = results.filter((item) => finalResult(item) === 'correct').length
	return {
		correct,
		finalCorrect,
		scoredAfterClass: results.some(({ result_after_class }) => result_after_class !== null),
		fixed: results.filter((item) => item.result !== 'correct' && finalResult(item) === 'correct'),
		gaps: results.filter((item) => finalResult(item) !== 'correct')
	}
}
