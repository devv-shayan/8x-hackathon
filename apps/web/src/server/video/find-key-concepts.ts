import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import {
	KEY_CONCEPTS_RESPONSE_JSON_SCHEMA,
	MAX_KEY_CONCEPTS,
	parseKeyConcepts,
	type ParsedKeyConcepts
} from './key-concepts'
import type { TranscriptSegment } from './transcript'
import { toVideoError } from './read-video'

const KEY_CONCEPTS_MODEL = 'gemini-3.5-flash-lite'
const MIN_REQUESTED_CONCEPTS = 5

const KEY_CONCEPTS_INSTRUCTION = [
	'You read the transcript of an educational video and pick the ideas someone must be able to explain to show they understood it.',
	`Pick ${MIN_REQUESTED_CONCEPTS} to ${MAX_KEY_CONCEPTS} key concepts, in the order the video covers them.`,
	'Use only what the transcript says. Do not add outside knowledge.',
	'Skip jokes, asides, greetings, sponsors and requests to subscribe.',
	'Give each concept a short title.',
	'Give each concept one quote: 8 to 25 consecutive words copied exactly from the transcript, the place where the video states that idea. Never paraphrase, shorten or join separate sentences.'
].join(' ')

/**
 * Finds the key concepts in a stored transcript. Works from the transcript
 * alone, never the video, and every concept it returns has a quote the code
 * has found in that transcript.
 */
export async function findKeyConcepts(
	videoId: string,
	segments: TranscriptSegment[]
): Promise<ParsedKeyConcepts> {
	const transcript = segments.map(({ text }) => text).join('\n')
	try {
		const response = await generateContent(
			{ feature: 'key_concepts', model: KEY_CONCEPTS_MODEL, meta: { video_id: videoId } },
			{
				contents: transcript,
				systemInstruction: KEY_CONCEPTS_INSTRUCTION,
				temperature: 0,
				responseMimeType: 'application/json',
				responseJsonSchema: KEY_CONCEPTS_RESPONSE_JSON_SCHEMA
			}
		)
		return parseKeyConcepts(response.text, segments)
	} catch (error) {
		throw toVideoError(error)
	}
}
