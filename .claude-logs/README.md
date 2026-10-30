# Claude build logs

This folder fills itself. At the **end of every Claude Code session**, the
`SessionEnd` hook in [`.claude/settings.json`](../.claude/settings.json) runs
[`.claude/log-session.py`](../.claude/log-session.py), which reads the session
transcript and drops a timestamped markdown summary here, e.g.
`2026-06-22_15-32-29_a87.md`.

You do two things:

1. **Approve the hook once.** The first time you open Claude Code in this repo it
   asks you to trust the project hook. Approve it, and from then on it writes a
   log silently at the end of every session.
2. **Keep this folder committed and push it.** The logs land on GitHub next to
   the changes they describe, so any teammate can trace how the build was made
   and pick it up cold.

## Author attribution

Each log is stamped with an author, resolved in this order:

1. the `CLAUDE_LOG_AUTHOR` environment variable, if set;
2. your repo's `git config user.name`;
3. `unknown`.

Set your git `user.name` (which you should anyway) and your logs are attributed
automatically — nothing to edit.

## Backfilling

To generate logs for past sessions that don't have one yet:

```bash
python3 .claude/log-session.py --backfill          # skips sessions already logged
python3 .claude/log-session.py --backfill --force  # regenerates all
```
