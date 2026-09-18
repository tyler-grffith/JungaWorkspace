# Current handoff

## Ready for product review

Current priorities and follow-ups live in the shared [task list](../sharedProjectManagement/taskList.md).

Current increment: **working graphing calculator**, on top of the library prototype. Local branch: `codex/graphing-calculator`, based on `codex/library-prototype`.

Run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173.

### Try this

1. Open LaPlace Intuition and choose **Open calculator**. On an empty library, **Use this example** creates the project. Any graphing project also offers **Load LaPlace example**.
2. Adjust p and a. Edit a formula such as `f_p(t) = cos(p t)`. The dependent curves update immediately.
3. Add a function, parameter, or note. Change a parameter to a constant in its settings. Hide a curve or change its color/label under **Curve appearance**. Use undo/redo to revisit changes.
4. Drag to pan, scroll to zoom, use the zoom buttons, or set explicit graph bounds. With the plot focused, arrows pan, plus/minus zoom, and zero resets. **How to write expressions** explains syntax.
5. Reload or reopen the project: expressions, parameters, notes, visibility, labels, grid, and view are saved. Duplicate the project, then edit the copy to verify independence. Archive/trash/restore retain graph data.
6. The library still supports collections, favorites, notes, references, search/filter/sort, and grid/list browsing.

### Boundaries

- The graphing calculator handles explicit functions of one variable, arithmetic, common real math functions, named functions/constants, and trailing domain restrictions. Angles use radians; `log` and `ln` both mean natural logarithm; use `log10` for base 10. The sample is recreated natively, not imported.
- Spreadsheet editing, formatted math input, implicit equations, shaded inequalities, calculus, tables/points, animation, and presentation modes remain future work. Numeric plotting has sampling limits; narrow/high-frequency features and crowded labels need future refinement.
- Projects live in local storage in the current browser at the exact site address. No authentication, backend, synchronization, or deployment.
- Downloadable JSON backups are available. Restoration/import is deferred. Trash is recoverable; no permanent deletion is exposed.
- Failed note or graph saves retain a draft and warn before navigation. Unreadable saved data is left untouched with a raw-data download available. Graph undo/redo is limited to the current editor session.
- Other tabs receive changes. This is a single-user prototype, not a collaborative editing system.
- The large example workbook has not been exhaustively analyzed; its accompanying note identifies it as a future capability target.
- No ProductManagement file has been edited. Existing owner changes remain outside the implementation commit.

### Review prompts

- Does a project containing one or both tools fit your expectations?
- Do collection organization and the project overview feel natural?
- Does plain-text expression entry make the first example practical? What should change in notation and parameter controls?
- Are graph size, curve labels, and the narrow-screen layout useful for your actual work?

### Next increment

The owner moved graphing ahead of the spreadsheet. Next: review the working calculator, record concrete refinements, and build the basic spreadsheet inside saved projects. Preserve separate data models for the two tools.

Verification results are recorded in WORK_LOG.md. The GitHub workflow is configured but has not been run remotely. Merging and deploying await the product owner's decision.
