# Releasing: merging to `main` and deploying the website

The end-to-end path a change takes from this checkout to `tylergriffith.us/JungaWorkspace/`,
with the commands and the failure modes that have actually bitten.

Where each rule lives, so nothing is stated twice:

| Question                                        | Authority                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| What the workflow is, and what "approved" means | [`ProductManagement/changeManagementWorkflow.md`](../ProductManagement/changeManagementWorkflow.md) (Tyler's; agents do not edit it) |
| Setup, checks, PR mechanics                     | [`CONTRIBUTING.md`](../CONTRIBUTING.md)                                                                                              |
| Agent conduct                                   | [`AGENTS.md`](../AGENTS.md)                                                                                                          |
| Why things are the way they are                 | [`DECISIONS.md`](DECISIONS.md)                                                                                                       |
| **How to actually ship** (commands)             | this file                                                                                                                            |

Three places hold this app, and they advance separately. Merging to `main` changes nothing on the
website; deploying the website changes nothing about what anyone has in their browser.

```
this checkout  ──commit, push──▶  GitHub main  ──npm run deploy──▶  website repo ──▶ live site
```

## The one-command path

Everything lives on one branch, `main`, so the whole path is linear and `scripts/ship.sh` walks
it end to end:

```sh
npm run status                       # report where the three copies stand, change nothing
npm run ship -- -m "What changed"    # the whole path, stopping at the first thing that is wrong
```

In order, `ship`:

1. fetches `origin` and, if the tree is dirty, commits everything with the message given
   (refusing a new file under `JungaLibrarySaves/` or over 5 MB);
2. fast-forwards to `origin/main`, or rebases the local commits onto it if the two diverged,
   and stops cleanly on a conflict;
3. runs `npm run check` (`--e2e` adds the Chromium suite);
4. pushes `main`;
5. waits for the `Application checks` run on that commit and stops if it is red or cancelled
   (`--no-wait` skips this; the local check is then the only gate);
6. runs `scripts/deploy.sh --live --prebuilt`: vendors the build it just made into the website
   repo, commits, pushes, and pulls on the host;
7. fetches the live page and confirms it serves the entry bundle that was just built;
8. prints the same status block as `npm run status`.

`--no-deploy` stops after GitHub. `--dry-run` prints the plan and changes nothing. It is idempotent:
when nothing is out of line it says so and exits. It is a command, not a trigger — nothing runs it
except a person asking for it (see "Deliberately not automated").

## Part 1 — getting a change into `main`

`ship` does this for the normal case. What it relies on, and the path for when a change wants
review before it lands:

- **Direct pushes to `main` are accepted.** Branch protection requires the `Application checks`
  status, but `enforce_admins` is off and Tyler's account is the repository admin, so a push from
  his machines lands and CI runs on it afterwards. Since September 24, 2026 that is the normal
  path: one branch, commits on `main`, fast-forwarded between machines and agents.
- **A PR is for review, not for mechanics.** When a change is large or uncertain enough that
  Tyler wants to read it on GitHub first, branch (`codex/<topic>` is the convention), push, open
  the PR, and merge with `gh pr merge <number> --merge --delete-branch` once he says yes in chat
  or in a PR comment. That is what approval means here — not GitHub's formal Approved state,
  which he cannot give himself. Then `git checkout main && git pull` here, because the merge
  commit was created on GitHub, and delete the branch so nothing vestigial is left to diverge.
- **Check locally before pushing.** `npm run check` is unit tests, TypeScript and a production
  build; `npm run test:e2e` is the Chromium suite. CI runs both on every PR and every push to
  `main`, on **Node 24**.

### Failure modes worth recognizing

- **`ship` stops at "diverged" with a conflict.** Two machines committed on `main` without
  syncing. Resolve by hand (`git rebase origin/main`, fix, `git rebase --continue`) and re-run
  `ship`; it picks up from wherever it stopped.
- **`ship` stops at "CI finished with 'cancelled'".** A newer push to `main` superseded this
  run (the workflow cancels obsolete runs). Sync and ship again from the newer commit.
- **`gh pr merge` prints a git error but the merge worked.** The merge is an API call; `gh` then
  tries to update this checkout, and that second step can fail on its own. Check
  `gh pr view <number> --json state` before assuming nothing happened.
- **`cannot pull with rebase: You have unstaged changes`.** `pull.rebase` is set globally, and git
  will not rebase over a dirty tree. `ship` avoids this by committing first; by hand, when the
  incoming commits do not touch your modified files, `git merge --ff-only origin/main`.
- **Local `main` is stale after any merge** until you pull. The deploy script publishes whatever is
  checked out, so a stale checkout silently publishes old code — which is why it refuses to run on a
  commit that is not on `origin/main`.
- **Node here is newer than Node 24.** CI is the authority; if a build ever differs, trust CI.

## Part 2 — deploying to the website

`tylergriffith.us` is the repo [`tyler-grffith/ProfessionalWebsite`](https://github.com/tyler-grffith/ProfessionalWebsite),
checked out as a sibling directory (`../tylergriffith.us`). It has **no build step**: it vendors this
app's built output as plain static files under `JungaWorkspace/`, and the live server updates by
pulling that repo (decision 33).

```sh
npm run deploy             # check, build, vendor, commit in the website repo — nothing leaves this machine
npm run deploy -- --push   # also push the website repo to GitHub
npm run deploy -- --live   # also ssh to the host and git pull, so it is actually live
```

`ship` calls this with `--live --prebuilt` (vendor the `dist/` it just checked and built, without
building again). Run it directly when you want only the website half, or want to look at the
website repo's diff before anything leaves the machine.

The three stages are separate on purpose, so you can look at the diff in the website repo before any
of it is public. Nothing deploys as a side effect of a feature change: per `AGENTS.md`, an agent runs
`--push` or `--live` only when asked to deploy.

What the script refuses to do, and why:

| Refusal                        | Reason                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| Working tree here is not clean | what is published must be a commit, not an uncommitted edit                |
| `HEAD` is not on `origin/main` | GitHub never saw it, so CI never ran on it (`--allow-unpushed` overrides)  |
| `npm run check` fails          | a failing build must not reach the site (`--skip-checks` overrides)        |
| No git repo at `WEBSITE_REPO`  | the destination is wrong; set `WEBSITE_REPO` if your checkout is elsewhere |

It warns rather than stops when deploying from a branch other than `main`, and exits cleanly with no
commit when the vendored output already matches the build.

Other environment variables: `DEPLOY_SSH_HOST` and `DEPLOY_SSH_DIR` for the `--live` step.

### After deploying

Open `https://tylergriffith.us/JungaWorkspace/` — keep the trailing slash, or the relative asset
paths resolve against the parent folder. Check the version you expect is live; the deploy commit in
the website repo names the source commit (`Deploy Junga Workspace @ <sha>`), so the two repos can
always be lined up.

Publishing the app does **not** publish projects. The library lives in browser storage per origin, so
the live site has its own empty library, separate from `localhost`. Moving projects between them means
**Download library backup** and **Restore library backup**.

## Deliberately not automated

Merging and deploying stay decisions, not triggers. CI does not deploy, and a merge to `main` does
not publish. `npm run ship` is the one-button deploy that Q4 in
[`openQuestions.md`](../sharedProjectManagement/openQuestions.md) asked about, but it is a button:
nothing presses it except Tyler, in chat, after the work is done. The point is still that nothing
reaches the public site without someone choosing to put it there; what changed is that choosing
costs one command instead of six.
