# Working on Junga Workspace

These instructions apply throughout the repository.

## Start here

- Read `README.md`, `CONTRIBUTING.md`, `docs/HANDOFF.md`, and the relevant items in `sharedProjectManagement/taskList.md`. Read only the feature records/source needed for the assignment.
- Tyler is the product manager, UI designer, and final authority. Follow the assigned role; if present, read the owner's team instructions in `ProductManagement/` for additional context.
- `ProductManagement/` is read-only for agents. Do not edit, delete, move, or stage its files, including pre-existing owner changes.

## Work independently and coordinate

- Check `git status`, fetch the remote, and work on a focused `codex/<topic>` branch. Use a separate clone or worktree for concurrently active agents; do not switch another agent's working directory underneath it.
- Start from `main` after the initial application PR is merged. Before that, follow the bootstrap instructions in `CONTRIBUTING.md`; remote `main` may contain only the initial documents.
- Record the task, branch, scope, and relevant GitHub issue/PR in the shared task list. Avoid taking over work another collaborator has claimed. Raise conflicting product decisions with Tyler.
- Fill ordinary implementation gaps and keep moving without waiting for Tyler to read routine updates. Ask when missing information materially changes the outcome.
- Preserve other contributors' edits. Stage only your work; avoid unrelated refactoring, history rewriting, or force pushes.
- Keep tasks and token use proportional to the request. Use `docs/REFINEMENTS.md` for minor UI changes. Flag substantial usage before expanding the work.

## Validate and document

- Use Node.js 24 and `npm ci`. Run `npm run check` and browser checks appropriate to code changes; all PRs run the repository's CI.
- For documentation-only edits, validate links and the diff. Do not add tests that merely duplicate cosmetic implementation details or rerun unaffected suites without reason.
- Add one concise requested-feature record under `sharedProjectManagement/features/`, using the existing four-section format; update an existing record when extending that feature.
- Keep your daily/weekly snippets in `docs/WORK_LOG.md`, novel decisions in `docs/DECISIONS.md`, and next steps in the shared task list. Summarize reasons and outcomes, not internal deliberation.
- Never commit credentials, local library backups, generated builds, dependency folders, or test artifacts. Browser project data is not synchronized by Git; use the app's explicit backup/restore workflow when a transfer is requested.

## Handoff

- Commit and push the implementation branch, then open/update a PR with the problem, resulting behavior, validation, and remaining limits. Include screenshots when they help review a UI change.
- Agents may create branches and PRs independently. Merges, releases, deployments, and bypassing branch rules require Tyler's explicit decision and the designated supervisor's coordination.
- Leave a reviewable result and a concise handoff. Do not enable automatic merging or deployment as a side effect of a feature request.
