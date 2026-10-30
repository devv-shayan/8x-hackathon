import { z } from 'zod'

// GET /api/app/v1/config: public, no auth. The minimum-version gate's contract
// (docs/rules/ota.md), read by every installed build on launch: the app's
// lib/appConfig.ts fetches it through lib/api.ts, which parses the response
// with this schema, and the web route answers with it.
//
// Both objects and all four keys are always present. Unknown top-level fields
// are ignored by the app, so fields may be added; never rename, remove or
// retype these.

export type GatedPlatform = 'ios' | 'android'
export const GATED_PLATFORMS: readonly GatedPlatform[] = ['ios', 'android']

/** "1", "1.4" or "1.4.2": what CFBundleShortVersionString and versionName hold. */
export const appVersionSchema = z.string().regex(/^\d+(\.\d+){0,2}$/, 'a version like 1.4.2')
export const storeUrlSchema = z.url({ protocol: /^https$/ })

export const appConfigSchema = z
	.object({
		/** The oldest native version still supported. null: no minimum. */
		min_supported_version: z.object({
			ios: appVersionSchema.nullable(),
			android: appVersionSchema.nullable()
		}),
		/** The store listing the gate links to. Required wherever a minimum is set. */
		store_url: z.object({
			ios: storeUrlSchema.nullable(),
			android: storeUrlSchema.nullable()
		})
	})
	.superRefine((config, ctx) => {
		for (const platform of GATED_PLATFORMS) {
			if (config.min_supported_version[platform] && !config.store_url[platform]) {
				ctx.addIssue({
					code: 'custom',
					path: ['store_url', platform],
					message: `store_url.${platform} is required when min_supported_version.${platform} is set`
				})
			}
		}
	})

export type AppConfig = z.infer<typeof appConfigSchema>
