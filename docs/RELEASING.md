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
this checkout  ──push, PR, merge──▶  GitHub main  ──npm run deploy──▶  website repo ──▶ live site
```

## Part 1 — getting a change into `main`

1. **Branch.** Never commit to `main`; branch protection rejects a direct push because the commit
   has no passing check. `codex/<topic>` is the convention.
2. **Check locally before pushing.**
   ```sh
   npm run check && npm run test:e2e
   ```
   `check` is unit tests, TypeScript and a production build; `test:e2e` is the Chromium suite.
3. **Push and open a PR.** CI (`Application checks`) runs on every PR and every push to `main`:
   `npm ci`, `npm run check`, then the browser tests, on **Node 24**.
4. **Tyler reviews the diff on GitHub** and says yes in chat or in a PR comment. That is what
   approval means here — not GitHub's formal Approved state, which he cannot give himself on his
   own PRs. An agent never waits on that state.
5. **Merge, after his yes and with CI green.**
   ```sh
   gh pr merge <number> --merge --delete-branch
   ```
6. **Bring local `main` up to date**, because the merge commit was created on GitHub, not here:
   ```sh
   git checkout main && git pull
   ```

### Failure modes worth recognizing

- **`gh pr merge` prints a git error but the merge worked.** The merge is an API call; `gh` then
  tries to update this checkout, and that second step can fail on its own. Check
  `gh pr view <number> --json state` before assuming nothing happened.
- **`cannot pull with rebase: You have unstaged changes`.** `pull.rebase` is set globally, and git
  will not rebase over a dirty tree. When the incoming commits do not touch your modified files,
  fast-forward past it without stashing:
  ```sh
  git merge --ff-only origin/main
  ```
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
not publish. A per-PR preview build and a one-button deploy are both open questions (Q4 in
[`openQuestions.md`](../sharedProjectManagement/openQuestions.md)); the point of keeping them manual
for now is that nothing reaches the public site without someone choosing to put it there.
