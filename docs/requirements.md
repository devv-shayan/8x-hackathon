# <Play name> — Requirements

> **Brand name:** **<Name>** (domain: <domain>)
> **Type:** Mobile app (Expo / React Native, iOS + Android) + Next.js marketing site.
> **Markets:** <markets / languages>
> **Status:** v1 requirements draft — for review before build kickoff.

This is the single source of truth for what v1 does. Engineering, design, and
growth should be able to work off it without re-deriving context. Fill in every
`<placeholder>`; delete this note when you do.

- **[v1]** = in scope for first launch.
- **[v2]** = intentionally out of scope (listed so we don't build it by accident).
- **[Decision needed]** = a call required before kickoff.

---

## 1. Executive summary

<Two or three sentences: what it is, who it's for, the wedge. Why now, why we win.>

## 2. Positioning

| Competitor   | Their wedge   | Our wedge   |
| ------------ | ------------- | ----------- |
| <competitor> | <their angle> | <our angle> |

## 3. Target user

<Who, where, what they're trying to do, what they use today.>

## 4. The core flow [v1]

The flow the Play Engineer playbook says ships first:

```
signup → onboarding → core value → paywall → payment → post-purchase
```

Spell out each step for this product:

1. **Signup** — <method(s)>
2. **Onboarding** — <screens / data collected>
3. **Core value** — <the one thing the product does>
4. **Paywall** — <when it appears, what's gated>
5. **Payment** — <plans, prices, trial> (see `apps/web/src/lib/pricing.ts` + RevenueCat)
6. **Post-purchase** — <what unlocks>

## 5. Features

| Feature   | Scope | Notes |
| --------- | ----- | ----- |
| <feature> | [v1]  |       |
| <feature> | [v2]  |       |

## 6. Data model

<Tables beyond the template's profiles/items/tasks. Add models to `apps/web/prisma/schema/`; CI writes the migration, and each new table gets its security migration (`docs/rules/migrations.md`).>

## 7. Instrumentation [v1]

Agree the key events **before** building (the week-5 kill/scale decision depends
on them). Confirm each fires end-to-end into the plays database.

Use the canonical names in `docs/EVENTS.md` wherever one fits, and its naming rule
(`snake_case`, object then action, past tense) for anything new. Reuse a name
already in a registry before coining one. The `events` skill registers them.

The template's registries already name the core flow's moments. Start from these and add
this product's own:

| Event                  | Registry | Fires when                                              | Properties                              |
| ---------------------- | -------- | ------------------------------------------------------- | --------------------------------------- |
| `signup_completed`     | web      | an account is created (`/api/lifecycle/session`)        | `signup_method`                         |
| `onboarding_completed` | both     | onboarding finished                                     | app: `skipped_name`, `appearance`       |
| `user_activated`       | web      | <the "aha": core value reached>                         | `activation_type`                       |
| `upgrade_cta_tapped`   | mobile   | paywall → buy tapped                                    | `package`                               |
| `purchase`             | web      | a payment succeeded (the RevenueCat webhook records it) | `product_id`, `price_cents`, `currency` |

Each app has its own registry: GA4 + PostHog on web
(`apps/web/src/lib/analytics/events.ts`), PostHog on mobile (the `EventName`
union in `apps/mobile/lib/analytics.ts`). The platform's email automation hears
some of these under its canonical Play Events names instead: `signup_completed`
reaches it as `user_signed_up`, and a first purchase as `subscription_started`
(`docs/EVENTS.md`, "Canonical catalog").

## 8. Success criteria & kill threshold

<The metric(s) and the number that decides scale vs. kill at week 5.>

## 9. Out of scope (v2+)

<Explicitly listed so we don't build them.>
