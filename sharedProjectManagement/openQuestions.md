# Open questions

Big-picture questions that are not yet decided. This file is the holding place for
them: Tyler adds questions as they occur to him, answers accumulate underneath over
time, and once a question is actually settled the answer moves out of here — into
[the decision log](../docs/DECISIONS.md) if it constrains how the code is built, and
into [the task list](taskList.md) if it creates work.

Nothing in this file is a decision. Agents must not implement from it. The
**Initial read** blocks are the implementation agent's opinion, written to give Tyler
something to push against; they carry no authority and should be argued with freely.
The **Decision** line under each question is the only part that binds anything, and
every one of them currently reads *Open*.

Questions keep their numbers for the life of the project so chats and PRs can refer to
"Q3" and mean this. New questions get the next number, even when they belong to an
older section. Opened 2026-09-21.

---

## Product shape

### Q1 — Is Junga essentially a user interface for my computer?

The framing: like File Explorer, it is a project manager, but with built-in tools to
open and edit all sorts of files. It does not need to cover everything on the computer —
a user should be able to specify which folders are in the Junga Workspace.

**Why it matters.** This is the question the other ones hang off. Today the library is
its *own* store: projects live in browser local storage under one key, there is no
filesystem access, and work leaves only through an explicit JSON backup. The framing
above inverts that — the filesystem becomes the source of truth and the library becomes
an index over folders the user has nominated. That is a different application with a
different set of hard problems, and almost every open question below resolves
differently depending on which one Junga is.

**Initial read.** These are two coherent products and the project should name which one
it is:

- **Library-as-database** (today). Junga owns the data. Simple, portable, works from any
  browser, nothing to install. But every project is trapped behind an export, other
  tools on the computer cannot see the work, and "storage" is a browser origin that
  clearing site data destroys.
- **Library-as-index-over-folders** (the framing above). A project is a folder on disk:
  a manifest plus native files. Junga indexes nominated folders, opens what it has a
  tool for, and hands the rest to the OS. Git, backup, sync and interop with other
  applications stop being Junga's problems because they are already solved for files in
  folders. Export becomes close to a no-op, because the work is already files. The cost
  is that authoring now requires real filesystem access, which the browser-only
  prototype does not have.

My read is that index-over-folders is the stronger answer for a product whose stated
purpose is creation, storage and presentation, and that the two modes can coexist
cleanly if they are split by role rather than blended: **authoring is local and needs
the filesystem; presentation is a hosted read-only static build.** That split is already
half-built — the `dist/` subfolder hosting work is exactly the presentation half.

The closest existing model to copy is Obsidian's vault, not File Explorer: the user
nominates folders, the app indexes them, recognized file types open in built-in tools,
unrecognized ones are listed and handed off. Lightroom's catalog and VS Code's
workspaces are the other two reference points worth studying — Lightroom especially,
because it demonstrates the failure mode of an index that drifts from the files it
describes.

**Sub-questions to answer before this one can close.**

- How does the app get filesystem access? Three routes: the File System Access API
  (Chromium-only, directory handles persisted in IndexedDB, no Firefox or Safari);
  a desktop shell such as Tauri or Electron wrapping the same React app; or a small
  local companion process the browser app talks to. The third already has precedent
  here — designer mode's save endpoint (`src/design/server.ts`) writes
  `Design/settings.json` through exactly that pattern.
- What is a project *on disk*? A folder with a manifest plus per-tool documents is the
  obvious shape, and it makes projects diffable and git-friendly.
- What happens to files Junga has no tool for — listed and handed to the OS, or hidden?
- What happens to the browser-local libraries that already exist? Migration or
  coexistence.
- Does Junga ever *launch other applications*, or only open files it can handle itself?
  This is the line between a project manager and a shell.

**Decision:** Open.

**Notes and answers:**

_(add here)_

---

### Q2 — How does everything work with a user base that isn't just me?

**Why it matters.** Several early decisions are cheap now and expensive later — chiefly
the design system, which currently conflates *product defaults* (Tyler's, committed to
the repository in `Design/settings.json`) with *user preferences* (theirs, which would
have to live wherever their data lives). Multi-user also decides whether this project
ever takes on a server, and with it authentication, other people's data, privacy and
support.

**Initial read.** "Other users" is at least five separate questions wearing one coat,
and they do not have to be answered at the same time:

1. **Readers vs authors.** The first people who are not Tyler will encounter Junga as
   *readers* — a portfolio, a blog post, a published scene. Readers need no account, no
   storage and no sync; they need a static build at a URL, which mostly exists. Treating
   readers as the entire v1 multi-user story defers everything hard and still delivers
   the product's stated purpose.
2. **Distribution.** A hosted URL and a downloadable local app are different products
   with different install stories. If Q1 lands on index-over-folders, authoring needs the
   local one and reading needs the hosted one.
3. **Storage and identity.** Local-first with no accounts costs nothing and inherits no
   obligations. Sync can be somebody else's job for a long time — git, Syncthing,
   Dropbox on the workspace folder — which is honest rather than lazy, and it is only
   available at all if Q1 lands on real files. A server of record is the point at which
   this becomes a service rather than an application.
4. **Design authority.** Split the registry in two: values that are product design
   (shipped, Tyler's call) and values that are user preference (theirs, stored with their
   data). Deciding which fields are which is a one-pass job now and an archaeology
   project after a hundred users have saved settings.
5. **Sharing and publishing.** Export is the real multi-user surface: what a portfolio or
   blog post looks like to someone who will never install Junga, and where it is hosted.
   `tylergriffith.us/JungaWorkspace/` already exists as the first target.

**Decision:** Open.

**Notes and answers:**

_(add here)_

---

## Project management

### Q3 — How should workflow and change management work for making changes to this project?

The mechanics are already written down in
[changeManagementWorkflow.md](../ProductManagement/changeManagementWorkflow.md) —
one feature at a time, a branch per change, nothing direct to `main`, PR review in
GitHub, CI green, owner says yes, merge and delete. So this question is about what that
document does not yet cover.

**Why it matters.** The workflow is not currently rate-limited by git mechanics. It is
rate-limited by review: the task list carries ten or more items of the form "review X
together", and agents generate reviewable work faster than a single human reviewer who
is also the designer and the product manager can absorb it. Any change-management answer
that does not address review throughput is decoration.

**Initial read.** The open gaps, roughly in order of how much they cost:

- **Review throughput.** Reading an agent-sized diff on GitHub is the slowest possible
  way for a UI designer to evaluate a UI change. The leverage is in changing what gets
  reviewed, not how: a running preview per PR to click through, screenshots of what
  changed attached to the PR, and a short "try this" script the agent writes with the
  change. Reading the diff should be the fallback, not the method. See Q4.
- **Where the backlog lives.** `taskList.md` is the backlog; GitHub Issues exists and has
  a template but is unused. Two backlogs is worse than either one alone. Pick one, and if
  it is the markdown file, say so explicitly so agents stop reaching for Issues.
- **How many agents at once.** The workflow says sequential, one change at a time, but
  more than one agent already touches this repository. Either serialize deliberately
  (one open branch at a time, stated) or define ownership so two agents cannot rewrite
  the same registry in parallel.
- **Where decisions get recorded.** Right now a product decision could reasonably land
  in `DECISIONS.md`, in `ProductManagement/`, in a `features/` record, or in a PR
  description. Three of those four are wrong for any given decision and the rule is not
  written down.
- **What "released" means.** There is no version, tag or deploy step. `version` in
  `package.json` has read `0.1.0` since the beginning. Once anyone else is using this,
  "merged to main" and "what users have" stop being the same thing.
- **Which records are load-bearing.** The project maintains README, ARCHITECTURE,
  DECISIONS, WORK_LOG, HANDOFF, REFINEMENTS, taskList, per-feature records, and the
  ProductManagement material. Agents pay real time keeping all of them current, and a
  stale record is worse than a missing one. My read: ARCHITECTURE is the low-level
  instructional record, a high-level concepts record is the one genuinely missing,
  DECISIONS is the audit trail, taskList is the backlog, and `features/` holds per-feature
  rationale — while WORK_LOG and HANDOFF overlap heavily with each other and with
  DECISIONS and are the obvious consolidation candidates.

**Decision:** Open.

**Notes and answers:**

_(add here)_

---

### Q4 — What can we automate?

**Why it matters.** Automation pays for itself only where the same work repeats. In this
project the repeating work is review preparation, record upkeep, and deployment — which
is a useful filter for the long list of things that *could* be automated.

**Initial read.** What exists today: the "Application checks" workflow runs unit tests,
TypeScript, a production build and Chromium acceptance tests on every PR and every push
to `main`, cancels superseded runs, and keeps failed browser artifacts for seven days.
It does not deploy. Branch protection enforces that it passes.

Candidates, in my order of leverage:

1. **A preview build per PR.** Turns review from reading a diff into clicking a link and
   using the change. Highest-value single addition, because it attacks the actual
   bottleneck in Q3.
2. **Screenshots in the PR.** Playwright already drives the app; having it capture the
   screens a change touches and attach them means a UI reviewer sees the UI. A visual
   baseline later catches unintended drift, but even un-baselined screenshots help
   immediately.
3. **Deploy on merge.** Building `dist/` and publishing it to the
   `tylergriffith.us/JungaWorkspace/` subfolder is currently a manual copy. Merges and
   deployments stay the owner's decision, so the automation should be one button rather
   than automatic on merge.
4. **Record-freshness checks.** CI can fail a PR that adds a module registry entry
   without a `features/` record, or that changes `src/` without touching any record at
   all. Cheap, and it stops documentation rot at the point it starts.
5. **A persistence-compatibility suite.** "Saved projects and backups from earlier
   versions must keep loading" is a stated architectural principle. It should be a test
   that loads a fixture from every historical backup shape, not a promise — this one is
   worth checking against what the test suite already covers before building anything.
6. **Dependency updates.** Dependabot or equivalent, with the version pins this project
   uses and CI as the gate.
7. **Scheduled agent work.** A weekly digest of open PRs, stale task-list items and
   unreviewed decisions, posted where Tyler will read it. Cheap to set up and it keeps
   the review queue visible instead of silently growing.

Deliberately **not** automated, and worth keeping that way: merges to `main`,
deployments, and anything that decides product direction. Those are the owner's, per the
change-management workflow.

**Decision:** Open.

**Notes and answers:**

_(add here)_

---

## Parking lot

Questions Tyler has raised but not yet written up, and threads that came out of the ones
above. Promote to a numbered question when there is something to decide.

- _(add here)_
