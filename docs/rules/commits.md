# Commits: discipline and message format

## Don't over-commit: every push is a real CI bill, not a savepoint

A commit is not autosave. Every push runs CI (the secrets, template, standards, events, env and
store checks, typecheck, lint, format, tests, the web build, and the database gates), and every
run costs money and minutes. The
failure this rule stops: one feature commit followed by three or four "fix" commits, each
pushed the moment a problem was found, each paying for a CI run that the next push made
irrelevant before anyone read it.

- Commit once a unit of work is done and verified, not once each step compiles.
- **Run the gates locally before you commit, not after CI fails.** CI confirms what you already
  checked; it is not where a type error is first discovered. The `local-review` skill
  (`.claude/skills/local-review/SKILL.md`) runs exactly what CI runs.
- Batch fixes to one change into as few commits as the situation needs. Target: one feature
  commit, plus at most one consolidated fix commit if something surfaces while stabilising it.
- Give the person you are working for a chance to see or test a change before committing it,
  unless the agreed unit of work is finished and verified.
- When a problem only reproduces on a real CI runner (or an EAS builder), iterating through CI
  is legitimate. Think each fix through before pushing it anyway.

This applies to every agent, not just Claude.

## Branches and merging

- Work on a branch, never on `main`. **Never push to `main`**, and never push to `main` to get
  around a failing check or a protection rule.
- Work lands through a pull request with green CI ([pull requests](pull-requests.md)).
- **An agent never merges on its own.** It opens and finishes the PR, and merges it only when
  the person explicitly tells it to merge that PR.
- Merge with a **merge commit**, not a squash: `.git-blame-ignore-revs` lists mechanical commits
  (the formatting commit) by hash, and a squash gives them new ones.
- Force-push only your own branch, never a shared one.

## Message format

Conventional Commits: `type(scope): subject`.

- **Types:** `feat`, `fix`, `perf`, `refactor`, `style`, `docs`, `test`, `build`, `ci`,
  `chore`, `revert`. A `!` before the colon marks a breaking change (`feat(api)!: ...`).
- **Scope:** optional. When present it is one of the curated scopes: `mobile`, `web`, `api`,
  `auth`, `db`, `events`, `paywall`, `onboarding`, `admin`, `ota`, `store`, `brand`, `i18n`,
  `ci`, `docs`, `deps`. The two apps first, then the feature areas a play changes most, then
  the repo itself. A commit that spans areas takes no scope. Add a scope to the list when a new
  area appears; `git log --grep '(paywall)'` depends on scopes meaning something.
- **Subject:** imperative, lowercase first letter, no trailing period. The header (type, scope
  and subject together) is at most 72 characters. It can still be a plain sentence about what
  changed for the person using the app: `fix(paywall): show the yearly price per month`.
- Details go in the body, after a blank line.
- `Merge …` and `Revert …` headers are exempt, so GitHub's own merge commits pass.

Enforced by `.githooks/commit-msg`, installed by `npm install`'s `prepare` script
(`git config core.hooksPath .githooks`), and again by CI's `commits` job over every commit on a
pull request. Both call `scripts/check-commit-message.mjs`, which holds the `SCOPES` list, so
the rule cannot drift between them.

The stats dashboard's `/shipped` digest reads play commit messages, and it already reads
Conventional Commits. A play cloned before this rule should be checked on the digest before it
switches.
