# Task list

Shared next steps and items to revisit. Maintained by the implementation agent with the product owner. Check off completed work and update priorities as decisions change.

**Target:** a functional browser prototype by **October 15, 2026**, with library organization, a spreadsheet, and a graphing calculator. Keep spreadsheet and graphing data separate initially. The second half of the semester is for UX refinement and launching to other users.

## Next up

- [ ] **Review the graphing calculator together.** Try the LaPlace example, change p and a, edit a function, and reopen the project. Discuss expression entry, slider controls, curve labels, and the amount of space given to the graph. The first working calculator is ready locally.
- [ ] **Review the library together.** Gather feedback on collections, project lifecycle, navigation, and visual direction. Revisit the unreviewed choices in [the decision log](../docs/DECISIONS.md); record what is accepted or needs changing.
- [ ] **Apply the library feedback.** Capture concrete changes here after the discussion and verify the affected workflows.
- [ ] **Complete the first GitHub PR/CI cycle.** Push the implementation branches, open reviewable pull requests, run the configured checks, and address failures. The graphing branch builds on the library branch. Bring the result to the product owner for the merge decision.
- [ ] **Build the first spreadsheet.** Start with an editable grid, keyboard navigation, copy/paste, basic arithmetic formulas and cell references, and saved content. Acceptance: create a small useful sheet, close its project, and reopen it without losing values or formulas.

The owner requested graphing next on September 18; that increment is now implemented. The spreadsheet remains the next component to build, with review feedback folded in as it arrives. The list records planned work; merges and deployments still require the product owner's decision.

## Come back to

- [ ] **Restore library backups.** Complete the existing JSON download workflow with validated restoration and clear handling of existing projects. Verify recovery without losing saved work.
- [ ] **Review new examples as they arrive.** Keep the first example as the early target. Turn newly identified needs into specific tasks without silently expanding the prototype scope.
- [ ] **Inspect the larger engineering workbook.** Identify the formulas, formatting, organization, and interactions the owner uses most; distinguish early requirements from later capabilities.
- [ ] **Revisit the advanced aircraft graph.** Track constants separately from adjustable sliders, distinguish author parameters from end-user controls, and explore labels attached to plot lines.
- [ ] **Refine calculator interaction from actual use.** Review formatted math entry versus the current plain-text fields; expression reordering; slider animation; keyboard workflows; graph/controls layout on smaller screens; and avoiding overlapping curve labels. Constants, sliders, and attached labels already have basic implementations.
- [ ] **Choose the next mathematical capabilities from examples.** The current engine handles explicit functions of one variable. Implicit curves, shaded inequalities, tables/points, piecewise branches, calculus, complex numbers, and author/presentation modes need separate prioritization. Numeric sampling can miss very narrow or high-frequency features; refine plotting against selected examples.
- [ ] **Review the whole prototype before October 15.** Exercise organizing projects, creating work in both tools, saving, closing, and reopening. Include error handling, accessibility, and narrow-screen use.

## Later milestones

- [ ] **Connect spreadsheets and graphs.** Discuss concrete examples after both tools have working prototypes, then decide how they should share data.
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

See [the handoff](../docs/HANDOFF.md) for the current implementation and [the work log](../docs/WORK_LOG.md) for daily and weekly updates.
