/**
 * Where the app is, and so what the site asks a visitor to do.
 *
 * Both URLs ship empty, so a fresh clone is in its pre-launch state: the
 * store buttons give way to the waitlist form, and the closing band says the
 * app is not out yet. The page never claims the app is in a store it is not
 * in.
 *
 * 🎨 REPLACE: set each URL once that listing is live, and the site switches
 * itself to the store buttons. A play live on one store sets only that one.
 */

// 🎨 REPLACE: your App Store listing, e.g. 'https://apps.apple.com/app/id<your app id>'.
export const APP_STORE_URL: string = ''
// 🎨 REPLACE: your Google Play listing, e.g. 'https://play.google.com/store/apps/details?id=<package>'.
export const PLAY_STORE_URL: string = ''

/** True once at least one store listing is set. */
export const IS_LIVE = APP_STORE_URL !== '' || PLAY_STORE_URL !== ''
