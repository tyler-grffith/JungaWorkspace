# Decisions

## Confirmed with product owner

- ProductManagement is read-only for agents. Product direction and final authority belong to the owner.
- The owner asked the agent to maintain `sharedProjectManagement/taskList.md` as the shared next-step and follow-up list. This is separate from the protected ProductManagement folder.
- Browser app; functional prototype by October 15, 2026. UX refinement and external launch follow later in the semester.
- First MVP includes the library, spreadsheet, and graphing calculator. Build the library first, then small working editors.
- Spreadsheet and graphing data remain separate initially. Connecting them is a core later goal. Importing is deferred.
- Branches and pull requests are authorized. Merges and deployments require discussion and owner authorization.
- On September 18, the owner requested the graphing calculator as the next build, ahead of the spreadsheet.

## Implemented decisions awaiting owner review

1. **First increment: library lifecycle.** Projects contain metadata, notes, a reference link, and selected tool types. The graphing increment now adds a working calculator; the spreadsheet remains a placeholder.
2. **Organization.** One collection per project, plus favorites, archive, and recoverable trash. Deleting a collection keeps its projects. No permanent project deletion yet.
3. **Storage.** Save locally in the current browser at the current origin. Show this limitation in the interface; provide a downloadable JSON backup. Accounts, synchronization, and backup restoration are future work. Validate saved data and leave unreadable data untouched.
4. **Implementation.** React, TypeScript, and Vite; a small domain module separates project rules and persistence from the UI. Pinned dependencies and unit/browser checks support later agents and CI. Official references: https://react.dev/learn/creating-a-react-app and https://vite.dev/guide/.
5. **Initial design.** Quiet, light workspace with a persistent library sidebar, green accent, grid/list browsing, and a focused project overview. Desktop first, usable on narrow screens. User refinement pending.
6. **Examples.** Offer an optional LaPlace Intuition project with source link and notes. The graphing increment recreates its five functions as a native editable graph. Opening an older reference-only project with this exact source link initializes that example once; existing graph data and notes remain intact. Loading the example into a populated graph requires an explicit replacement action and supports undo. The larger aircraft graph and engineering workbook remain future references.
7. **Initial mathematics.** Use a small bounded numeric parser/evaluator for explicit functions of one variable. It supports arithmetic, named functions, forward references, constants, common math functions, and trailing domain restrictions. It executes no JavaScript. This covers the first example without embedding an external calculator or adding a large symbolic system. Formula length, nesting, dependency depth, entries, evaluations, and viewport ranges are bounded. Future capabilities may warrant replacing or extending this engine.
8. **Expression editing.** Begin with plain-text math and visible syntax help. Parameters have explicit slider/constant modes, finite bounds, and positive step sizes. Notes, colors, visibility, and on-curve labels are editable. Undo/redo is session-local with a 50-step history and grouped typing/slider changes; it is not persistent version history.
9. **Plotting.** Responsive SVG with adaptive numeric sampling, domain/pole breaks, pointer/keyboard pan and zoom, explicit bounds, and hover values. The plot is approximate: very narrow or rapidly oscillating features can be missed. Labels are attached near the right of each visible curve, with overlap refinement deferred to feedback.
10. **Graph persistence.** An optional versioned graph document lives on each project within the existing library format, separate from future spreadsheet data. Existing library records remain valid. Save errors keep a draft and guard navigation. Removing the graphing tool preserves its saved contents for re-enabling later. Library duplication copies the graph, while archive/trash retain it and trashed graphs are read-only. Sequential cross-tab changes update the view; simultaneous editing remains outside this single-user prototype's guarantees.

Review status: these implemented choices are **unreviewed**. The owner's request establishes build priority, not acceptance of every implementation detail. Record feedback here when discussed.
