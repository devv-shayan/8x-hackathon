/**
 * The event-name registry. Single source of truth for everything this play
 * measures on the web.
 *
 * Client-safe: this module has NO server imports, so it is importable from
 * client components. That matters because the same constants feed both the
 * client `gaEvent` call sites AND the server-side TRACKED_EVENTS whitelist in
 * `lib/analytics/record.ts` — sharing the constants is what stops the two from
 * drifting.
 *
 * An event fired but not registered here is rejected by /api/track with a 400
 * and disappears with no error anywhere a person would see it. Real plays have
 * lost their main funnel step this way for months. `npm run check:events`
 * exists to make that impossible; it runs in CI.
 *
 * Adding events: use the `events` skill (.claude/skills/events/). It asks the
 * questions the code cannot answer — what the "aha" is, where the drop-off is,
 * what discriminator each event carries.
 *
 * Naming: snake_case, object then action (`checkout_started`, not
 * `start_checkout`). Reuse an existing name when the moment is the same moment;
 * two names for one action means every funnel built on either is wrong.
 */

/**
 * Marketing funnel — the anonymous top of funnel.
 *
 * These fire for GUESTS, who are most of the traffic on these pages. They are
 * recorded first-party against a session id rather than a user id, which is the
 * only way landing → pricing → signup conversion is computable at all.
 *
 * `pricingView` is the one that matters: it is the denominator for every
 * conversion rate this play will be judged on.
 */
export const FUNNEL_EVENTS = {
	/** The landing page was viewed. */
	landingView: 'landing_view',
	/** The pricing page or pricing section was viewed. */
	pricingView: 'pricing_view',
	/** A plan was selected on the pricing page. metadata: { plan } */
	planSelected: 'plan_selected',
	/** The waitlist form was submitted. */
	waitlistJoined: 'waitlist_joined',
	/** The contact form was submitted. */
	contactSubmitted: 'contact_submitted',
	/**
	 * A store button was clicked through to App Store / Play. metadata: { store, placement }
	 *
	 * `store` is the first-party discriminator (one row per store per visitor per
	 * day). `placement` ('hero' | 'closing') rides to PostHog and GA4 only: it
	 * answers "which part of the page sends people to the store", a design
	 * question for funnels, and widening the first-party dedupe key with it would
	 * count one visitor's two clicks on the same store as two store visits.
	 */
	storeBadgeClicked: 'store_badge_clicked',

	// The landing page's own interactions. None of them is the conversion (that
	// is a store click or a waitlist join); each one explains a drop before it.

	/**
	 * An in-page call to action was clicked. metadata: { cta }
	 * `cta` is the discriminator: 'nav' (the capsule nav's "Get the app") or
	 * 'pricing_teaser' (the landing pricing section's link to /pricing). Compare
	 * each against `store_badge_clicked` to see whether the nav or the page is
	 * doing the sending.
	 */
	ctaClicked: 'cta_clicked',
	/**
	 * The scene-scroll story on the landing page came into view (once per page view).
	 * Its share of `landing_view` is how many visitors get past the first
	 * viewport; if it is low, the hero is the problem, not the story.
	 */
	storyView: 'story_view',
	/**
	 * A FAQ answer was opened, on the landing page or /pricing. metadata: { question }
	 * `question` is the discriminator (a stable slug from src/lib/faq.ts), so the
	 * count per question is real: the most-opened question is the objection the
	 * page above it failed to answer.
	 */
	faqOpened: 'faq_opened'
} as const

export const FUNNEL_EVENT_NAMES = Object.values(FUNNEL_EVENTS)

/**
 * Account lifecycle.
 *
 * Every one of these ALSO goes to the Play Events API (lib/plays/events.ts),
 * because they are what the platform's email automation runs on. `signupCompleted`
 * and `accountDeleted` are mandatory for every play — the second is the GDPR
 * right-to-be-forgotten hook and must never be skipped.
 *
 * `userActivated` is the only one you have to decide: it fires on this play's
 * "aha", the single action that means the product worked. If you cannot name
 * that action, the play has no success criterion yet, which is worth saying out
 * loud before building more of it.
 */
export const LIFECYCLE_EVENTS = {
	/** An account was created. metadata: { signup_method } */
	signupCompleted: 'signup_completed',
	/** The user reached this play's "aha". metadata: { activation_type } */
	userActivated: 'user_activated',
	/** Onboarding finished. */
	onboardingCompleted: 'onboarding_completed',
	/** The account was deleted / erasure requested. metadata: { reason } */
	accountDeleted: 'account_deleted',
	/** Product-email opt-in toggled. metadata: { subscribed } */
	marketingConsentChanged: 'marketing_consent_changed'
} as const

export const LIFECYCLE_EVENT_NAMES = Object.values(LIFECYCLE_EVENTS)

/**
 * Paywall and checkout.
 *
 * The gap between `checkoutStarted` and `purchase` is the drop that never
 * reached a payment sheet, which is a different problem from a sheet people
 * abandoned — so both exist deliberately.
 *
 * `purchase` is recorded with dedupe OFF: every occurrence is a row. Deduping
 * money by day would merge a customer's second purchase into their first.
 */
export const CHECKOUT_EVENTS = {
	/** The paywall / upgrade screen was viewed. metadata: { source } */
	upgradeView: 'upgrade_view',
	/** Checkout began — a real payment sheet is opening. metadata: { plan, price_cents } */
	checkoutStarted: 'checkout_started',
	/** Payment succeeded. metadata: { plan, price_cents, currency } */
	purchase: 'purchase',
	/** Payment failed. metadata: { plan, reason } */
	paymentFailed: 'payment_failed',
	/** A trial began. metadata: { plan } */
	trialStarted: 'trial_started',
	/** Auto-renew was turned off; access continues to period end. metadata: { plan } */
	subscriptionCancelled: 'subscription_cancelled',
	/** Access actually ended. metadata: { plan } */
	subscriptionExpired: 'subscription_expired',
	/** A refund was issued. metadata: { plan } */
	refundIssued: 'refund_issued'
} as const

export const CHECKOUT_EVENT_NAMES = Object.values(CHECKOUT_EVENTS)

/**
 * Every registered web event, flat. This is what the whitelist and the CI check
 * read; adding a group above without spreading it here is the one mistake
 * `npm run check:events` is built to catch.
 */
export const ALL_EVENT_NAMES = [
	...FUNNEL_EVENT_NAMES,
	...LIFECYCLE_EVENT_NAMES,
	...CHECKOUT_EVENT_NAMES
] as const

export type AppEvent = (typeof ALL_EVENT_NAMES)[number]
