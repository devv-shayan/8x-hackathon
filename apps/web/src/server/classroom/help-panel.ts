import { z } from 'zod'
import type { TranscriptSegment } from '@/server/video/transcript'

// The private help behind "I'll be back": a short explanation from the video for a question the
// person can't answer. Nothing here calls anything; help.ts sends this to the model.

const NO_SEGMENT = -1

export const HELP_INSTRUCTION = [
	'A person is teaching a class and a student asked something they cannot answer. Help them privately.',
	'Explain the answer in two or three short plain sentences, using only the numbered video transcript.',
	'If it does not answer the question exactly, explain the closest thing it does say, and say what it leaves out.',
	'Do not use anything from outside the transcript. Only if nothing in it relates to the question, say the video does not cover this.',
	'Call it the video, never the transcript.',
	`Set segment to the number of the segment that best answers it, or ${NO_SEGMENT} if none does.`
].join(' ')

export const HELP_RESPONSE_JSON_SCHEMA = {
	type: 'object',
	properties: { explanation: { type: 'string' }, segment: { type: 'integer' } },
	required: ['explanation', 'segment']
}

const helpSchema = z.object({ explanation: z.string(), segment: z.number() })

export type Help = { explanation: string; startSeconds: number | null }

export function buildHelpPrompt(segments: TranscriptSegment[], question: string): string {
	const lines = segments.map(({ text }, index) => `${index}: ${text}`)
	return `The student asked: ${question}\n\nVideo transcript:\n${lines.join('\n')}`
}

/** The time comes from the transcript, so the model can't make one up. */
export function parseHelp(raw: string | undefined, segments: TranscriptSegment[]): Help {
	const { explanation, segment } = helpSchema.parse(JSON.parse(raw ?? ''))
	return { explanation: explanation.trim(), startSeconds: segments[segment]?.startSeconds ?? null }
}
