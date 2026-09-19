# Task list

Shared next steps and items to revisit. Maintained by the implementation agent with the product owner. Check off completed work and update priorities as decisions change.

**Target:** a functional browser prototype by **October 15, 2026**, with library organization, a spreadsheet, and a graphing calculator. The owner has now requested the first spreadsheet/graph integration using Octahedron Sections. The second half of the semester is for UX refinement and launching to other users.

## Next up

- [ ] **Review the linked Octahedron Sections project.** Open the new project side by side, move t, change s in B2, inspect h in B3, and edit a coordinate formula in B7:C12. Review the pane sizes, named-cell controls, connected-point labels, and Link settings. The six vertex equations match the Desmos reference.
- [ ] **Review the spreadsheet together.** Open Motion model, change the yellow inputs, enter formulas, paste a small table, and reopen the project. Review selection, editing, formatting, keyboard behavior, and the first worksheet size limits. Turn feedback into concrete changes here.
- [ ] **Review backup recovery.** Download a library backup, inspect its restore preview, and try restoring copies. Review the replacement confirmation and unsaved-work download messages. Use a separate browser profile for replacement experiments.
- [ ] **Review the graphing calculator together.** Try the LaPlace example, change p and a, edit a function, and reopen the project. Discuss expression entry, slider controls, curve labels, and the amount of space given to the graph. The first working calculator is ready locally.
- [ ] **Review the library together.** Gather feedback on collections, project lifecycle, navigation, and visual direction. Revisit the unreviewed choices in [the decision log](../docs/DECISIONS.md); record what is accepted or needs changing.
- [ ] **Apply the library feedback.** Capture concrete changes here after the discussion and verify the affected workflows.
- [ ] **Complete the first GitHub PR/CI cycle.** Push the implementation branches, open reviewable pull requests, run the configured checks, and address failures. Linked workspace builds on backup recovery, spreadsheet, graphing, and the library. Bring the result to the product owner for the merge decision.

The owner requested graphing, then the spreadsheet and backup recovery, on September 18. All three MVP components now have working first versions, with a complete manual backup/restore workflow. Next priorities are hands-on product review and the first remote PR/CI cycle. Merges and deployments still require the product owner's decision.

## Come back to

- [ ] **Revisit recovery as storage evolves.** Manual full-library backups and restoration are implemented. Selective project recovery, scheduled backups, persistent version history, and coordinated simultaneous editing remain future decisions alongside server storage.
- [ ] **Review new examples as they arrive.** Keep the first example as the early target. Turn newly identified needs into specific tasks without silently expanding the prototype scope.
- [ ] **Inspect the larger engineering workbook in depth.** Initial read-only inventory found 22 worksheets, extensive arithmetic/trigonometry, and named function calls such as TRAT. Trace representative models with the owner to prioritize multiple sheets, cross-sheet references, custom functions, and larger grids. The current prototype is not compatible with the whole workbook.
- [ ] **Refine spreadsheet interaction from actual use.** Prioritize pointing at cells while entering a formula, a drag fill handle, row/column insertion and deletion with reference updates, wrapping and dates, richer number formatting, sorting/filtering, and larger virtualized grids. The first editor supports a single worksheet up to 200 rows × 26 columns, growth at the end, resize/autofit, and explicit fill down/right.
- [ ] **Revisit the advanced aircraft graph.** Track constants separately from adjustable sliders, distinguish author parameters from end-user controls, and explore labels attached to plot lines.
- [ ] **Refine calculator interaction from actual use.** Review formatted math entry versus the current plain-text fields; expression reordering; slider animation; keyboard workflows; graph/controls layout on smaller screens; and avoiding overlapping curve labels. Constants, sliders, and attached labels already have basic implementations.
- [ ] **Choose the next mathematical capabilities from examples.** The current engine handles explicit functions of one variable. Implicit curves, shaded inequalities, tables/points, piecewise branches, calculus, complex numbers, and author/presentation modes need separate prioritization. Numeric sampling can miss very narrow or high-frequency features; refine plotting against selected examples.
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

See [the handoff](../docs/HANDOFF.md) for the current implementation and [the work log](../docs/WORK_LOG.md) for daily and weekly updates.
