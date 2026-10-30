---
name: ship
description: Land finished work the standard way - run the local-review gates, the store-review skill when the app changed, commit in Conventional Commits, push the branch, open the pull request and watch CI to green. Use for any variant of "ship it", "push this up", "verify and push", "re verify and push", "all done, lets push", "ready to ship?", "push to main" or "lets merge to main". Every one of them ends in a branch and a PR with green CI, never a push to main; an agent merges a PR only when the person explicitly tells it to merge that PR. For a mobile change it also says whether it ships as an OTA update or needs a store build.
argument-hint: "[optional: 'check' to run the gates and classify the change without committing]"
---

# Ship

Make landing work boring and safe: verified locally, committed in the standard format, pushed
to a branch, opened as a pull request with a description a reviewer can trust, and green in
CI. Then stop. **An agent never merges on its own.**

"Push to main" and "merge to main" mean "land this". Here that is a branch and a PR; say so in
one line and carry on. Never push to `main`, even when asked in those words, and don't read
them as an instruction to merge. An agent merges a pull request only when the person
explicitly tells it to merge that pull request ([step 10](#10-merge-only-when-told-to)).

## Golden rules

1. **Never push to `main`, never merge a PR on your own, never force-push** anything but your
   own branch, and never to get around a failing check or a protection rule.
2. **Gates before push.** A gate fails: stop, show the real output, fix it or report it. Never
   "push and see what CI says".
3. Never `--no-verify`, never a blind `git add -A` or `git commit -a` over a dirty tree. If
   the tree has changes unrelated to this task, say so and ask before sweeping them in.
4. Never stage `.env*` (except the examples), `*.p8`, `*.jks`, `*.keystore`, service-account
   JSON or a zip of credentials (`docs/rules/secrets.md`).
5. `/ship check` runs steps 1 to 4 and reports. It commits and pushes nothing.

## 1. Orient

```bash
git rev-parse --abbrev-ref HEAD && git status --porcelain && git fetch origin main
```

On `main`? Create a branch before committing anything, named for the change:
`git switch -c <type>/<short-kebab-name>` (`feat/paywall-annual-plan`, `fix/offline-banner`).
Behind `origin/main` and not pushed yet: rebase onto it now. Already pushed: never rewrite
it; merge `origin/main` in if you must.

## 2. Classify the change

List what changed (`git diff --name-only origin/main...HEAD` plus the working tree) and say,
in the report and later in the PR:

- **Mobile (`apps/mobile/` or `packages/`)**: does it ship as an **OTA update**, or does it
  **need a store build**, and why? The decision is `AGENTS.md`, "Mobile: OTA first", and
  `docs/rules/ota.md`: native code changed (a native dependency, `app.json` plugins,
  permissions, infoPlist, entitlements, icons, splash, identifiers or version, an `eas.json`
  build profile, an SDK or React Native upgrade) means a store build; so does anything OTA must not carry (a new product
  category, something to buy outside in-app purchase, a feature hidden from review, a new
  permission or privacy disclosure). Otherwise it is an OTA update. Say it plainly: "ships as
  an OTA update" or "needs a store build because <change>".
- **The non-negotiables** (`AGENTS.md`): a user-visible change has its events registered (the
  `events` skill runs before the feature, not now); a change under
  `apps/web/src/app/api/dashboard/v1/` was checked against the live contract from your stats
  dashboard; a write to `plan_type`, `premium_*` or a subscription row happens on the server and has
  been read twice.
- **Schema**: if `apps/web/prisma/schema/` changed, run the local replay in `local-review`
  (drift, `check:rls`, the database suites); CI writes the missing migration and
  `deploy-migrations.yml` applies it from `main`. Flag deploy ordering in the PR when app code
  depends on it (`docs/rules/migrations.md`). `supabase/migrations/` is frozen: it never
  changes.

## 3. Gates: the `local-review` skill

Run the `local-review` skill (`.claude/skills/local-review/SKILL.md`). Its command block is
exactly what CI runs, in CI's order, followed by the commit-message check and a manual pass
against the rules. Don't keep a second copy of that list here: when a gate is added, it is
added there and in CI.

Stop at the first failure. Report each gate's real result, not "it passed".

## 4. Store review, when the app changed

If `apps/mobile/` or `packages/` changed, run the `store-review` skill
(`.claude/skills/store-review/SKILL.md`). `local-review` runs it for you in its section 2 when
the app changed; use that verdict rather than running the skill twice. It runs
`npm run check:store`, applies the Apple and Google rule table to the diff, and ends in one
verdict:

- **SHIP**: carry on.
- **FIX FIRST**: stop. Fix the list, then run the gates again.
- **NEEDS A HUMAN**: carry on, and put the list in the PR (privacy labels, the Data safety
  form, review notes, a demo account).

If the change **needs a store build** (step 2), run the mechanical gate strict as well, before
any build or submission:

```bash
npm run check:store -- --strict
```

Under `--strict` a `~ pending` rule fails: App Review doesn't read
`scripts/standards-exceptions.json`. The `store-review` skill says when a pending rule may
still ship.

## 5. Commit: Conventional Commits

Follow `docs/rules/commits.md`: `type(scope): subject`, imperative, lowercase, no trailing
period, header at most 72 characters, details in the body after a blank line. Types: `feat`
`fix` `perf` `refactor` `style` `docs` `test` `build` `ci` `chore` `revert`. The scope is
optional and one of the curated scopes in `scripts/check-commit-message.mjs`: `mobile` `web`
`api` `auth` `db` `events` `paywall` `onboarding` `admin` `ota` `store` `brand` `i18n` `ci`
`docs` `deps`. A change spanning areas takes no scope.

```text
feat(paywall): offer the annual plan with its monthly price

fix(mobile): keep the offline banner above the tab bar
```

The subject can still say what changed for the person using the app, in plain words.

- **Stage by path**, deliberately. A few commits per PR, each one unit of work; formatting and
  logic never share a commit. Not one commit per fix: batch the fixes.
- The `commit-msg` hook checks the format and CI's `commits` job checks it again over the whole
  branch. A rejected message is rewritten, never bypassed.
- **Session logs (in a play):** stage `.claude-logs/` separately, just before the push. The
  template repository itself keeps none (`CLAUDE.md`).

## 6. Push the branch

```bash
git push -u origin <branch>
```

Never `main`. If the push is rejected because the branch moved, fetch and integrate; never
force.

## 7. Open the pull request

If the work is finished, write the real title and description now. If not, open it as a draft
with a placeholder (`docs/rules/pull-requests.md`). The title follows the commit format.

```bash
gh pr create --base main --title "<type(scope): subject>" --body-file <file>
```

The body, from `docs/rules/pull-requests.md`:

1. **What changed and why**, in plain words.
2. **Standards before and after**: `npm run check:standards` on `main` and on the branch, and
   any line of `scripts/standards-exceptions.json` this PR deleted.
3. **Gates**: each command `local-review` ran and its real result line.
4. **Mobile**: the store-review verdict, and **OTA update or store build**, with the reason
   (step 2). Say "no mobile change" when there is none.
5. **Production Watch List**: what a play (or this play's users) will see change, and what to
   watch after the merge: a metric, an error, a store review, a migration.
6. **Where this differs** from the plan or the issue, and why.

## 8. Watch CI

```bash
gh pr checks <number> --watch
```

Green: report and stop. Red: read the failing step's log, fix it properly, run the gates
again, and push once. Don't push guesses. When a failure only reproduces on the CI runner, say
so and think each fix through before pushing it.

## 9. Report, then stop

The PR URL, the commits, each gate's result, CI's result, the standards count before and
after, the store-review verdict and OTA-or-build call for a mobile change, and what is left
for the person: **the merge**, anything marked NEEDS A HUMAN, and any release step below.

## 10. Merge, only when told to

The PR stays open until the person explicitly tells you to merge that pull request. Then, with
CI green and the branch up to date with `main`, merge it with a merge commit, never a squash
(`docs/rules/commits.md`):

```bash
gh pr merge <number> --merge
```

An instruction to merge one PR covers that PR, not the next one.

## After the merge (a separate step)

Nothing ships to users until the PR is merged. Then, only when asked:

- **An OTA update** is published **from `main` only**, after the merge, never from the feature
  branch or a dirty tree: `npm run check:store` and the `store-review` skill, then the
  `preview` channel first, check it on a device, then `production`, with source maps uploaded:
  `apps/mobile/.eas/workflows/publish-update.yml` does both (`docs/rules/ota.md`). Publishing to `production` is a release: confirm with the person
  before doing it.
- **A store build** runs `npm run check:store -- --strict` and the `store-review` skill first,
  then follows `docs/rules/mobile-releases.md`: test track first, then review, then a phased
  release.
- **The web** deploys itself: Vercel ships `main` on merge (`docs/rules/deployment.md`). Never
  deploy by hand.
