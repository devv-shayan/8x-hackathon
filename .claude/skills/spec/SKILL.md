---
name: spec
description: Research a change against this codebase, then write it up as requirements plus a phased plan in docs/ before any code is written. Use for "plan this", "deeply analyse then plan", "audit this and tell me what we need", "what do we need for X", or before starting any new feature or sprint that spans more than one file.
argument-hint: '[the feature or change to plan]'
---

# Spec

Research first, write it down, then build. The output is two files in `docs/`, not a wall of
chat text that disappears.

## Step 1: Research the actual code, not the idea of it

Before writing a word of the plan, establish what is really there:

- Which files own the surface being changed, and what already exists that can be reused.
- What the data model looks like now — read `apps/web/prisma/schema/`, not your assumption of
  it (`supabase/migrations/` is frozen history).
- Where the authorization boundary sits: in the route, before the query
  (`docs/rules/authorization.md`). Anything the change would write that decides entitlement
  is written by server code only, or it becomes a free upgrade.
- What the change touches that is load-bearing: money, entitlement, auth, the Play Stats API.
- **What events the change needs.** Run the `events` skill's Step 2 questions now — the answers
  belong in the requirements, not discovered halfway through the build.

State what you found. If the request rests on a wrong premise about the codebase, say so here,
plainly, before planning around it.

## Step 2: `docs/<feature>-requirements.md`

What must be true when this is done. Not how.

```markdown
# <Feature> — requirements

## Problem

<What is wrong or missing today, in terms of the person using the app.>

## Success criteria

<The observable outcome. Include the metric and the event that measures it —
if nothing measures it, the feature cannot be judged and that is a finding.>

## Requirements

R1. <Testable statement.>
R2. …

## Events

<Every event this feature registers, which app fires it, its discriminators,
and its sinks. When the build starts, the `events` skill registers each in its
app's registry: apps/web/src/lib/analytics/events.ts for the web, the
`EventName` union in apps/mobile/lib/analytics.ts for the app.>

## Out of scope

<What this deliberately does not do, so scope does not drift mid-build.>

## Open questions

<Anything needing a decision from a person. Do not invent an answer here.>
```

## Step 3: `docs/<feature>-plan.md`

Phased, each phase independently shippable and verifiable.

```markdown
# <Feature> — plan

## Phase 1 — <name>

**Files:** <exact paths, existing and new>
**Changes:** <what happens in each>
**Verify:** <the command or the click-path that proves it works>

## Phase 2 — …

## Risks

<What could break. Migrations that are hard to reverse, anything touching
entitlement or money, anything that changes a number the dashboard reports.>
```

Order phases so the schema lands before the code that reads it, and the events land before the
UI that fires them.

## Step 4: Stop

Do not start building. Report the two file paths and the headline of the plan, then let the
person read it. The point of a spec is the disagreement it surfaces _before_ the code exists.
