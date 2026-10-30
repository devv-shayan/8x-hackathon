import { z } from 'zod'
import { isoDateTime, uuid } from './common'
import { avatarPathSchema } from './uploads'

// GET and PATCH /api/app/v1/profile: the signed-in person's own profile.
//
// `plan` is read-only here, and so is everything that decides it. plan_type,
// premium_*, is_admin and region are written by server code only (AGENTS.md,
// non-negotiable 3); no field in the PATCH body reaches them.

export const PLANS = ['free', 'premium'] as const
export const planSchema = z.enum(PLANS)

/** A BCP-47 language tag: `en`, `pt-BR`, `zh-Hant-TW`. */
export const localeSchema = z
	.string()
	.regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'a language tag like en or pt-BR')

export const DISPLAY_NAME_MAX = 80

export const profileSchema = z.object({
	id: uuid,
	email: z.string().nullable(),
	display_name: z.string().nullable(),
	/** A short-lived signed download URL for the avatar, or null. Don't store it. */
	avatar_url: z.url().nullable(),
	plan: planSchema,
	locale: z.string().nullable(),
	marketing_consent: z.boolean(),
	created_at: isoDateTime.nullable()
})

export const profileResponse = z.object({ profile: profileSchema })

/** Only these fields. Any other key, `plan_type` included, is a 400. */
export const updateProfileBody = z
	.object({
		display_name: z.string().trim().min(1).max(DISPLAY_NAME_MAX).nullable().optional(),
		locale: localeSchema.nullable().optional(),
		marketing_consent: z.boolean().optional(),
		/** From POST /api/app/v1/uploads. null removes the avatar. */
		avatar_path: avatarPathSchema.nullable().optional()
	})
	.strict()
	.refine((body) => Object.keys(body).length > 0, { message: 'Send at least one field to update' })

export type Profile = z.infer<typeof profileSchema>
export type UpdateProfileBody = z.infer<typeof updateProfileBody>
