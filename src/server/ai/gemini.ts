import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { trackAiCall } from '@/server/lib/ai-usage/sink'
import type { TrackedModel } from '@/server/lib/ai-usage/models'
import type { AiUsageMeta } from '@/server/lib/ai-usage/track'

// Google Gemini wrapper — the only file allowed to import `@google/genai`.
// Feature code calls this module; it never imports the SDK and never sees
// `trackAiCall`. See docs/rules/ai-usage.md for the layering this follows.

const ai = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
})

export type AiContext = {
	feature: string
	model: TrackedModel
	meta?: AiUsageMeta
}

type GenerateParams = {
	contents: string | Array<{ role: string; parts: Array<{ text: string }> }>
	systemInstruction?: string
	temperature?: number
	maxOutputTokens?: number
}

/**
 * A tracked `models.generateContent`. Returns the SDK response untouched and
 * rethrows its errors untouched.
 *
 * ```ts
 * const response = await generateContent(
 *   { feature: 'key_concepts', model: 'gemini-3.5-flash' },
 *   { contents: prompt }
 * )
 * ```
 */
export function generateContent(context: AiContext, params: GenerateParams) {
	return trackAiCall({ provider: 'google', ...context }, () =>
		ai.models.generateContent({
			model: context.model,
			contents: params.contents,
			config: {
				systemInstruction: params.systemInstruction,
				temperature: params.temperature,
				maxOutputTokens: params.maxOutputTokens
			}
		})
	)
}
