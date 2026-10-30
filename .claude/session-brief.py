#!/usr/bin/env python3
"""
session-brief.py — SessionStart hook. Opens every session with a short brief:
this play's three non-negotiables, and how many events each app's registry
declares. The rules themselves live in AGENTS.md (CLAUDE.md imports it); this
restates the three in a few lines, so keep it in step when AGENTS.md changes them.

Configure in .claude/settings.json:
    { "hooks": { "SessionStart": [{ "hooks": [
        { "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/session-brief.py\"" } ] }] } }

Claude Code adds this script's stdout to the session context. It is deliberately
short — a brief, not a manual — and it must never fail: a broken hook that exits
non-zero is noise at the start of every session, so everything is wrapped and the
exit code is always 0.
"""

import os
import re
import sys


def project_root():
    """Repo root. Anchored to the project, never the live cwd — Claude Code may
    change its working directory mid-session."""
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and env.strip():
        return os.path.abspath(env.strip())
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


ROOT = project_root()

# Registry locations, in the order they are reported. Each app has its own
# registry, checked on its own by `npm run check:events`: the web's object
# groups in events.ts, and the app's `EventName` union. The second web path is
# the web-only template's layout.
REGISTRIES = [
    ("web", os.path.join(ROOT, "apps", "web", "src", "lib", "analytics", "events.ts")),
    ("web", os.path.join(ROOT, "lib", "analytics", "events.ts")),
    ("mobile", os.path.join(ROOT, "apps", "mobile", "lib", "analytics.ts")),
]

# The two shapes scripts/check-events.mjs reads, and nothing else, so the count
# here matches the one the gate prints:
#   object form (web):   someKey: 'event_name',  inside `export const X = { … } as const`
#   union form (mobile): | 'event_name'
OBJECT_GROUP = re.compile(r"export const [A-Z][A-Z0-9_]*\s*=\s*\{([\s\S]*?)\n\}\s*as const")
OBJECT_ENTRY = re.compile(r"""^\s*\w+\s*:\s*['"]([a-z][a-z0-9_]*)['"]""", re.M)
UNION_ENTRY = re.compile(r"""^\s*\|\s*['"]([a-z][a-z0-9_]*)['"]""", re.M)


def count_events(path):
    """The number of event names a registry file declares, or None if unreadable.

    A nudge in a session brief, not the gate: `npm run check:events` is that.
    """
    try:
        with open(path, "r", encoding="utf-8") as fh:
            src = fh.read()
    except OSError:
        return None
    names = set(UNION_ENTRY.findall(src))
    for body in OBJECT_GROUP.findall(src):
        names.update(OBJECT_ENTRY.findall(body))
    return len(names)


def main():
    lines = [
        "## This play's standing rules (from .claude/session-brief.py)",
        "",
        "**Events are not a follow-up task.** Any change to something a user can see or do —"
        " a screen, route, button, paywall, onboarding step, checkout, toggle, or a cron that"
        " changes a user's state — registers its events *before* the feature code is written."
        " Use the `events` skill. It asks the questions that cannot be inferred from the code"
        " (what the 'aha' is, where the drop-off is, what discriminator each event carries).",
        "",
        "An event fired but not registered is rejected by the beacon with a 400 and vanishes"
        " silently. That is how a play discovers months later that its main funnel step was"
        " never recorded. `npm run check:events` is the gate; it runs in CI.",
        "",
        "**This play reports its own numbers.** The Play Stats API in"
        " `apps/web/src/app/api/dashboard/v1/` is what your stats dashboard reads, and nothing"
        " else can answer for it. Before changing it, get the current contract from the"
        " dashboard (its docs or MCP) — never implement it from memory.",
        "",
        "**Money and entitlement are load-bearing.** Anything writing `plan_type`, `premium_*`"
        " or a subscription row goes through server code (a server route that verified its"
        " caller, writing through Prisma: `apps/web/src/server/db/profiles.ts`), never the"
        " browser and never the app. Review those diffs twice.",
    ]

    found = []
    for label, path in REGISTRIES:
        if os.path.exists(path):
            n = count_events(path)
            rel = os.path.relpath(path, ROOT)
            found.append("- `%s` (%s): %s events registered" % (rel, label, n if n is not None else "?"))
    if found:
        lines += [
            "",
            "**Event registries in this repo** (one per app; each app's events are registered in"
            " its own, and `npm run check:events` checks each on its own):",
        ] + found

    sys.stdout.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # never break a session over the brief
        sys.stderr.write("session-brief: %s\n" % err)
    sys.exit(0)
