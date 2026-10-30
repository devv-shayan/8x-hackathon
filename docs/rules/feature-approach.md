# Feature approach: 80/20 first, but only the first time

Two situations, two priorities. Tell them apart before deciding how to approach the work.

## A brand-new feature: propose the 80/20 slice, let the developer choose

When a feature doesn't exist yet, don't default to the fully robust version. Find the ~20% of
scope that delivers ~80% of the value and **present it as a choice, not a silent decision**:
"here is the minimal version that ships the core value, here is what a fuller version would
also cover, which do you want?" Don't build the maximal version on spec because it seemed more
thorough.

This is ordinary MVP thinking, and its formal backing is YAGNI: build a thing when you need it,
not when you foresee needing it. It matters more for agents than for people: over-building
(unrequested abstractions, extra files, compatibility shims nobody asked for) is a known
failure mode of AI coding agents. Constraining scope before generating code is the fix, and
proposing the 80/20 slice up front is that constraint.

A play is judged on a week-5 kill-or-scale decision, so the slice that ships first is the one
that proves or disproves the play fastest. It still ships with its events registered
(AGENTS.md, non-negotiable 1): a slice nobody can measure proves nothing.

YAGNI is not a licence for sloppy code. Whichever slice is picked is still implemented
correctly, tested, and free of the shortcuts [code quality](code-quality.md) rules out. Skip
the edge cases of the parts you are not building; don't skip the edge cases of the parts you
are.

## Adjusting an existing feature: 80/20 doesn't apply, edge cases do

Once a feature is live, the calculus flips. Its value is proven; what matters now is not
breaking it and not leaving new gaps. Minimising scope on a change to shipped behaviour trades
a non-problem for a real one: a regression, or an edge case that surfaces as a support ticket.

- Prioritise tests and edge cases over a small diff.
- Don't propose a "minimal version" of a bug fix. Fix the actual problem, including the less
  common paths that are still reachable.
- If the change shows the existing implementation was over-scoped or under-tested, say so, but
  as a separate conversation. Don't silently expand scope to fix everything nearby.

On mobile a shipped feature has a second life: an installed build keeps running the old code
until it updates. A change that assumes every user is on the newest build is an edge case,
not an afterthought ([mobile data](mobile-data.md), [OTA updates](ota.md)).
