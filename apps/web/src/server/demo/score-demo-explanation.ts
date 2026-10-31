import 'server-only'
import type { ConceptResult } from '@/server/classroom/score-explanation'

type Concept = { title: string }

/**
 * Deterministic scoring for the local skip-auth demo. Gemini TLS from this machine is flaky,
 * and the demo still needs a mixed correct / missed / wrong assessment to walk through.
 */
export function scoreDemoExplanation(
	explanation: string,
	concepts: Concept[]
): ConceptResult[] {
	const text = explanation.toLowerCase()
	return concepts.map(({ title }) => ({
		concept: title,
		result: judge(title.toLowerCase(), text)
	}))
}

function judge(title: string, text: string): ConceptResult['result'] {
	if (title === 'photosynthesis') {
		return /photosynthesis|make (their own )?food/.test(text) ? 'correct' : 'missed'
	}
	if (title === 'chlorophyll') {
		return /chlorophyll/.test(text) ? 'correct' : 'missed'
	}
	if (title === 'raw materials') {
		return /carbon dioxide|from the (air|roots)|water from/.test(text) ? 'correct' : 'missed'
	}
	if (title === 'oxygen and sugar') {
		if (/uses up oxygen|does not store|don't store|no sugar/.test(text)) return 'wrong'
		if (/releases oxygen|stores energy as sugar|store[s]? .*sugar/.test(text)) return 'correct'
		return 'missed'
	}
	if (title === 'working memory') {
		return /working memory|mental workspace/.test(text) ? 'correct' : 'missed'
	}
	if (title === 'limited capacity') {
		return /four chunks|only about four|limited/.test(text) ? 'correct' : 'missed'
	}
	if (title === 'attention gate') {
		if (/attention does not|attention never/.test(text)) return 'wrong'
		return /attention (decides|gate)|enters working memory/.test(text) ? 'correct' : 'missed'
	}
	if (title === 'chunking') {
		return /chunking|chunk/.test(text) ? 'correct' : 'missed'
	}
	const token = title.split(/\s+/)[0] ?? title
	return text.includes(token) ? 'correct' : 'missed'
}

/** First-hand questions for the demo class — no Gemini call. */
export function demoStudentQuestion(input: {
	studentName: string
	knowsSource: boolean
	focusConcepts: string[]
	turnIndex: number
}): string {
	const focus = input.focusConcepts[input.turnIndex % Math.max(input.focusConcepts.length, 1)]
	// focusConceptLines is `Title: "quote"` — the spoken question only needs the title.
	const topic = (focus?.split(':')[0] ?? 'that idea').trim()
	if (input.knowsSource) {
		return `You left out ${topic}. How does that part fit with what you said?`
	}
	return `How does ${topic} work in what you just explained?`
}
