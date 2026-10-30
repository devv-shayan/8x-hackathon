# Pull requests: write the description last, not first

A PR description written when the branch was opened describes the first commit's intent, not
what shipped. A reviewer trusts it anyway, and so does any agent that reads PR history later
for context on why something exists.

## The rule

- If the work is finished when you open the PR, write the real title and description now.
- If the PR needs to exist earlier (CI signal, a Vercel preview, an EAS preview build), open it
  as a **draft** (`gh pr create --draft`) with a placeholder, not final-sounding copy for
  unfinished work.
- Write the real title and description once the work is verified: the gates pass locally and
  nothing is left to fix. Then mark it ready (`gh pr ready`) and describe everything that
  happened across the branch, every fix and scope change included.
- If more lands after that, rewrite the description before it is merged
  (`gh pr edit --body …`).

Draft is a real GitHub state. The Claude review workflow
(`.github/workflows/claude-code-review.yml`) skips drafts, so no review run is spent on a diff
that is still moving. Marking the PR ready is what triggers it.

## What the description carries

The title follows the commit format ([commits](commits.md)). The body has:

1. **What changed and why**, in plain words.
2. **Standards before and after**: the `npm run check:standards` count on `main` and on the
   branch, and any line of `scripts/standards-exceptions.json` the PR deleted.
3. **Gates**: each command run locally and its real result. Not "tests pass": the output line
   that says so.
4. **Mobile changes**: the `store-review` verdict ([store review](store-review.md)), and whether
   the change ships as an **OTA update** or **needs a store build**, with the reason
   ([OTA updates](ota.md)).
5. **Production Watch List**: what a play cloned from this template would see change, and what
   to watch after it merges (a metric, an error, a store review, a migration's run).
6. **Where this differs from the plan or the issue**, if it does, and why.

End it with the attribution line your tool requires, if any. The `ship` skill
(`.claude/skills/ship/SKILL.md`) opens the PR with this body.

## Merging

An agent never merges on its own. It opens the PR, watches CI to green
(`gh pr checks <n> --watch`), fixes what fails properly, and stops. It merges a pull request
only when the person explicitly tells it to merge that pull request; "push to main" or "merge
to main" said before there is a PR means "land this", not "merge". It never pushes to `main` to
get around a block, and never force-pushes anything but its own branch. Merge with a merge
commit (`gh pr merge <n> --merge`, [commits](commits.md)).
