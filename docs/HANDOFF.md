# Current handoff

## Ready for product review

Current priorities and follow-ups live in the shared [task list](../sharedProjectManagement/taskList.md).

Current increment: **working spreadsheet**, on top of the calculator and library. Local branch: `codex/spreadsheet`, based on `codex/graphing-calculator`. All three MVP components now have working first versions.

Run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173.

### Try this

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
- Multiple sheets, cross-sheet references, custom functions, row/column insertion/deletion, dates, wrapping, sorting/filtering, imports, and links to graph data remain future work. The engine bounds formula length, nesting, dependencies, and calculation work.
- Graph formatted math input, implicit equations, shaded inequalities, calculus, tables/points, animation, and presentation modes remain future work. Numeric plotting has sampling limits; narrow/high-frequency features and crowded labels need future refinement.
- Projects live in local storage in the current browser at the exact site address. No authentication, backend, synchronization, or deployment.
- Downloadable JSON backups are available. Restoration/import is deferred. Trash is recoverable; no permanent deletion is exposed.
- Failed note, graph, or spreadsheet saves retain a draft and warn before navigation. A cell still being edited also guards browser navigation. Unreadable saved data is left untouched with a raw-data download available. Both editors' undo/redo histories are limited to the current session.
- Other tabs receive changes. This is a single-user prototype, not a collaborative editing system.
- A read-only inventory of the engineering workbook found 22 worksheets, many trigonometric formulas, and named function calls. Its models and formatting still need an owner-guided review before choosing the next spreadsheet capabilities.
- No ProductManagement file has been edited. Existing owner changes remain outside the implementation commit.

### Review prompts

- Does a project containing one or both tools fit your expectations?
- Do collection organization and the project overview feel natural?
- Does plain-text expression entry make the first example practical? What should change in notation and parameter controls?
- Are graph size, curve labels, and the narrow-screen layout useful for your actual work?
- How does spreadsheet selection/editing feel compared with your usual workflow, and which missing capability first prevents useful work?

### Next increment

Next: review all three components, record concrete refinements in the task list, and complete the remote PR/CI cycle. Choose additional spreadsheet capabilities from actual examples. Keep spreadsheet/graph data separate until the owner is ready to discuss integration.

Verification results are recorded in WORK_LOG.md. The GitHub workflow is configured but has not been run remotely. Merging and deploying await the product owner's decision.
