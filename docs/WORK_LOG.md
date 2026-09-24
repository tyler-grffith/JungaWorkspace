# Shared agent updates

Keep entries short: outcome, verification, next step, and meaningful decisions. This file is maintained by the implementation agent until roles are split.

## Daily — September 18, 2026

- Started the authorized first increment on `codex/library-prototype`. Preserved existing, uncommitted ProductManagement changes.
- Read the updated instructions and example notes. Inspected the shared LaPlace Intuition graph: composed exponential/sine functions, restricted domains, two sliders, and a text note.
- Completed local library organization, project lifecycle, notes, reference links, search/filter/sort, grid/list browsing, and recoverable trash. Calculator/spreadsheet editors follow in separate increments.
- Verification: 10 domain/storage unit tests and 10 Chromium browser tests pass. Browser coverage includes reload persistence, collections, duplication, archive/trash restoration, backup download, sequential cross-tab updates, corrupt storage, failed writes, draft protection, keyboard dialogs, accessibility, and a 390px viewport. TypeScript and production build pass.
- Visual review completed for the empty library and LaPlace Intuition project. Increased small text size and contrast, corrected dialog focus, and labeled page landmarks after testing.
- Added a pull-request CI workflow with read-only repository permissions and no deployment. It has not run on GitHub yet.
- Created the optional LaPlace Intuition reference project in the local review browser. It contains source notes, not an imported working calculator. The preview runs at http://127.0.0.1:5173.
- Decision rationale and unreviewed choices are in DECISIONS.md. Current scope and next steps are in HANDOFF.md.
- Started maintaining `sharedProjectManagement/taskList.md` at the owner's request: proposed next steps, deferred capabilities, example-driven follow-ups, and completed baseline. Linked it from the handoff so priorities have one shared home.
- At the owner's request, built graphing next on `codex/graphing-calculator`, branching from the library checkpoint. Recreated the LaPlace example with its five dependent functions, restricted domains, sliders p/a, and graph notes; preserved existing project notes and metadata.
- Added editable expressions, explicit parameter/constant controls, colors/labels/visibility, undo/redo, pan/zoom, bounds, grid, and hover values. Chose a bounded numeric grammar and SVG sampling to keep this increment focused on the example. Detailed rationale and limits are in DECISIONS.md.
- Added versioned graph payloads to projects without invalidating older records. Graphs survive duplicate/archive/trash/restore and backup download. Failed writes retain the graph draft and protect navigation; invalid formulas are isolated from valid curves.
- Verification: all 24 unit tests and 17 Chromium browser tests pass across the initial run and targeted reruns. Fixed calculator/help text contrast and an incorrect menu locator in the tests. Browser coverage includes sliders updating plotted paths, expressions/dependencies, notes/labels, saved viewport, constants/range validation, pointer/keyboard controls, undo/redo, lifecycle preservation, cross-tab updates, failed writes, expanded-control accessibility, and a 390px viewport. TypeScript and production build pass.
- Visually inspected the calculator in the local browser, including the five curves and parameter panel. The existing LaPlace project now opens as a working calculator. Updated the shared task list with completion and concrete UX/math follow-ups. No ProductManagement edits, remote push, merge, or deployment.
- Usage check after implementation: 43% of the account's weekly allowance used, 57% remaining. This is an account-wide measure, not exact per-task token attribution.
- At the owner's request, built the spreadsheet on `codex/spreadsheet`. Read-only inventory of the engineering example found 22 worksheets, extensive arithmetic/trigonometry, and named function calls. Kept the first editor to a single bounded worksheet; recorded multi-sheet/custom-function work for prioritization.
- Added grid and formula-bar editing, range selection, clipboard copy/paste, relative/fixed references, aggregate/logical/engineering formulas, fill down/right, basic formatting, column resize/autofit, grid growth, and session undo/redo. Spreadsheet data is independent from graph data and participates in project lifecycle/backups. Added an optional native motion example.
- Verification: 40 unit tests pass. All 26 Chromium browser tests pass across the full run and targeted spreadsheet reruns after fixing focus/selection synchronization. New checks cover recalculation, reference translation, clipboard/formatting, errors, reloads, duplication, trash/read-only behavior, backups, separate tool data, failed-save drafts, pending-edit navigation protection, cross-tab updates, and desktop/mobile accessibility. TypeScript and production build pass.
- Visually reviewed the working Motion model in the local browser and preserved all existing projects. Updated task list, decisions, and handoff. No ProductManagement edits, remote push, merge, or deployment. Latest account-wide usage check: 50% of the weekly allowance remains.

- Implemented the owner's approved backup/recovery flow on `codex/backup-recovery`: version/structure/size validation, content preview, independent copies with collection remapping, explicit replacement, download of current/raw data, and stale-preview checks. Chose a single validated storage write so failed restoration leaves current data intact.
- Backup downloads now include retained notes/graph/sheet drafts, including unfinished spreadsheet cells. Preserved the last readable state through storage errors and required explicit disposal of drafts during restoration. Raw-data downloads stay unchanged; no automatic backups or version history added.
- Verification: 48 unit tests and all 38 browser tests pass across the full run and targeted reruns. Fixed two test expectations for formatted numbers and made the preview list keyboard-scrollable after accessibility feedback. Tests cover fresh-browser round trips, lifecycle and tool content, invalid/oversized files, replacement acknowledgment, canceled/failed restoration, unavailable storage, stale cross-tab previews, draft downloads, recovery after unreadable storage, and desktop/mobile accessibility. TypeScript and production build pass; visually inspected the preview. Tests used isolated storage, preserving the user's live library.
- Updated shared task list, decisions, README, and handoff. No ProductManagement edits, remote push, merge, or deployment. Account-wide weekly usage is 54% used / 46% remaining, compared with 50% remaining after the spreadsheet increment.

- At the owner's request, started integration on `codex/linked-workspace`. Read the spreadsheet-integrated Desmos reference in the browser: six pairs (a,b), (c,d), (f,g), (i,j), (k,l), (m,n), with s = 5, h = sqrt(3)*s/2, t = 0.323 in [0,1], and a closed outline. Recreated its exact equations in native cells; did not modify the reference or ProductManagement.
- Added a side-by-side view, named cells, numeric cell sliders, and graph series linked to x/y ranges. Chose spreadsheet cells as the source of truth, preserving separate stored tool documents. Invalid coordinates produce messages and break lines; equal axis scale preserves the geometry. General expressions still use their own graph variables. Recorded limits and undo refinements in the decision/task logs.
- Verification: 54 unit tests and all 45 browser tests pass across the full run and targeted reruns. Numerical checks cover all six vertices at multiple s/t values and slider endpoints, dependency cycles, bad rows, axis scaling, validation, and backup round trips. Browser checks cover generic configuration, bidirectional slider/cell updates, duplication/trash, failed-save rescue, cross-tab updates, and desktop/mobile accessibility. Corrected a test's numeric-display precision expectation; compacted the layout after visual review and verified expandable formatting. TypeScript and production build pass.
- Created the first Octahedron Sections instance in the owner's live library (project `614d3eb1-2bcf-43b1-8bd5-814ff1c9b091`) through the app, preserving all existing projects. Updated task list, decisions, README, and handoff. No remote push, merge, or deployment. Account-wide weekly usage check: 61% used / 39% remaining; this increment is complete rather than expanding further.

- Implemented the six calculator browser comments on `codex/graph-interactions`: Formulas naming, ordered pairs, implicit curves, mouse/touch/keyboard ordering, parameter animation, color swatches, and draggable curve labels with text/size/angle management. Reused graph dependencies and backward-compatible optional preferences. Bounded numerical contour work; preserved defaults and validation for older graphs/backups. Playback groups undo and pauses on edits, hidden tabs, or failed saves.
- Verification: 64 unit tests and 53 Chromium browser tests pass across the full run and targeted reruns. Fixed popup semantics and selected-swatch contrast from accessibility checks, preserved reverse direction across pause/resume, and verified touch drag. Tests cover new plot calculations, pole rejection, operation limits, label projection/style persistence, backup round trips, undo, and failed-save recovery. Production build passes. Visually reviewed the existing live calculator and label popup without editing its saved content. Updated shared task list, decisions, README, and handoff; owner material and new owner feature files remain untouched. Account-wide usage check during this increment: 65% weekly used / 35% remaining. No remote push, merge, or deployment.

- Adopted the owner's feature-record format in `sharedProjectManagement/features/`. Completed the implicit-equations example and added six concise records for the latest calculator changes; documented the ongoing convention in the task list and handoff. Checked section consistency and links; documentation only, so no application tests rerun.

## Daily — September 19, 2026

- Built designer/user mode switching on `codex/designer-mode`. The development panel previews label control variants, popup geometry, graph layout, and shared appearance; accepted settings save to `Design/settings.json`. Typed decimal angles now survive graph saves/backups. The sample uses the real label controls without modifying a project.
- Added a short refinement-note handoff and a focused agent protocol, plus feature records and review follow-ups. Recommend a reusable lightweight task for batches; no subagent or new task was started.
- Verification: 67 unit tests, TypeScript/build, and all 58 browser tests pass across the full run and targeted reruns. Browser coverage includes preview/revert/reload, independent-session saves, stale revisions, rejected requests, decimal label persistence, clipboard handoff, production exclusion, desktop/mobile layout, and accessibility. Fixed test selector assumptions and the sample SVG's accessibility role.
- Visually reviewed the live panel and sample. Saved a temporary width change through the real local endpoint, verified the repository file, and restored the initial width. Project content and ProductManagement were not modified. Usage check during work: 72% weekly used / 28% remaining, account-wide. No merge or deployment.

## Daily — September 20, 2026

- Began GitHub collaboration setup on `codex/github-collaboration`. Verified the existing public `tyler-grffith/JungaWorkspace` repository, working GitHub CLI access, initial-only remote main, no open PRs/branch protection, and read-only Actions token defaults. Asked Tyler about visibility before publishing the working app, and which collaborators to invite.
- Added portable agent/contributor guidance, ownership and PR/issue templates, Node 24/text-file conventions, and a reviewable main-protection policy. PR CI now covers all contributors, cancels obsolete runs, and has no persistent checkout credentials or deployment step. Owner material remains untouched.
- Local validation: 67 unit tests, TypeScript, production build, and diff checks pass. Tyler confirmed public visibility and named `bobjunga`; published the full prototype on `codex/github-collaboration`, opened [PR #1](https://github.com/tyler-grffith/JungaWorkspace/pull/1), and sent the write-access invitation (acceptance pending).
- Applied and verified main-branch protection with required current checks, one review/code-owner review, resolved conversations, and blocked force pushes/deletion; owner administrator override remains available. The [first clean Linux run](https://github.com/tyler-grffith/JungaWorkspace/actions/runs/35526016977) passed the full dependency installation, unit/TypeScript/build, and browser suite. Current commit results are available through the PR's Checks tab. No merge or deployment was performed.

- With Tyler's explicit approval, committed the existing ProductManagement documents and examples, including the owner-provided ODT deletion, without editing their contents. This was a local commit only; no application code changed and tests were not rerun.
- Tyler subsequently requested publication of that commit to GitHub. Updated the handoff for `codex/github-collaboration` and PR #1; this update contains documentation and owner-provided examples only, with no merge or deployment.

- Assessed the repository state for Tyler and asked about developer mode scope, production access, PR #1, module order, portfolio/blog shape, and roles. Tyler: same tool as designer mode, agent decides scope and access for now, merge PR #1, modules chosen one at a time, portfolio/blog both in-app and exported with generic hosting, agents are peer developers who document their philosophy in markdown.
- Attempted the PR #1 merge as instructed; the session's permission mode blocked the admin merge, so it remains Tyler's one-line command. Started `codex/extensible-baseline` from the PR branch.
- Added module/example registries (`src/modules/`) and rebuilt design settings as a declarative registry with six groups and thirty-eight fields; the panel, validation, CSS variables, and saved-file shape derive from it. Older `Design/settings.json` files complete with defaults. Wrote `docs/ARCHITECTURE.md`, made workflow docs tool-neutral, and updated feature records.
- Verification: 73 unit tests, TypeScript, and the production build pass. Browser suite result is recorded in the PR.

## Weekly — week of September 14, 2026

- Published the shared GitHub baseline in PR #1, enabled main-branch protection, and invited `bobjunga`. Agents and people use separate branches and PRs, with owner-controlled merges and deployment decisions. The public bootstrap branch is ready to clone before the initial merge.

- Delivered working first versions of all three MVP components, manual backup recovery, spreadsheet/graph integration through Octahedron Sections, calculator interactions, and direct designer refinement controls. Current verification covers 67 unit and 58 browser tests. Shared priorities focus on hands-on review, the first remote PR/CI cycle, and example-driven refinements before October 15. External import and broader integration remain deferred. No merge or deployment performed.

## Daily — September 20, 2026 — Cosmic Clock integration

- Integrated the existing p5.js project on `codex/cosmic-clock-outputs` in an isolated Junga worktree. Added backward-compatible project types, owned scene definitions, a concrete source inventory, explicit defaults/metadata editing and an optional creation template. Bundled assets and licenses; no repository editor or iframe.
- Separated authoring from the nested viewer route. Camera, clock and zone interaction cannot commit library changes. Added cancellation and disposal for imports, requests, events, observers, p5 canvases and GPU contexts. Preserved output content through project lifecycle and backups, with independent copied output IDs.
- Node 24 `npm ci` and pinned dependency installation completed. `npm run check` passes: 87 unit tests plus TypeScript/build. All 63 browser tests pass across the full run and targeted reruns. Corrected select/date test locators, mobile template-action overflow and clock renders resetting partially entered dates. Verified desktop/mobile accessibility, metadata editing, unchanged persisted defaults, reloads and cleanup during loading/repeated visits. Manual preview confirmed day/night textures and city lights, India picking, Nepal local time and return cleanup.
- Updated feature record, decisions, task list and handoff. Source editing/synchronization, further scene kinds and named authored presets remain separate work. No ProductManagement edits, existing-library mutation, commit, push, PR, merge or deployment. Original Junga checkout stays clean.

## Weekly snippet — week ending September 20, 2026

- Junga now has its first code project with an interactive-scene output, while ordinary project/tool workflows and old backups remain compatible. Ready for Tyler to review source/output ownership, editable starting defaults and the dark Earth Clock viewer. Source files remain repository-managed.

### September 20 follow-up — portable hosting paths

- Added Vite’s relative base, fixed the runtime logo and HTML entry/favicon references, and documented uploading `dist/` into any website folder. Confirmed `src/main.tsx` local imports already resolve correctly and the built entry points to a relative JavaScript bundle.
- Node 24 `npm ci` and `npm run check` pass (87 unit tests/build). Eleven targeted browser tests pass, including real production-build tests under a nested directory/direct index URL with no root asset fallback; existing scene and designer behavior remains passing. Feature/task/handoff updated; no deployment, library transfer or ProductManagement edits.

Weekly addendum: the integrated Junga build is now portable to a personal-site subfolder without a folder-specific rebuild.

## Daily — September 21, 2026 — Branch consolidation into `main`

- At Tyler's explicit direction, merged all three outstanding branches into `main` via `gh pr merge --admin`, in order: PR #1 (GitHub collaboration baseline, clean fast-forward), PR #2 (extensible baseline, clean rebase), PR #3 (Cosmic Clock outputs + subfolder hosting, committed from the previously-uncommitted worktree, then rebased onto post-registry `main`).
- Rebasing PR #3 produced real conflicts in `src/App.tsx` and `src/library.ts` (both branches had independently modified project-type handling and tool rendering); resolved by hand, keeping the registry-driven module/example rendering and layering the Code project branch on top.
- `tests/cosmic-clock.spec.ts`'s reload test needed `test.setTimeout(90000)`: it exceeded the default 30s limit on GitHub Actions' software-rendered runner (passed locally without the extension).
- Deleted the standalone `Cosmic Clock` repo that had been copied into this repo's working tree (superseded by `src/interactive-scenes/cosmic-clock/`) and its stray duplicate of the integration worktree, and removed the `~/Work/Creative Code/Cosmic Clock/junga-integration` git worktree and the three merged branches (local and remote).
- Verification on `main`: `npm run check` passes (93 unit tests, TypeScript, build); all 65 Playwright tests pass (chromium + designer projects); manual check confirmed the Cosmic Clock project → Earth Clock output flow renders correctly.

## Daily — September 21, 2026 — Code project module

- Added `code` as a third module (`src/code/`): a file workspace with a folder tree derived from paths, CodeMirror 6 editing, create/rename/delete/import, an entry file, and a live Run preview; plus `code-run` outputs that open the project's files on the existing output route.
- Running uses no server and no build step: data URLs for every non-entry file and an import map for the project's own relative specifiers, inside a frame sandboxed without `allow-same-origin`. A console panel forwards logs and errors out of the frame, and modules carry `sourceURL` so failures name the project file.
- Cosmic Clock is untouched: `projectType: 'code'` still owns its manifest and `interactive-scene` output; only the form's label changed to "Bundled source project". `validOutput` became a discriminated union over both output types.
- CodeMirror is loaded lazily, keeping the initial bundle at 449 kB (from 423 kB) with a separate 606 kB editor chunk, rather than the 1,057 kB a static import produced.
- Verification: `npm run check` passes (114 unit tests, TypeScript, build); all 69 Playwright tests pass (65 chromium including 4 new code-project tests, 4 designer). Browser check confirmed the editor, a multi-file import chain, the console panel, and the output route. Found and fixed two real defects on the way: bare relative references such as `href="styles.css"` were not resolved, and the output page's `<main>` collided with a landmark inside a running project (axe `landmark-unique`).

### September 21 follow-up — viewing bundled material

- Every file the Cosmic Clock manifest lists can now be opened read-only from **Working material**: application source through a narrow lazy `import.meta.glob` (one chunk per file, tests excluded), served assets through their normal URL, images previewed inline, and text over 120 KB truncated with a note plus a link to the complete file.
- The viewer reuses the code module's CodeMirror in read-only mode, which is the first reuse between the two features.
- Fixed a regression from the code-module commit: `CodeOutputs` rendered `className="code-outputs"`, the same class the Cosmic Clock overview uses, so the new card styles had replaced the Earth Clock card's globe artwork with the code artwork. The new styles are now scoped to `.code-run-outputs`.
- Main bundle 449 kB → 455 kB; raw source files are 3–15 kB chunks loaded on demand. 117 unit tests and 70 browser tests pass.

### September 21 follow-up — copying bundled files out

- A viewable text file now offers **Copy into**: an existing code project, or a new one started from that single file and named after the bundled project. Copies are numbered rather than overwriting, the whole file is copied even when the preview was truncated, and files a code project cannot store are refused with the reason.
- The confirmation names the project that was actually created and links to its files. A first pass reported the dropdown's label ("A new code project") instead, which the browser test caught.
- 120 unit tests and 71 browser tests pass, including a test that copies a module, opens it, edits it and reloads.

## Daily — September 23, 2026 — Visual canvas module

- Pushed the two deploy-hygiene commits as [PR #8](https://github.com/tyler-grffith/JungaWorkspace/pull/8) so `main` can catch up; branched `codex/canvas-module` from that branch so the new work descends from everything and merges without conflict.
- Read Tyler's five draw.io files (mission architecture, compressible flow, nuclear rocket cycles, wind-tunnel hardware, thermoelectric panel) and his Slides decks since October 2025 (posters, sticker sheets, business cards, wall art, lecture decks) to size the module: rich labels with sub/superscripts and serif fonts, connectors with waypoints and varied arrowheads, groups, gradients, embedded images, custom page sizes, and build steps.
- Built `canvas` as the fourth module: document model and validation, geometry (anchors, snapping, resize/rotate, keyframe interpolation), shared SVG rendering, the editor (stage, page strip, toolbar, inspector), the mode-aware presenter, `canvas-show` outputs, SVG/PNG/PDF export, draw.io import, a design-settings group, and library/backup wiring. Decisions 34–39.
- Verification: 133 unit tests, TypeScript, and the production build pass; the four new Chromium tests (drawing/connecting/editing/reload, slides and the output route with accessibility scan, draw.io import, SVG export) pass alongside the existing suites. Manual check in the dev browser: drew, connected, text-edited, and presented a slide with no console errors.
- Not built, recorded on the task list: PPTX and GIF export, an image asset store beyond local storage, mixed rich text within one element, master layouts, mockup components.

## Daily — September 24, 2026 — Document module

- Built `document` as the fifth module on `codex/canvas-module`, at Tyler's request to recreate Google Docs: block model with validation, one-contenteditable editor with our own structural edits and Docs-style shortcuts, outline, word/page counts, a reading output on the output route, Markdown/HTML/text/PDF export, Markdown/HTML/text import, images, and a design-settings group. Decision 40.
- Diagnosed the editor with a headless trace of the DOM after each keystroke: Chrome's `formatBlock`/list commands were leaving empty paragraphs and nesting lists inside the previous paragraph, and an emptied block could not hold the caret. Replaced those commands with DOM helpers (`src/document/blocks.ts`) and made the parser drop childless elements.
- Verification: unit tests for the model, Markdown round trip, and library wiring; two Chromium tests (writing/formatting/lists/reload with an accessibility scan; links, Markdown export, and the reading output). Full `npm run check` and browser suites rerun before the push.

### September 24 follow-up — Collection module and the shared editor host

- Built `collection` as the sixth module at Tyler's request: nested collections as a graph over a shared item pool (shared children and items, loop-safe), per-collection fields with presets (Music, Movies, Photography, Poems, Books, Ideas), quick add from a title or a pasted link with YouTube covers, in-place editing, grid/list/gallery layouts, a browse output, Markdown and JSON export, JSON import. Decision 42.
- Before wiring it, replaced the per-module plumbing in `App.tsx`, `library.ts`, `backup.ts`, and `OutputPage.tsx` with a document-module registry (`src/modules/documents.ts`, `src/modules/editors.tsx`) and moved canvas and document onto it, so each further module is two registry entries. Decision 41. All existing suites pass unchanged apart from the renamed editor props.
- Verification: unit tests for the collection graph, item sharing, unlink semantics, YouTube covers, Markdown, validation, and library wiring; two Chromium tests (curating nested collections with a shared item through reload with an accessibility scan; browse output and Markdown export).

### September 24 follow-up — 3D modeler and slicer prototypes

- Built `src/workbench/` (declarative desktop shell with menus, command tabs, tree/settings panel, generated property panels, viewport with view toolbar, status bar, isometric box projection) and used it for two document modules: `modeler` (SolidWorks-shaped: sketches, extrude/revolve/cut/hole/fillet/chamfer/shell/mirror/pattern/plane with parameters, suppress, undo, rebuild, orientations, display styles, section, mass properties, measure, material, appearance, units) and `slicer` (Bambu-shaped: printer/filament/process settings, plates with box objects, arrange/clone/delete, slice estimate, layer preview, simulated device, project notes). Read-only model and plate views on the output route. Decisions 43 and 44.
- Verification: unit tests for the modeler solids and mass, the slicer arrange and estimate, the projection helpers, and registry wiring; two Chromium tests walking sketch → extrude → hole → suppress → mass properties and add → clone → settings → slice → preview → print, both with accessibility scans.

### September 24 follow-up — Revision pass and real geometry

- Revision pass at Tyler's request ("fast and efficient without sacrificing functionality, interconnect what should be interconnected"): lazy module editors and viewers (main bundle 911 → 509 kB), deferred library writes with flush on navigation and unload (`src/modules/useDeferredSave.ts`), the `related` handle on `EditorProps`, cached text measurement and memoized thumbnails in the canvas, single-pass collection counts, clipboard images in and out, and Junga project links in collections. Decision 45.
- Replaced the modeler's and slicer's placeholder boxes with a shared mesh layer (`src/workbench/geometry.ts`), a canvas viewport with orbit/pan/zoom/fit/picking/dragging (`src/workbench/Viewport3D.tsx`, replacing `Isometric.tsx`), a real feature rebuild in the modeler (`derive`, `printableMesh`, STL export, **Send to Slicer**), and a real slicer (`src/slicer/slicing.ts`: layers, walls, infill families, solid surfaces, brim, estimates, G-code; STL import; **Import from Modeler**; drag objects on the plate). Decision 46.
- Verification: 154 unit tests (new `geometry.test.ts`; rewritten workbench tests check volumes, loops, offsets, STL round trip, decimation, slicing structure, G-code, mesh objects), 77 Playwright tests including a new cross-module test (model → Send to Slicer → STL import → drag → export), `npm run check`; manual pass in the dev browser (sketch, extrude, hole, orbit, send to slicer, slice, preview).

### September 24 follow-up — PLA Painter

- Built `painter` as the seventh module at Tyler's request ("analogous to Chroma Canvas and HueForge"): image in, filament stack with transmission distances, colour ramp, per-pixel layer heights, printed preview, heightmap, painted 3D relief, swap plan, print sheet, STL and PNG export, and **Send to Slicer** (relief on the plate, swap plan in the notes). Decision 47.
- Verification: unit tests for validation, stack normalisation, even spacing, the ramp, painting, the relief mesh's closedness and volume, downsampling, and the print sheet; two Chromium tests (import → paint → recipe edits → stack edits → exports → send to slicer with an accessibility scan; the print sheet output) alongside the existing suites; manual pass in the dev browser.

### September 24 — Merged into `main`

- Full verification (Prettier, 157 unit tests, TypeScript, build, 84 Playwright tests; CI green on both PRs), then `main` fast-forwarded `919f02b..a866d73` and pushed. PR #8 registered as merged; PR #9 shows closed because its base branch was deleted first, with a comment recording the fast-forward. Both feature branches removed. No deployment.

### September 24 follow-up — Built-in examples open, never copy

- At Tyler's request, example shortcuts now open the project they made before instead of creating another copy: `exampleId` on projects, `findExampleProject`/`openExampleProject` in `library.ts` (restore from trash, recognise untagged older instances, copies stay untagged), and one **Examples** menu in the library heading in place of the Cosmic Clock and octahedron buttons. Decision 48.
- One example per kind of project: XJ-1 Flight Envelope (graph, from the Desmos model), Compressible Flow Calculator (sheet, from the engineering workbook), Orbit Sketch (code files with a run output), PDR Visuals (canvas, imported from the bundled draw.io file), Pre-Development Plan (document, from the Google Doc), Workspace Ideas (collection), Mounting Bracket (modeler + slicer), Sunset Relief (painter + slicer), alongside LaPlace Intuition, Octahedron Sections, and Cosmic Clock. Content lives in `src/examples/`.
- Verification: unit tests for the open-once rule, restore, legacy recognition, duplication, and every example's stored documents round-tripping through the strict parser; browser tests updated for the menu plus a new suite opening every example and reopening one from the trash; `npm run check`; manual pass in the dev browser.

### September 24 follow-up — Examples as built-ins, shortcuts in the sidebar

- Examples are now merged into every library rather than created on click (`src/modules/builtins.ts`: pristine projects, overlay storage for edits, strip on write, reset, lazy material), listed in an **Examples** sidebar view and kept out of All projects, archive, and trash. **Shortcuts** is a sidebar group driven by the `library.shortcuts` design setting, Cosmic Clock and Octahedron Sections first. Added the graph-only Octahedron Sections example; fixed the XJ-1 viewport and the trace readout's "undefined". Decision 49.
- Verification: unit tests for merge/strip/reset, refusal to trash, view selection, and every example graph compiling; browser suites updated (shortcuts instead of the menu) plus a rewritten examples suite covering always-present, edit-persists, reset, duplicate, shortcuts, and lazy loading; `npm run check`; manual pass in the dev browser.
- Follow-up: **Equal axes** is a per-graph checkbox (`equalAxes` on the graph document, default unchanged); the XJ-1 example turns it off so its 10³ × 10⁷ ranges scale independently. Decision 50.
- Follow-up: the tool / medium tags on project cards are bold and dark green (`.tool-labels > span`), so a card's tools scan at a glance.

### September 24 follow-up — One-command ship

- Added `scripts/ship.sh` (`npm run ship`, `npm run status`): commit, fast-forward or rebase, check, push, wait for CI, deploy live, verify the live bundle. `deploy.sh` gained `--prebuilt` so the build is not repeated. `docs/RELEASING.md` now describes the one-branch flow first and the PR path as the review option.
- Verification: `--status` and `--dry-run` exercised against the pending tree; `bash -n` on both scripts; `npm run check` green (162 tests).
- Next: first real run of `ship` is Tyler's call; `AGENTS.md` still describes the branch-and-PR handoff and should be brought in line with the one-branch practice.
