import PostHog from 'posthog-react-native'
import { env } from './env'

const POSTHOG_KEY = env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = env.EXPO_PUBLIC_POSTHOG_HOST

/** True when a valid PostHog key is configured. */
export const isPostHogEnabled = !!POSTHOG_KEY

// Only create the client when a key is present.
// Passing an empty string to PostHog() can trigger network errors or console warnings.
export const posthog: PostHog | null = isPostHogEnabled
	? new PostHog(POSTHOG_KEY, {
			host: POSTHOG_HOST,
			persistence: 'memory',
			fetchRetryCount: 0 // don't retry on network failure — avoids noisy offline errors
		})
	: null

type TrackProperties = Parameters<PostHog['capture']>[1]
type IdentifyProperties = Parameters<PostHog['identify']>[1]

// 🔑 Add your app-specific event names here for type safety.
// All event names in one place makes it easy to audit what you're tracking.
type EventName =
	// Reading a video — judged on how many readers go on to teach it. Metadata:
	//   { concept_count: number }
	| 'video_read'
	// The class — judged on how many who start finish, and how often they needed help.
	// Metadata: class_answered { outcome: 'answered' | 'needed_help' | 'skipped' },
	// class_finished { question_count: number, ended_early: boolean },
	// class_hand_picked { student: string } (the student's name, shows who gets picked).
	| 'class_started'
	| 'class_resumed'
	| 'class_hand_picked'
	| 'class_answered'
	| 'class_finished'
	// Auth — judged on how many who start signing in finish, per method.
	// metadata on login_started, login_success and login_failed:
	//   { method: 'email' | 'apple' | 'google' }
	// `method` is the discriminator: one funnel for every way in, and each method
	// still countable on its own (Apple's native sheet on iOS, Apple's web page
	// on Android, Google's web page, the emailed code). login_failed also
	// carries { reason: 'cancelled' | 'provider' | 'invalid_code' | 'locked' }:
	// started → success is the conversion; started → failed by reason is the
	// drop-off, and a cancelled Apple sheet is a different problem from a
	// provider that is not configured.
	| 'login_started'
	| 'otp_sent'
	| 'login_success'
	| 'login_failed'
	| 'logout'
	// Onboarding — judged on completion rate, and where people fall out.
	// onboarding_step_viewed fires as each step appears.
	//   metadata: { step: 'name' | 'appearance', index: number }
	// `step` is the discriminator. started → step_viewed(name) → step_viewed
	// (appearance) → completed is the funnel; a step that loses people shows as
	// the gap after it. onboarding_completed carries
	//   { skipped_name: boolean, appearance: 'system' | 'light' | 'dark' }.
	| 'onboarding_started'
	| 'onboarding_step_viewed'
	| 'onboarding_completed'
	// Preferences — settings toggles that change what the app looks and feels
	// like. Not an "aha" and not a money moment; they answer "does anyone use
	// light mode on the dark preset?" before a play spends time on it.
	//   appearance_changed  metadata: { mode: 'system' | 'light' | 'dark',
	//                                    source: 'onboarding' | 'settings' }
	//   haptics_changed     metadata: { enabled: boolean }
	// `mode` and `source` discriminate: the same choice made in onboarding and
	// later in settings are two different signals.
	| 'appearance_changed'
	| 'haptics_changed'
	// Activity — reading the notification list.
	//   notification_opened            metadata: { category }
	//   notifications_marked_read      metadata: { count }
	//   notifications_mark_read_undone metadata: { count } (the toast's Undo)
	| 'notification_opened'
	| 'notifications_marked_read'
	| 'notifications_mark_read_undone'
	// Subscription
	| 'upgrade_page_viewed'
	// A plan card was chosen on the paywall. metadata: { package }. `package` is
	// the discriminator (monthly vs annual): selected → cta_tapped per package is
	// the step before the store sheet.
	| 'upgrade_plan_selected'
	| 'upgrade_cta_tapped'
	| 'purchase_success'
	| 'restore_purchases_tapped'
	| 'redeem_code_tapped'
	// Paywall legal links — Apple 3.1.2: the purchase flow links to the Terms of
	// Use and the Privacy Policy. A compliance feature: it has no "aha" and is not
	// a money moment. Fired when either link in the paywall footer is tapped.
	// metadata: { document: 'terms' | 'privacy' }. `document` is the
	// discriminator: one name for both links keeps them one step in the paywall
	// funnel, and each can still be counted on its own.
	| 'upgrade_legal_link_tapped'
	// Account deletion — Apple 5.1.1(v) and Google Play: an account created in
	// the app can be deleted from inside it (Settings → Delete account).
	//
	// A compliance feature, so there is no "aha", and it is not a money moment.
	// It IS a lifecycle moment, and that moment already has its canonical name:
	// `account_deleted`, which POST /api/delete-account emits to the Play Events
	// API server-side before it deletes the user (the platform's
	// right-to-be-forgotten hook). The app reuses that name; it coins no other.
	//
	// The drop-off steps, in order:
	//   delete_account_tapped     the Settings row was tapped; the confirm step opened
	//   delete_account_confirmed  the person confirmed; the request is being sent
	//   account_deleted           the server deleted the account. Fired before the
	//                             sign-out, while PostHog still knows who it was.
	//   delete_account_failed     nothing was deleted, and the person was told why.
	//                             metadata: { reason: 'not_configured' | 'no_session'
	//                             | 'unauthorized' | 'network' | 'server' }
	// tapped → confirmed is the drop at the confirm step, which says a store
	// subscription keeps billing; confirmed → failed is everyone who asked to
	// leave and could not.
	| 'delete_account_tapped'
	| 'delete_account_confirmed'
	| 'account_deleted'
	| 'delete_account_failed'
	// Minimum-version gate (components/UpdateRequiredGate.tsx). A native bug
	// can't be fixed over the air, and a phone on an old runtime can't receive
	// updates, so when GET /api/app/v1/config says this binary is below the
	// minimum, a full-screen "Update required" sends the person to the store.
	//
	// An operational feature, not a product one: there is no "aha", it is not a
	// money moment, and no lifecycle state changes (the person is still a user;
	// they are only blocked until they update). What it answers: how many people
	// a raised minimum actually locked out, and how many of them went to update.
	//
	// The drop-off steps, in order:
	//   update_required_viewed             the gate was shown on launch
	//   update_required_store_link_tapped  the person tapped through to the store
	// viewed → tapped is everyone still stuck on the unsupported build.
	// metadata (both): { app_version, min_supported_version }. No discriminator:
	// there is one gate, and both values are the version strings, not ids.
	| 'update_required_viewed'
	| 'update_required_store_link_tapped'
	// In-app interviews (components/ResearchWidget.tsx), run by 8xResearch and
	// off until the app has a product key. Not an "aha" and not a money moment:
	// they say whether people who are offered an interview take it and finish
	// it. 8xResearch counts the answers themselves; these are the app's side.
	// The drop-off steps, in order:
	//   research_interview_started    the person began the interview
	//   research_interview_completed  they finished it
	//   research_interview_closed     they put it down before the end
	//   research_interview_failed     it could not continue
	//                                 metadata: { reason }, as 8xResearch names it
	// started → completed is the completion rate; started → closed is where
	// people walk away. The package shows the pill without a callback, so how
	// many were offered one is read in 8xResearch, not here.
	| 'research_interview_started'
	| 'research_interview_completed'
	| 'research_interview_closed'
	| 'research_interview_failed'
	// Navigation
	| 'screen_viewed'
	// Profile
	| 'profile_viewed'
	| 'profile_updated'
// TODO: add your app-specific events here

/** Track an event. No-ops silently when PostHog is unconfigured. */
export function track(event: EventName, properties?: TrackProperties) {
	if (!posthog) return
	try {
		posthog.capture(event, properties)
	} catch {
		// intentionally silent
	}
}

/** Identify the user in PostHog (call after login). */
export function identify(userId: string, properties?: IdentifyProperties) {
	if (!posthog) return
	try {
		posthog.identify(userId, properties)
	} catch {
		// intentionally silent
	}
}

/** Reset the PostHog identity (call after logout). */
export function resetIdentity() {
	if (!posthog) return
	try {
		posthog.reset()
	} catch {
		// intentionally silent
	}
}
