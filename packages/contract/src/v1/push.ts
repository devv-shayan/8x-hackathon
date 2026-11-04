import { z } from 'zod'

/** Expo's push token, either spelling. */
export const expoPushTokenSchema = z
	.string()
	.max(200)
	.regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/)

export const registerPushTokenBody = z.object({
	token: expoPushTokenSchema,
	platform: z.enum(['ios', 'android'])
})

export const registerPushTokenResponse = z.object({
	ok: z.literal(true)
})
