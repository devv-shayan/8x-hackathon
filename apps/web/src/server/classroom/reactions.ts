import { z } from 'zod'

// Short in-character lines after a class. Pure parse/prompt rules so they can
// be tested without Gemini; the model call lives in find-reactions.ts.

export type ReactionStudent = { id: string; name: string; persona: string }

export type ReactionTurn = {
	studentId: string
	question: string
	answer: string | null
	outcome: 'answered' | 'needed_help' | 'skipped' | null
}

export type StoredReaction = { studentId: string; text: string }

const MAX_REACTION_CHARS = 160

export const REACTION_INSTRUCTION = [
	'You write short closing lines from students after a class.',
	'Each student who spoke gets one line, in their own voice, about how the class went for them.',
	'One short spoken sentence each. No scores, grades, or "correct/wrong".',
	'Do not invent students. Copy each student_id exactly as given.',
	'Stay kind and specific to what happened; never lecture the teacher.'
].join(' ')

export const REACTION_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: {
		reactions: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					student_id: { type: 'string' },
					text: { type: 'string' }
				},
				required: ['student_id', 'text']
			}
		}
	},
	required: ['reactions']
}

const replySchema = z.object({
	reactions: z.array(
		z.object({
			student_id: z.string(),
			text: z.string()
		})
	)
})

export function buildReactionPrompt(input: {
	students: ReactionStudent[]
	turns: ReactionTurn[]
}): string {
	const roster = input.students
		.map(({ id, name, persona }) => `- ${name} (${id}): ${persona}`)
		.join('\n')
	const classLog = input.turns
		.map(({ studentId, question, answer, outcome }) => {
			const who = input.students.find((s) => s.id === studentId)?.name ?? studentId
			const end = outcome === 'skipped' ? 'skipped' : (answer ?? '')
			return `${who} asked: ${question}\nTeacher (${outcome ?? 'open'}): ${end}`
		})
		.join('\n\n')
	return [
		'Students in this class:',
		roster,
		'',
		'What happened:',
		classLog || '(no questions were answered)',
		'',
		'Write one reaction per student listed above.'
	].join('\n')
}

/**
 * One reaction per known student. Unknown student_ids are dropped; a student
 * the model skips gets nothing. Empty or malformed replies throw.
 */
export function parseReactions(
	raw: string | undefined,
	students: ReactionStudent[]
): StoredReaction[] {
	if (!raw?.trim()) throw new Error('empty reaction reply')
	const parsed = replySchema.parse(JSON.parse(raw))
	const byId = new Map(students.map((s) => [s.id, s]))
	const seen = new Set<string>()
	const out: StoredReaction[] = []
	for (const row of parsed.reactions) {
		if (!byId.has(row.student_id) || seen.has(row.student_id)) continue
		const text = row.text.trim().slice(0, MAX_REACTION_CHARS)
		if (!text) continue
		seen.add(row.student_id)
		out.push({ studentId: row.student_id, text })
	}
	if (out.length === 0) throw new Error('no usable reactions')
	return out
}

const storedReactionSchema = z.object({
	studentId: z.string().uuid(),
	text: z.string().min(1)
})

/** What Class.reactions holds. A bad row is an error, never a partial list. */
export function parseStoredReactions(value: unknown): StoredReaction[] | null {
	if (value == null) return null
	return z.array(storedReactionSchema).parse(value)
}
