import 'server-only'
import { setTimeout } from 'node:timers/promises'
import { GoogleGenAI, type ContentListUnion, type GenerateContentParameters } from '@google/genai'
import { z } from 'zod'
import { ApiError } from '@/server/api/app-errors'
import { log } from '@/server/lib/logger'

// Google Gemini wrapper: the only file that imports `@google/genai`. Feature
// code calls this module, and every call logs what it used.

export type AiContext = {
	/** What the spend is for, like `key_concepts`. */
	feature: string
	model: string
	/** Ids, enums and booleans only: never prompt or completion text. */
	meta?: Record<string, string | number | boolean>
}

type GenerateParams = {
	contents: ContentListUnion
	systemInstruction?: string
	temperature?: number
	responseMimeType?: string
	responseJsonSchema?: unknown
}

const BUSY_STATUSES = [429, 503]
const BUSY_RETRY_DELAY_MS = 2000

let client: GoogleGenAI | undefined

// Built on first use, so the app boots without a key and only this feature
// answers 503.
function getClient(): GoogleGenAI {
	const apiKey = process.env.GEMINI_API_KEY
	if (!apiKey) throw new ApiError('not_configured', "Reading videos isn't set up yet.")
	client ??= new GoogleGenAI({ apiKey })
	return client
}

/** Whether Gemini turned a call away for load, which a later try can get past. */
export function isGeminiBusy(error: unknown): boolean {
	const status = z.object({ status: z.number() }).safeParse(error).data?.status
	return status !== undefined && BUSY_STATUSES.includes(status)
}

async function generateWithOneRetry(request: GenerateContentParameters) {
	try {
		return await getClient().models.generateContent(request)
	} catch (error) {
		if (!isGeminiBusy(error)) throw error
		await setTimeout(BUSY_RETRY_DELAY_MS)
		return getClient().models.generateContent(request)
	}
}

/**
 * A logged `models.generateContent`, tried once more if Gemini is busy. Returns the SDK's
 * response and rethrows its errors.
 */
export async function generateContent(context: AiContext, params: GenerateParams) {
	const startedAt = Date.now()
	const { model, feature, meta } = context
	const { contents, ...config } = params
	const response = await generateWithOneRetry({ model, contents, config })
	log.info('ai call', {
		source: 'ai/gemini',
		feature,
		model,
		...meta,
		latency_ms: Date.now() - startedAt,
		input_tokens: response.usageMetadata?.promptTokenCount,
		output_tokens: response.usageMetadata?.candidatesTokenCount,
		thought_tokens: response.usageMetadata?.thoughtsTokenCount
	})
	return response
}
