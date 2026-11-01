/**
 * 🏷️ APP IDENTITY — Change these values to rebrand the app.
 *
 * These are referenced across landing, auth, onboarding, and profile screens.
 * Update them once here and they propagate everywhere.
 *
 * Steps to rebrand:
 *   1. Set preset, accent and appName in packages/brand/brand.config.ts
 *   2. Change APP_TAGLINE and APP_DESCRIPTION below
 *   3. Update app.json → expo.name and expo.slug
 */
import { brandConfig } from '@app/brand'

/** Display name shown in headers, onboarding, and the landing page (from brand.config.ts). */
export const APP_NAME = brandConfig.appName

/** URL scheme matching expo.scheme in app.json — used for OAuth deep link callbacks. */
export const APP_SCHEME = 'chalkback'

/** One-liner shown on the landing page below the app name. */
export const APP_TAGLINE = 'Teach it. The class talks back.'

/** Short description used in marketing / onboarding contexts. */
export const APP_DESCRIPTION =
	'Explain what you watched to AI students who ask about what you missed, so it sticks.'
