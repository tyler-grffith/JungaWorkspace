# Collaborating on Junga Workspace

Repository: https://github.com/tyler-grffith/JungaWorkspace

## First checkout

Install Git and Node.js 24 LTS. Contributors with direct repository access should authenticate their own GitHub account (for example, `gh auth login` and `gh auth setup-git`). Do not copy tokens between computers or put them in the repository.

**Before [the initial application PR (#1)](https://github.com/tyler-grffith/JungaWorkspace/pull/1) is merged**, the runnable prototype is on `codex/github-collaboration`:

```sh
git clone --branch codex/github-collaboration https://github.com/tyler-grffith/JungaWorkspace.git
cd JungaWorkspace
npm ci
npm run dev
```

**After Tyler merges the initial application PR**, use an ordinary clone of `main`:

```sh
git clone https://github.com/tyler-grffith/JungaWorkspace.git
cd JungaWorkspace
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The app requires no service credentials. These commands work in PowerShell, macOS, and Linux shells. `npm run dev` exposes the local designer panel; `npm run build` creates the user-facing build without designer access.

## One branch per assignment

Read `AGENTS.md`, the current handoff, and the shared task list before editing. Choose a focused assignment and record its branch and scope. Use an issue for discussion/assignment when useful, and link it from the task list rather than maintaining two copies of every priority.

Once the initial PR is merged, start work with:

```sh
git switch main
git pull --ff-only
git switch -c codex/short-topic
```

During bootstrap, create the feature branch from `codex/github-collaboration` instead. Coordinate dependent work against that branch until it reaches `main`; the setup PR remains the single proposed application baseline.

Each agent working concurrently should use a separate clone or worktree. Share committed changes through pushes and PRs, not by editing another agent's checkout. Preserve other people's changes and avoid force pushes. Fetch and integrate the current base before review; resolve conflicts on the feature branch.

## Checks and pull requests

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

On Linux, browser dependencies may also be needed: `npx playwright install --with-deps chromium`. Browser tests reserve ports 4173 and 4174 and use isolated browser data; designer-save tests write an ignored fixture. The development app uses port 5173. Documentation-only local changes need a diff/link check; CI still validates the complete application on the PR.

Stage only the files for your assignment, commit, then push your branch. For example, after replacing the branch name:

```sh
git push -u origin codex/short-topic
gh pr create --base main
```

If you do not have direct write access and the repository is public, use a fork and submit a PR. A private repository requires an invitation before cloning. For agents on Tyler's other computers, authenticating the same GitHub account needs no collaborator invitation. Other humans should use their own accounts; Tyler chooses who receives write access. Never share Tyler's credentials with another collaborator.

The CI workflow checks dependencies, unit tests, TypeScript/build, and Chromium behavior/accessibility on a GitHub-hosted Linux runner. PR updates cancel obsolete runs. It has read-only repository permissions and no deployment step. Failed browser runs retain test artifacts for seven days. Untrusted fork workflow runs can require owner approval through GitHub.

## Review and ownership

Tyler retains product, merge, and deployment decisions. `CODEOWNERS` requests his review for repository changes once that file reaches the PR's base branch. Required reviews cannot be supplied by the PR author; owner-authored bootstrap work needs another authorized reviewer or an explicit owner decision using GitHub's administrator override. Agents must not use that override on their own.

Main-branch protection is enabled: it requires a current passing `Application checks` result, a review, code-owner review, resolved conversations, and no force push or deletion of `main`. The owner retains administrator control. Agents authenticating as the owner inherit that account's rights; GitHub cannot distinguish the agent from Tyler. Use separate accounts or a narrowly scoped GitHub App if independent permission boundaries become necessary.

The applied settings are recorded in `.github/main-protection.json`. That file documents the policy; changing it does not apply settings automatically. Check GitHub's branch settings and the latest handoff for subsequent changes. Required review of `CODEOWNERS` changes takes effect after the file reaches `main`.

`ProductManagement/` belongs to Tyler. Agents must not modify or stage its contents. New owner documents and examples only reach collaborators when Tyler commits them; local uncommitted files are not included in a push of this implementation branch. Feature records and shared agent updates belong in `sharedProjectManagement/` and `docs/`.

## Project data on another computer

Git shares source code, committed design settings, and documentation. Projects created in the running app remain in that browser's local storage. To move a library, explicitly download its backup in the source browser and restore it in the destination browser. Keep those backups outside the repository. Locally created project URLs in older handoffs are not portable; create the built-in examples on the new computer instead.

Use [the task list](sharedProjectManagement/taskList.md) for next work and [small refinements](docs/REFINEMENTS.md) for inexpensive UI changes.
