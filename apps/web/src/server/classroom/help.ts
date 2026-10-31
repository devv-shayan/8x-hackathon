import 'server-only'
import { generateContent } from '@/server/ai/gemini'
import { toVideoError } from '@/server/video/read-video'
import type { TranscriptSegment } from '@/server/video/transcript'
import {
	buildHelpPrompt,
	HELP_INSTRUCTION,
	HELP_RESPONSE_JSON_SCHEMA,
	parseHelp,
	type Help
} from './help-panel'

const HELP_MODEL = 'gemini-3.5-flash-lite'
const HELP_TEMPERATURE = 0.2

/** Explains a student's question from the video, for the person's eyes only. */
export async function explainFromVideo(
	classId: string,
	segments: TranscriptSegment[],
	question: string
): Promise<Help> {
	try {
		const response = await generateContent(
			{ feature: 'class_help', model: HELP_MODEL, meta: { class_id: classId } },
			{
				contents: buildHelpPrompt(segments, question),
				systemInstruction: HELP_INSTRUCTION,
				temperature: HELP_TEMPERATURE,
				responseMimeType: 'application/json',
				responseJsonSchema: HELP_RESPONSE_JSON_SCHEMA
			}
		)
		return parseHelp(response.text, segments)
	} catch (error) {
		throw toVideoError(error)
	}
}
