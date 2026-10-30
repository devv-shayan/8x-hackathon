@AGENTS.md

Everything above applies to any coding agent working in this repo. It lives in `AGENTS.md`,
not here, because `AGENTS.md` is the file every tool reads and this one is Claude Code's alone.
Don't put rules back into this file; add them to `AGENTS.md` so they reach every agent.

This file holds only what is specific to Claude Code.

## Skills in this repo

Committed under `.claude/skills/`, so every clone gets them:

| Skill          | Use it for                                                          |
| -------------- | ------------------------------------------------------------------- |
| `events`       | Registering and wiring analytics for a feature, before the feature  |
| `play-api`     | Implementing, extending or debugging the Play Stats API             |
| `admin`        | Adding or changing a screen in the admin panel                      |
| `spec`         | Research → `docs/*-requirements.md` + `docs/*-plan.md`, before code |
| `ship`         | Gates, a Conventional commit, the branch pushed, a PR, green CI     |
| `local-review` | Before every push: CI's exact gates, then a pass against the rules  |
| `store-review` | Before an OTA to production, a store build or a submission          |

`ship` never pushes to `main` and never merges on its own: it ends at a pull request with green
CI. An agent merges a pull request only when the person explicitly tells it to merge that pull
request. `ship` runs `local-review` for the gates and `store-review` when the app changed.

## MCP servers

None ship with the template. If your stats dashboard or email platform has an MCP server, add
it to a `.mcp.json` at the root. Have each read its token from your shell environment as
`${VAR}`: tokens are never in the repo, and never pasted into a conversation. A dashboard MCP
that can audit this app's live Play Stats API (non-negotiable 2) is the best source for its
contract.

## Hooks

`.claude/settings.json` configures two hooks and one permission rule:

- **`SessionStart`** runs `.claude/session-brief.py`, which puts this play's standing rules
  (the three non-negotiables: events first, the Play Stats API, money and entitlement on the
  server) and its two event registries into context at the top of every session.
- **`SessionEnd`** runs `.claude/log-session.py`, which writes the session's log to
  `.claude-logs/`: every prompt and every text reply, verbatim. In the template repository
  itself (root package named `app-template`) it writes nothing and prints why.
- **Reading the real env files is denied** (`.env`, `.env.local`, `.env.*.local` and the
  per-environment names; `.env.example` stays readable), so secrets never reach the
  conversation. The deny list binds Claude Code's file-reading tools only: it does not stop a
  shell `cat`, `grep`, `head` or `source`. Never read a real env file by any means, and
  respect the same rule when staging files ([docs/rules/secrets.md](docs/rules/secrets.md)).

## Session logs

In a play, `.claude-logs/` is tracked, not gitignored: the transcript of the session that
produced a change ships on the branch with it. Stage it immediately before `git push`,
separately from the code commit, and end each session with the logs pushed.
`npm run logs:backfill` writes older sessions. The pre-commit hook scans transcripts for secrets like any other file; if a real value
scrolled past, redact it in the transcript rather than allowlisting it
([docs/rules/secrets.md](docs/rules/secrets.md)).

The template repository keeps no logs of its own: nothing is written in the template's own repo
(package `app-template` and origin `8xsocial/template-monorepo`), and `npm run check:template`
fails its CI if a log is committed there anyway. Every copy logs from its first session.

## Memory

Claude Code also keeps its own memory outside the repo. Anything a future session or a
teammate's agent needs to know about this play goes in `docs/memory/` instead, in the format
`AGENTS.md` gives ("Project memory"), with its line in `docs/memory/MEMORY.md`. The
frontmatter's `metadata.type` values are Claude Code's memory types: `user` (who the people
are), `feedback` (how they want the work done), `project` (facts about this play), `reference`
(where to look things up).
