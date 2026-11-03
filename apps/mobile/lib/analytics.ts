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
	// Paste fallback — judged on whether a failed read still becomes a lesson.
	// text_paste_offered fires when the box appears after a video we can't read
	// (not a bad link, and not a busy retry). Submitting it fires video_read,
	// the same "ready to teach" moment as a video that read.
	| 'text_paste_offered'
	// Home — judged on whether people come back to a recent topic or unfinished class.
	// THE metric for return visits is continue_opened: they picked up where they left off.
	// recent_topic_opened answers who re-opens a past topic to teach again.
	// home_viewed answers who reached Home at all (drop-off before either action).
	// Metadata: home_viewed { topic_count: number },
	// recent_topic_opened { topic_id }, continue_opened { topic_id }.
	// topic_id discriminates so two topics the same day both count.
	| 'home_viewed'
	| 'recent_topic_opened'
	| 'continue_opened'
	// Explain — the loop step is finishing an explanation in your own words (brief.md).
	// THE metric is still class_started: "I'm done" that starts the class. explain_viewed
	// answers who reached Explain but never finished (video_read → explain_viewed → class_started).
	// Metadata: explain_viewed { topic_id: string }
	| 'explain_viewed'
	// The class — judged on how many who start finish, and how often they needed help.
	// Metadata: class_answered { outcome: 'answered' | 'needed_help' | 'skipped' },
	// class_finished { question_count: number, ended_early: boolean },
	// class_hand_picked { student: string } (the student's name, shows who gets picked).
	// class_started is also the Explain aha: a long-enough explanation was submitted.
	| 'class_started'
	| 'class_resumed'
	| 'class_hand_picked'
	// class_help_opened { student: string }: how often a question sends the person to the video.
	// class_help_clip_opened { start_seconds: number }: in private help, they rewatched the
	// moment in the video. start_seconds discriminates, so two moments in one class both count.
	| 'class_help_opened'
	| 'class_help_clip_opened'
	// class_question_shown_all { student: string }: they tapped the speech bubble to read the
	// whole question before the student had finished saying it. Answers whether the word-by-
	// word reveal is too slow (docs/class-scene-requirements.md). student discriminates, so
	// Maya and Omar each count on the same day.
	| 'class_question_shown_all'
	| 'class_answered'
	| 'class_finished'
	// Assessment — judged on whether people who finish a class see what they missed, and on
	// whether teaching fixes it: fixed_count above zero is the aha.
	// Metadata: assessment_viewed { correct_count: number, final_correct_count: number,
	// fixed_count: number, concept_count: number }. correct_count is the first explanation's.
	// assessment_clip_opened { concept }: they opened the video at a missed idea's timestamp.
	// concept discriminates so two clips the same day both count.
	| 'assessment_viewed'
	| 'assessment_clip_opened'
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
	//   metadata: { step: 'meet' | 'name', index: number }
	// `step` is the discriminator. started → step_viewed(meet) → step_viewed(name)
	// → completed is the funnel; a step that loses people shows as the gap after it.
	// onboarding_completed carries { skipped_name: boolean }.
	| 'onboarding_started'
	| 'onboarding_step_viewed'
	| 'onboarding_completed'
	// Preferences — settings toggles that change how the app feels. Not an "aha"
	// and not a money moment. The app has one light look, so there is no
	// appearance setting to track.
	//   haptics_changed     metadata: { enabled: boolean }
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
	// Warm-ups — the retention loop (a gap due on day 2, and again around day 7).
	// Judged on whether a due gap gets an answer in the person's own words. Not
	// a money moment, and not this play's "aha" (`user_activated` is not decided).
	//
	// warm_up_answered is THE metric: they answered in their own words.
	// gap_id discriminates, so two gaps the same day both count.
	//   warm_up_offered   a due gap is shown. metadata: { gap_id }
	//   warm_up_started   the question is on screen. metadata: { gap_id }
	//   warm_up_answered  they answered. metadata: { gap_id, is_right }
	| 'warm_up_offered'
	| 'warm_up_started'
	| 'warm_up_answered'
	// Topic page — one video's gaps and when each comes back. Judged on whether
	// people check a video's progress and teach it again.
	//   topic_viewed              the page opens. metadata: { topic_id, open_gaps: number }
	//   topic_teach_again_tapped  "Teach it again". metadata: { topic_id }
	// topic_id discriminates, so two videos the same day both count.
	| 'topic_viewed'
	| 'topic_teach_again_tapped'
	// Voice (docs/voice-requirements.md) — explaining and answering out loud, and the
	// students speaking their questions. Judged on whether people teach by voice: THE
	// metric is class_answered with method 'voice'. class_started, class_answered and
	// warm_up_answered carry { method: 'voice' | 'typed', edited: boolean } (edited only
	// for voice: they fixed the transcript before sending). The drop-off to watch is
	// recording → transcript → sent: a denied microphone, a bad transcript, or typing.
	// `surface` ('explain' | 'class' | 'warm_up') discriminates every voice event.
	//   voice_recording_started  recording begins. metadata: { surface }
	//   voice_recording_failed   voice couldn't be used, or a transcript failed.
	//                            metadata: { surface, reason: 'denied' | 'unsupported' |
	//                            'transcribe_failed' | 'busy' }
	//   voice_typed_instead      "Type instead". metadata: { surface }
	//   voice_question_played    a question is spoken. metadata: { surface, student,
	//                            replay: boolean, source: 'groq' | 'browser' }
	| 'voice_recording_started'
	| 'voice_recording_failed'
	| 'voice_typed_instead'
	| 'voice_question_played'
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
