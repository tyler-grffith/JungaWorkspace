# Task list

Shared next steps and items to revisit. Maintained by the implementation agent with the product owner. Check off completed work and update priorities as decisions change.

**Feature documentation:** Each time an agent implements a feature at Tyler's request, create a concise markdown file in `features/`, one file per feature. Follow [implicit equations](<features/implicit equations.md>): feature title, Context, Tyler's Request, Conceptual gaps I, the agent, filled in, and What details should Tyler be able to fine tune by hand? Distinguish current in-app controls from possible refinements; update an existing feature's record when extending it.

**Open questions:** Undecided big-picture questions live in [openQuestions.md](openQuestions.md) — product shape, multi-user, workflow, and automation. Nothing there is a decision; when one is settled it moves into [the decision log](../docs/DECISIONS.md) and, if it creates work, into this file.

**Target:** a functional browser prototype by **October 15, 2026**, with library organization, a spreadsheet, and a graphing calculator. The owner has now requested the first spreadsheet/graph integration using Octahedron Sections. The second half of the semester is for UX refinement and launching to other users.

## Next up

- [x] **Merge PR #1, the extensible-baseline PR, and the Cosmic Clock outputs PR into `main`.** All three branches (GitHub collaboration baseline, module/design registries, Cosmic Clock code project + subfolder hosting) are consolidated on `main` at Tyler's direction.
- [x] **Make the production build portable under a personal-site subfolder.** Relative build/runtime assets and documented `dist/` hosting; production scene, fonts, textures and reloads verified beneath a strict nested path.
- [x] **Integrate Cosmic Clock as a code project with an Interactive scene output.** Source inventory and explicit defaults/metadata editor; separate temporary viewer sessions; lifecycle/migration/backups preserved.
- [ ] **Review Cosmic Clock source/output separation.** Create the template, edit output defaults, open Earth Clock, change its date/camera, return and reopen. Confirm Working material vs Outputs, ownership, mobile controls, and that ordinary viewing never saves. Repository source editing, filesystem synchronization and additional scene kinds remain future decisions.
- [ ] **Try the expanded designer areas.** Spreadsheet sizing, shared appearance colors and fonts, workspace shell dimensions and text, and library defaults/copy are now adjustable. Note which fixed details are still missing; each is one registry line.
- [x] **Choose the first new module.** Tyler chose the visual canvas (slides, diagrams, mockups, simple animation in one module) on September 23. Built on `codex/canvas-module`; see the increment below. Remaining candidates from the owner's list: text, photos.
- [ ] **Review the document.** Create a project with the Document tool, type with the `# `, `- `, `> ` shortcuts, bold and link some text, nest a list with Tab, insert an image, open Preview and a reading output, export Markdown and PDF, and import one of your Markdown files. Note the first formatting or keyboard behaviour that differs from Docs in a way that matters.
- [ ] **Review the visual canvas.** Create a project with the Visual canvas tool, draw shapes and text, connect two shapes, switch modes, add a slide, present it, add a canvas output, export SVG/PNG/PDF, and import one of the draw.io files from Drive. Note which gesture, control, or default feels wrong first; the shape library, snapping threshold, presenter frame, and defaults are all cheap to change.
- [ ] **Shape portfolio and blog.** Both in-app views and exports, hosting undecided. First step: a per-module presentation render (static graph SVG, static sheet table) that both can reuse.
- [x] **Publish the GitHub collaboration baseline.** Merged into `main` via [PR #1](https://github.com/tyler-grffith/JungaWorkspace/pull/1), with contribution/agent guidance, templates, PR CI, and main-branch protection. `bobjunga` has a pending write invitation.
- [ ] **Review designer access.** Switch User mode → Designer mode in the top bar. Try the label preview, typed/dropdown angle controls, layout settings, and Save/Revert. Try copying a one-sentence refinement request. Implemented on `codex/designer-mode`; [workflow](../docs/REFINEMENTS.md).
- [ ] **Review the six calculator refinements.** Try ordered pairs and implicit equations, drag row grips (or Alt+↑/↓), animate a slider at different speeds in loop/reverse/stop mode, inspect color swatches, and drag/double-click a curve label. Review label size, parallel alignment, 15° rotation, and popup layout. Implemented on `codex/graph-interactions`.
- [ ] **Review the linked Octahedron Sections project.** Open the new project side by side, move t, change s in B2, inspect h in B3, and edit a coordinate formula in B7:C12. Review the pane sizes, named-cell controls, connected-point labels, and Link settings. The six vertex equations match the Desmos reference.
- [ ] **Review the spreadsheet together.** Open Motion model, change the yellow inputs, enter formulas, paste a small table, and reopen the project. Review selection, editing, formatting, keyboard behavior, and the first worksheet size limits. Turn feedback into concrete changes here.
- [ ] **Review backup recovery.** Download a library backup, inspect its restore preview, and try restoring copies. Review the replacement confirmation and unsaved-work download messages. Use a separate browser profile for replacement experiments.
- [ ] **Review the graphing calculator together.** Try the LaPlace example, change p and a, edit a function, and reopen the project. Discuss expression entry, slider controls, curve labels, and the amount of space given to the graph. The first working calculator is ready locally.
- [ ] **Review the library together.** Gather feedback on collections, project lifecycle, navigation, and visual direction. Revisit the unreviewed choices in [the decision log](../docs/DECISIONS.md); record what is accepted or needs changing.
- [ ] **Apply the library feedback.** Capture concrete changes here after the discussion and verify the affected workflows.
- [ ] **Review and merge [the initial GitHub application PR (#1)](https://github.com/tyler-grffith/JungaWorkspace/pull/1).** After the required checks and owner decision, move new work to branches from `main`. Until then, clone the published bootstrap branch. `bobjunga` must accept the invitation before pushing or supplying a collaborator review.

The owner requested graphing, then the spreadsheet and backup recovery, on September 18. All three MVP components now have working first versions, with a complete manual backup/restore workflow. Next priorities are hands-on product review and the first remote PR/CI cycle. Merges and deployments still require the product owner's decision.

## Come back to

- [ ] **Canvas storage for images.** Images are stored inside the canvas document as downscaled data URLs, bounded at 600 KB each and 2.5 MB per document, because the library shares one local-storage key. Tyler's Deimos diagram alone carries 3.4 MB of images. Decide on an IndexedDB asset store (shared with code-project binary assets) and extend the backup format to carry it.
- [ ] **Canvas export formats.** SVG, PNG (2×/3×), and PDF (print dialog) exist. PPTX and GIF export need a zip writer and a GIF encoder; choose between hand-written minimal implementations and a dependency, then add "export every canvas" for PNG/SVG and Figma-style scale choices.
- [ ] **Canvas editing depth from actual use.** Candidates: mixed text styles within one element, master layouts and themes for decks, reusable components for mockups, freehand/path editing, distribute spacing, keyboard-driven duplication along a direction, per-page zoom memory, and drag reordering in the page strip.

- [ ] **Extend designer controls from actual use.** Adding a control is one registry line; add them as Tyler asks. Consider preset comparisons, per-module groups for new modules, and a hosted designer role when accounts/hosting exist.
- [ ] **Revisit recovery as storage evolves.** Manual full-library backups and restoration are implemented. Selective project recovery, scheduled backups, persistent version history, and coordinated simultaneous editing remain future decisions alongside server storage.
- [ ] **Review new examples as they arrive.** Keep the first example as the early target. Turn newly identified needs into specific tasks without silently expanding the prototype scope.
- [ ] **Inspect the larger engineering workbook in depth.** Initial read-only inventory found 22 worksheets, extensive arithmetic/trigonometry, and named function calls such as TRAT. Trace representative models with the owner to prioritize multiple sheets, cross-sheet references, custom functions, and larger grids. The current prototype is not compatible with the whole workbook.
- [ ] **Refine spreadsheet interaction from actual use.** Prioritize pointing at cells while entering a formula, a drag fill handle, row/column insertion and deletion with reference updates, wrapping and dates, richer number formatting, sorting/filtering, and larger virtualized grids. The first editor supports a single worksheet up to 200 rows × 26 columns, growth at the end, resize/autofit, and explicit fill down/right.
- [ ] **Revisit the advanced aircraft graph.** Track constants separately from adjustable sliders, distinguish author parameters from end-user controls, and explore labels attached to plot lines.
- [ ] **Refine calculator interaction from actual use.** Row reordering, graph-parameter animation, color swatches, and draggable/editable curve labels are implemented. Next review formatted math entry, playback smoothness on larger graphs, automatic label collision avoidance, and controls on smaller screens.
- [ ] **Choose the next mathematical capabilities from examples.** The engine now handles explicit functions, ordered pairs, and implicit equations. Shaded inequalities, general graph tables, piecewise branches, calculus, complex numbers, and author/presentation modes need separate prioritization. Numeric sampling can miss narrow/high-frequency features and implicit repeated/isolated roots; refine plotting against selected examples.
- [ ] **Review the whole prototype before October 15.** Exercise organizing projects, creating work in both tools, saving, closing, and reopening. Include error handling, accessibility, and narrow-screen use.

## Later milestones

- [ ] **Extend spreadsheet/graph integration from feedback.** The first connection plots coordinate ranges from a sheet and drives numeric cells with sliders. Revisit graph expressions referencing named spreadsheet cells, drag-to-select ranges, linked point selection, adjustable pane widths, slider animation, and unified undo across cell and slider changes.
- [ ] **Import existing projects.** Revisit spreadsheet and Desmos import formats and compatibility after native creation works.
- [ ] **Prepare for other users.** Decide accounts, server storage, recovery, and synchronization needs before launch; plan hosting and deployment with the product owner.
- [ ] **Refine the user experience.** Use hands-on feedback in the second half of the semester to improve the tools and their shared workspace.
- [ ] **Define presentation and export workflows.** Choose useful outputs from actual projects. Broader document, slide, coding, and hobby-library tools remain future product ideas.

## Completed baseline — September 18, 2026

- [x] Library prototype: projects, collections, favorites, search/filter/sort, grid/list views, notes, reference links, duplication, archive, and recoverable trash.
- [x] Browser-local saving, backup download, unreadable-data protection, and unsaved-note protection.
- [x] Optional LaPlace Intuition reference project; it stores notes and a link, not an imported working graph.
- [x] Ten unit tests and ten browser tests passing; production build and accessibility checks passing. GitHub checks configured, with the first remote run still pending.
- [x] Implementation checkpoint committed on `codex/library-prototype`; not merged or deployed. ProductManagement source material remains unchanged by the agent.

## Graphing increment — September 18, 2026

- [x] Recreated the five LaPlace curves with function dependencies, domain restrictions, two adjustable sliders, and graph notes. This is a native example, not a Desmos import.
- [x] Editable expressions, named functions/constants, parameters with limits and step, visibility/colors/labels, undo/redo, pan/zoom, explicit bounds, grid toggles, and coordinate inspection.
- [x] Graph contents and view persist with each project. Duplication makes an independent copy; archive/trash preserve graphs; trash is read-only; backups include graph data. Existing projects and notes remain compatible.
- [x] Failed saves retain the graph draft and protect navigation until retry or explicit discard. Bad formulas show row errors without stopping valid curves.
- [x] 24 unit tests and 17 Chromium browser tests pass after targeted fixes, including calculator accessibility and a 390px viewport. TypeScript and production build pass.
- [x] Local implementation on `codex/graphing-calculator`, based on `codex/library-prototype`. No merge or deployment performed.

## Spreadsheet increment — September 18, 2026

- [x] Editable grid and formula bar; keyboard navigation and range selection; text, numbers, booleans, percentages, arithmetic, A1 ranges, relative/fixed references, common aggregate/logical/engineering functions, and clear formula errors.
- [x] Tabular clipboard paste; internal copy with adjusted references and formatting; fill down/right; bold, alignment, fills, numeric display formats; column resize/autofit; row/column growth; session undo/redo; selection statistics.
- [x] Optional native motion model with editable inputs and calculated velocity/distance. Saved spreadsheet data remains separate from graph data and survives duplication, archive/trash/restore, and backup download. Removing the tool preserves its contents.
- [x] Failed saves keep a draft, unfinished edits guard browser navigation, and unreadable data is preserved. Existing projects remain compatible. Verified on reload and across sequential tab updates.
- [x] 40 unit tests and 26 Chromium browser tests pass after the keyboard-focus fix and targeted reruns. TypeScript/production build, desktop/mobile accessibility, and a 390px layout pass.
- [x] Local implementation on `codex/spreadsheet`, based on `codex/graphing-calculator`. No ProductManagement edits, remote push, merge, or deployment.

## Backup recovery increment — September 18, 2026

- [x] Validate current and older Junga JSON backups, preview project/collection counts and lifecycle status, and restore as independent copies by default with unique names and remapped collections.
- [x] Explicit whole-library replacement with acknowledgment, a download of the existing data, and protection against changes made after preview. Unreadable stored data can be downloaded unchanged and replaced with a known-good backup.
- [x] Backup downloads include unsaved notes, graph changes, and spreadsheet edits retained on the page. Recovery preserves an unfinished cell even if another tab makes storage unreadable. Failed writes retain both the existing library and the restore preview.
- [x] 48 unit tests and 38 browser tests pass across the full run and targeted reruns, including end-to-end download/restore in a fresh browser, storage failures, invalid files, stale previews, draft rescue, keyboard accessibility, and mobile layout. TypeScript/production build pass.
- [x] Local implementation on `codex/backup-recovery`, based on `codex/spreadsheet`. ProductManagement and the user's live library are unchanged by recovery testing; no merge or deployment.

## Linked workspace increment — September 18, 2026

- [x] Open both tools side by side in any project with a spreadsheet and graph, with links back to either full editor. Narrow screens stack the panes; formatting expands on demand in the combined view.
- [x] Recreated Octahedron Sections from the referenced Desmos project: six exact coordinate pairs, s = 5, h = SQRT(3)*s/2, t = 0.323 with limits 0–1, and a closed connected outline. Created the first instance in the owner's local library while preserving existing projects.
- [x] Editable named cells, cell sliders, and point-series ranges with visibility, color, connection, and closure settings. Cells are the source of truth; formula errors remove the affected point and break the outline. Plotted geometry uses equal axis scale.
- [x] Links and both tool documents survive reload, duplication, archive/trash, backup/restore, failed-save draft rescue, and sequential tab updates. Existing single-tool workflows remain available.
- [x] 54 unit tests and 45 browser tests pass across the full run and targeted reruns; production build, desktop/mobile accessibility, and visual review pass. Local branch `codex/linked-workspace`; no merge or deployment.

## Calculator refinements — September 18, 2026

- [x] Formulas naming, ordered-pair points, implicit equations, shared graph dependencies, row-specific errors, and equal scaling for geometry.
- [x] Mouse/touch/keyboard reordering for every entry; parameter play/pause with five-second base traversal, speed multipliers, and loop/reverse/stop modes; named color swatches.
- [x] Curve-label dragging and keyboard positioning, with a double-click/Enter manager for text, size, tangent alignment, and 15° rotation. New state participates in undo, reload, duplication, and backup validation/restoration.
- [x] 64 unit tests and 53 browser tests pass across full and targeted runs, including pause/resume, touch reorder, storage failure, numerical contours, and desktop/mobile accessibility. Production build passes; existing calculator visually reviewed. Local branch `codex/graph-interactions`; no merge or deployment.

## Designer access — September 19, 2026

- [x] Designer/user mode switch, live label-control and visual settings, sample preview, Save/Revert/download, and tab-local preview recovery. Accepted settings live in `Design/settings.json`; production omits editing controls.
- [x] Typed decimal label angles with persistence, designer-selected rotation steps and control variants, plus area-aware **Copy request for agent** and a concise refinement protocol.
- [x] 67 unit and 58 browser tests pass across full and targeted runs, including isolated saves, stale revisions, production exclusion, clipboard handoff, and desktop/mobile accessibility. Real local repository save and visual review completed. Local branch `codex/designer-mode`; no merge or deployment.

## Extensible baseline — September 20, 2026

- [x] Module ids, module registry (names, icons, copy, routes, combined views), and example registry; the shell renders from them and routing checks a project's tools. Saved formats unchanged.
- [x] Design settings registry with six groups; validation, the designer panel, CSS variables, and the saved-file shape derive from field definitions. Older settings files complete with defaults.
- [x] `docs/ARCHITECTURE.md` with the extension philosophy and checklists; workflow docs made tool-neutral. 73 unit tests, TypeScript, and build pass. Local branch `codex/extensible-baseline`; no merge or deployment.

## Code project module — September 21, 2026

- [x] `code` added as a third module: choose it in the project form beside Graphing and Spreadsheet, open `#/project/<id>/code`, and work in a file tree derived from stored paths. Create, rename, delete and import text files and folders, with CodeMirror 6 editing loaded on demand.
- [x] `code-run` outputs open an HTML entry file on the existing output route and run the project's files in a frame sandboxed without `allow-same-origin`. Data URLs plus an import map resolve the project's own relative imports with no server and no build step; a console panel reports logs and errors.
- [x] Cosmic Clock keeps its bundled manifest and `interactive-scene` output unchanged; existing libraries and backups load as before. Files, outputs and unsaved file drafts survive reload, duplication, trash/restore and backup/restore.
- [x] 114 unit tests, TypeScript and build pass; 69 browser tests pass (65 chromium including 4 new code-project tests, 4 designer). Branch `codex/code-project-module`; no merge or deployment.
- [ ] Awaiting Tyler: binary assets (images, fonts, data files) need storage beyond the shared local-storage key. A build step for JSX/TypeScript or bare npm imports, and navigation between HTML files inside one output, are also undecided.
- [ ] Revisit the sandbox's network access when user accounts arrive; running someone else's project then means running untrusted code for other people.

## Document module — September 24, 2026

- [x] `document` added as the fifth module: a Docs-style page edited natively and saved as blocks of styled runs, with title/heading/list/quote/code/divider/image blocks, per-block alignment, document-wide font/size/spacing, Letter/A4 pages with margins, an outline, counts, and a designer-mode group.
- [x] Docs shortcuts (`# `, `- `, `1. `, `> `, "```", Tab/Shift+Tab, Enter/Backspace list and heading behaviour, Ctrl+K), inline formatting, links, images with width control, clean paste.
- [x] Reading output (`document-read`) on the output route and Preview in the editor; export to Markdown, HTML, plain text, and PDF (print); import of Markdown, HTML, and text files.
- [x] Unit tests for the model, Markdown round trip, and library wiring; two Chromium tests. Same branch `codex/canvas-module`; no merge or deployment.
- [ ] Awaiting Tyler: hands-on review; whether per-run fonts/colors, tables, real pagination, or DOCX export come next.

## Visual canvas module — September 23, 2026

- [x] `canvas` added as the fourth module beside Graphing, Spreadsheet, and Code: one document of pages and elements with a mode (presentation deck, interactive mockup, diagram board, simple animation) that shapes naming, inspector sections, and playback without changing the drawing.
- [x] Editor: SVG stage with pan/zoom, rulers, grid and element snapping with guides; 22 shapes, text with sub/superscript markup, images (downscaled data URLs), and connectors with attachable endpoints, waypoints, routing, and arrowheads; select/marquee/move/resize/rotate/group/align/z-order; in-place text editing; 50-step undo; page strip with add/duplicate/reorder/delete; an inspector for every property; a designer-mode group.
- [x] Presenter for all four modes on the existing output route (`canvas-show`) and from the editor's Present button; build steps and transitions for decks, click-through links for mockups, pan/zoom for boards, keyframe playback with a scrubber for animation.
- [x] Export as SVG, PNG (2×/3×), and PDF via the print dialog; import of `.drawio` files including compressed diagrams, groups, embedded images, and edge waypoints.
- [x] 133 unit tests, TypeScript, and the production build pass; 4 new Chromium tests pass with the existing suites. Branch `codex/canvas-module`, based on `codex/deploy-hygiene` (PR #8); no merge or deployment.
- [ ] Awaiting Tyler: hands-on review; storage decision for images; PPTX/GIF export priority.

## Viewing bundled material — September 21, 2026

- [x] Each modules/assets/licenses/documentation/maintenance row in a bundled source project's Working material opens the real file read-only: source from the bundle, served assets from their URL, images previewed, large text truncated with a link to the whole file.
- [x] Fixed the Earth Clock card artwork, which the code-module commit had overridden through a shared `code-outputs` class.
- [x] 117 unit tests, TypeScript and build pass; 70 browser tests pass. Same branch `codex/code-project-module`; no merge or deployment.
- [x] Tyler approved copying: a viewable text file copies into an existing code project or a new one, numbered rather than overwriting, with unstorable files refused by reason.
- [ ] Awaiting Tyler: whether copying should bring a file's imports with it, and whether a whole manifest group should copy at once.

See [the handoff](../docs/HANDOFF.md) for the current implementation and [the work log](../docs/WORK_LOG.md) for daily and weekly updates.
