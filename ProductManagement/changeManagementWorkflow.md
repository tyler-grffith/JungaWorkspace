## Background

I'm developing this project as part of a master's program I'm in. Over the course of this semester there is a goal for me to understand best practices in github and git workflows. However I want to start simple so I can advance the content of my project without a lot of overhead. It is just me and my agents working.

## Workflow

I develop sequentially — one feature change at a time, usually driven by an agent.

An agent creates a branch as it sees fit. Nothing is committed directly to `main`; every change reaches `main` through a pull request. That is the whole point of the branch, since the PR is where I actually look at the diff.

When a feature is ready, the agent opens a PR and tells me. I review the diff on GitHub and leave comments there if something needs to change. The agent reads those comments back (`gh pr view --comments`) and pushes fixes to the same branch.

Once I've said yes and CI is green, the agent merges the PR and deletes the branch.

### What "approved" means here

It means I looked at the change and said yes, in chat or in a PR comment.

It does *not* mean GitHub's formal "Approved" review state. GitHub does not let you approve your own pull request, and since I author or drive nearly every PR here, that state is one I usually can't produce. An agent should never wait on it or try to satisfy it.

## Branch protection on main

`main` is protected. The rules that are enforced:

- A pull request is required — no direct pushes to `main`.
- The "Application checks" workflow must pass, and the branch must be up to date with `main` before merging.
- Comment threads on the PR must be resolved before merging.
- No force pushes, no branch deletion.

Required approving reviews are set to **0**, deliberately. With `require_code_owner_reviews` on and `CODEOWNERS` assigning everything to me, any PR I author would need an approval that GitHub forbids me from giving myself. The only way to merge was the admin bypass button, which made the rule theater. Setting approvals to 0 keeps the gate that actually means something — CI — and drops the one that couldn't be satisfied.

`.github/CODEOWNERS` still lists me as owner of everything. With code-owner review no longer required it is advisory: it auto-requests my review on new PRs, which is a useful nudge and nothing more.

## Later

When Bob is reviewing regularly, raise required approvals back to 1. His approval is valid on PRs I author — the constraint is only on approving your own work. At that point `require_code_owner_reviews` should stay off, or Bob should be added to `CODEOWNERS`, otherwise we're back to needing an approval only I can give.
