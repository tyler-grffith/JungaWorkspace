# Current handoff

## Ready for product review

Current priorities and follow-ups live in the shared [task list](../sharedProjectManagement/taskList.md).

Current increment: **linked spreadsheet + graph workspace**, on top of backup recovery and the three MVP components. Local branch: `codex/linked-workspace`, based on `codex/backup-recovery`.

Run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173.

### Try this

Open the new **Octahedron Sections** project, then **Open side by side**. Its first local instance is http://127.0.0.1:5173/#/project/614d3eb1-2bcf-43b1-8bd5-814ff1c9b091/workspace. Move t (0–1), edit s in B2, or inspect the h formula in B3. Six rows in B7:C12 plot as connected labeled points, closing the outline exactly as in the referenced Desmos example. **Link settings** configures names, sliders, and ranges for any two-tool project. **Formatting** expands the combined spreadsheet toolbar; the full editors remain available through the view links. **Create octahedron example** in the library creates another independent instance.

Use **Download library backup** and **Restore library backup** at the bottom of the sidebar. Select the downloaded JSON to preview projects and collections. **Restore copies** preserves the current library and gives collisions “(restored)” names. **Replace current library** requires acknowledgment and offers **Download current data** first. Review replacement in a separate browser profile. Restored archived/trashed projects appear in their corresponding views. Tests exercised this with isolated browser storage; the user's live library was not replaced.

When saving fails, **Download unsaved work** produces a restorable backup with the current notes, graph, or spreadsheet draft included. It does not mark those edits as saved. Unreadable-storage recovery also offers a raw unchanged download and restoration from a good backup. Apply project-details and calculator-settings forms before downloading; unfinished spreadsheet cell edits are included.

1. Open **Motion model → Open spreadsheet** in the local review browser. In any new spreadsheet project, **Load motion example** creates a small native model.
2. Change B2 (initial velocity) or B3 (acceleration). The velocity and distance table recalculates. Select a result to inspect its formula in the bar.
3. Type to replace a selected cell; double-click, Enter, or F2 to edit. Enter saves/moves down, Tab saves/moves right, and Escape cancels. Shift+arrows, Shift-click, or dragging selects a range. The range box can jump to `A1:C10`.
4. Paste a small tab-separated table, enter `=SUM(A1:A5)`, or copy/fill a formula using relative and `$` fixed references. Try formatting, column resize/autofit, and undo/redo. **Using the spreadsheet** lists supported functions and keyboard behavior.
5. Reload or reopen the project. Its cells, formulas, formats, column widths, and size remain saved. Duplicate it and edit the copy; archive/trash/restore retain both tools. Backup downloads include both tool documents.
6. **LaPlace Intuition → Open calculator** still offers the five curves, sliders, expression editing, labels, notes, and pan/zoom. Graph and sheet data are separate even within a shared project.
7. The library still supports collections, favorites, notes, references, search/filter/sort, and grid/list browsing.

### Boundaries

- The graphing calculator handles explicit functions of one variable, arithmetic, common real math functions, named functions/constants, and trailing domain restrictions. Angles use radians; `log` and `ln` both mean natural logarithm; use `log10` for base 10. The sample is recreated natively, not imported.
- The spreadsheet starts at 50 × 12 cells and grows to 200 × 26. It supports one worksheet, explicit A1 formulas, ranges, common aggregate/logical/engineering functions, relative/fixed references, and basic formatting. LN is natural log; LOG defaults to base 10. It is a small native editor, not a full Excel/Sheets implementation.
- Multiple sheets, cross-sheet references, custom functions, row/column insertion/deletion, dates, wrapping, sorting/filtering, and external imports remain future work. The engine bounds formula length, nesting, dependencies, and calculation work. Named cells and spreadsheet-to-graph point series are now supported.
- Graph formatted math input, implicit equations, shaded inequalities, calculus, tables/points, animation, and presentation modes remain future work. Numeric plotting has sampling limits; narrow/high-frequency features and crowded labels need future refinement.
- Projects live in local storage in the current browser at the exact site address. No authentication, backend, synchronization, or deployment.
- Native Junga JSON backup downloads/restoration are available, including older downloads. File selection accepts up to 10 MB; all data is validated before one storage write. A changed storage snapshot blocks restoration until the preview is refreshed. Restore works with complete libraries, not selected projects. External spreadsheet/Desmos import remains deferred. Trash is recoverable; replacing the library can remove projects and requires explicit acknowledgment.
- Failed note, graph, or spreadsheet saves retain a draft, offer backup download, and warn before navigation. A cell still being edited also guards browser navigation and can be rescued if storage becomes unreadable. Backups use the last readable page snapshot if the stored library cannot be read. Unreadable saved data is left untouched until explicit replacement. Both editors' undo/redo histories are limited to the current session.
- Up to 40 named cells, 12 cell sliders, and 8 point series per project. Each series pairs one row or column for x and y; up to 200 points. Graph expressions use their own constants/functions; they cannot yet refer to sheet names. Sliders write numeric cells and cannot overwrite formulas. Cell edits and slider changes update both views after input commits. Direct slider/settings changes reset the spreadsheet's local undo history; unified history is deferred.
- Other tabs receive changes. This is a single-user prototype, not a collaborative editing system.
- A read-only inventory of the engineering workbook found 22 worksheets, many trigonometric formulas, and named function calls. Its models and formatting still need an owner-guided review before choosing the next spreadsheet capabilities.
- No ProductManagement file has been edited. Existing owner changes remain outside the implementation commit.

### Review prompts

- Does a project containing one or both tools fit your expectations?
- Do collection organization and the project overview feel natural?
- Does plain-text expression entry make the first example practical? What should change in notation and parameter controls?
- Are graph size, curve labels, and the narrow-screen layout useful for your actual work?
- How does spreadsheet selection/editing feel compared with your usual workflow, and which missing capability first prevents useful work?
- Are the distinction between restoring copies and replacing the library, and the unsaved-work recovery messages, clear?
- Does the side-by-side workspace match how you want to explore the octahedron model? Should controls, named cells, and coordinate ranges be organized differently?

### Next increment

Next: review the integrated example and all three components, record concrete refinements in the task list, and complete the remote PR/CI cycle. Choose further integration and spreadsheet capabilities from actual examples.

Verification results are recorded in WORK_LOG.md. The GitHub workflow is configured but has not been run remotely. Merging and deploying await the product owner's decision.
