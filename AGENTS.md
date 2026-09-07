<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Shipping

Vercel builds production from `main`. Work pushed to a branch changes nothing
the user can see, so a branch push is not a finished task.

Before telling the user anything is done:

1. Push the branch and open a pull request.
2. Check that `main` actually contains the commit —
   `git fetch origin && git merge-base --is-ancestor <sha> origin/main`.
3. If it does not, say plainly that the change is **not live until PR #N is
   merged**, and give the link. Never say work has been "added to" an existing
   pull request without first checking that pull request is still open — one
   merged 20 minutes earlier will silently strand the commit.

The user merges. Do not merge for them unless they ask.

If the branch's pull request has already been merged, do not stack new commits
on it: rebase onto the current `main` and open a new pull request.
