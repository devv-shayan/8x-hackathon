---
name: store-review
description: 'Review mobile changes against the Apple App Review Guidelines and Google Play policy before an OTA update, a store build or a submission, and end in one verdict (SHIP, FIX FIRST or NEEDS A HUMAN). Use before any "push an update", "ship an OTA", "eas update", "build for TestFlight", "submit to the App Store / Play", "release", and whenever local-review or ship sees apps/mobile or packages/ in the diff. Blocks the release on what gets apps rejected: ads without the tracking prompt, missing purpose strings, a paywall without Terms and Privacy links or Restore, no in-app account deletion, a third-party login without native Sign in with Apple, features hidden from review.'
---

# Store review

Apps get rejected for the thing nobody checked. Check it here, before the release.

The rule table and the verdict format are in `docs/rules/store-review.md`, and whether a change
can be an OTA update is decided by `docs/rules/ota.md` (`AGENTS.md`, "Mobile: OTA first"). Read
both. This skill is the procedure; it doesn't restate them.

## 1. Scope the change

The diff since the last store release, the app and the shared packages only:

```bash
git tag --sort=-creatordate | head                     # the tag of the last store build, if the play tags them
git diff <last-release-tag>...HEAD --stat -- apps/mobile packages
```

With no tag for the last store build, diff against main instead, and say so in the report: a
change merged since the last build is then not in the diff.

```bash
git fetch origin main
git diff origin/main...HEAD --stat -- apps/mobile packages
```

If you can't tell which tag marks the last store build, ask. Don't guess.

## 2. Classify: an OTA update, or a store build

Apply `docs/rules/ota.md` to the diff, and say which it is, in so many words.

- **Native change → store build.** A dependency with native code added, removed or upgraded
  (its package has `ios/`, `android/` or a `.podspec`); `app.json` plugins, permissions,
  infoPlist, entitlements, icons, splash, identifiers or version; an `eas.json` build profile;
  an Expo SDK or React Native upgrade. Name the change that forced it: "needs a store build
  because …".
- **Otherwise an OTA update, unless it must not be one:** it changes what the app is (Apple
  2.5.2), sells digital content outside in-app purchase (3.1.1), reveals a feature hidden from
  review (2.3.1), or needs a new permission, privacy disclosure or tracking prompt. Any of those
  is a store build even though it could technically ship over the air.

An update reaches only builds made with `expo-updates` configured. If the play has no such
store build yet, nothing can ship over the air: say that too.

## 3. Run the mechanical gate

```bash
npm run check:store
```

Any `✗` blocks: the verdict is FIX FIRST. Paste the real output.

For a **store build or a submission**, run it strict as well:

```bash
npm run check:store -- --strict
```

A `~ pending` line is a gap the play knowingly carries (`scripts/standards-exceptions.json`
says which, and why; the template ships with none). CI lets it through; App Review doesn't read
that file. Under `--strict` it fails. Every pending rule the release ships is FIX FIRST, unless
the release doesn't contain what the rule is about (say which rule, and why). For an **OTA
update**, a pending rule blocks only if the diff touches it.

## 4. Apply the rule table

For every row of the table in `docs/rules/store-review.md` whose trigger appears in the diff,
confirm the requirement is met in the code, with `file:line`.

`check:store` decides some rows mechanically: ATT with an ads or attribution SDK, purpose
strings, the privacy manifest, Android permissions (from the resolved build), in-app account
deletion, paywall links and Restore, Sign in with Apple beside a third-party login, and mock
data or placeholder copy in a release. A pass there is necessary, not sufficient. The purpose
string exists, but is the permission asked for at launch instead of in context? The ATT prompt
exists, but does the ads SDK start before it? The paywall links are there, but are the price,
billing period and trial terms clear before the purchase?

The other rows are judgement: user-generated content, anything a flag, remote config or OTA
hides from a reviewer, what an OTA's content does to the reviewed purpose, a new SDK's privacy
labels and Data safety entries, push, rating prompts, a login wall (demo account), health,
medical, financial or legal claims, and children.

When a guideline's wording matters, read the current text, not your memory of it, and cite the
section you relied on:

- Apple: <https://developer.apple.com/app-store/review/guidelines/>
- Google Play: <https://play.google.com/about/developer-content-policy/>

## 5. Report

Use the format in `docs/rules/store-review.md` ("The verdict"). Before the table, state the diff
base (the tag, or `origin/main` and that it isn't the last release), OTA or store build and why,
and the `check:store` output (strict for a build). Then the table, one row per triggered rule,
and exactly one verdict:

- **SHIP**: as an OTA update or a store build, as classified.
- **FIX FIRST**: what blocks, each with its fix.
- **NEEDS A HUMAN**: what lives outside the repo and a person must do or confirm: App Store
  Connect privacy labels, the Play Data safety form, review notes and a demo account, age
  rating, the rows marked "flag for a human".

Never "probably fine". Nothing ships to `production`, over the air or through a store, on
anything but SHIP, and an update is published from `main` only (`docs/rules/ota.md`).
