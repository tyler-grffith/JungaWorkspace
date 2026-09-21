# Current handoff

## Ready for product review

Current priorities and follow-ups live in the shared [task list](../sharedProjectManagement/taskList.md).

Feature completion convention: create one concise markdown record per requested feature in `sharedProjectManagement/features/`, following the owner's [implicit equations example](<../sharedProjectManagement/features/implicit equations.md>). Record the context, request, agent decisions, and details Tyler can fine-tune. Update the same record when extending a feature. The latest calculator batch now has individual records.

Current increment: **GitHub collaboration setup**, on top of designer access, calculator interactions, the linked workspace, backup recovery, and the three MVP components. Local branch: `codex/github-collaboration`, based on `codex/designer-mode`.

The repository remains public at [tyler-grffith/JungaWorkspace](https://github.com/tyler-grffith/JungaWorkspace). The full prototype and collaboration setup are published on `codex/github-collaboration` in [PR #1](https://github.com/tyler-grffith/JungaWorkspace/pull/1). Clone that branch until Tyler approves the initial merge; `main` still contains only the initial documents. `bobjunga` has been invited with write access and must accept the invitation. Main-branch protection is active: current passing Application checks, one approving review, code-owner review (after CODEOWNERS reaches the base branch), and resolved conversations; force pushes and branch deletion are blocked. Tyler retains administrator override, which agents may not use independently.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for checkout instructions and the PR's Checks tab for the current remote validation result. With Tyler's explicit approval to commit and publish, this branch includes the newer ProductManagement documents/examples and existing ODT deletion without content edits. No merge or deployment has been performed.

Run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173.

### Try this

Click **User mode** in the top bar to enter designer mode. Choose Label manager and open its sample preview; compare typed input with a dropdown, adjust the rotation step and popup dimensions, then switch to user mode to inspect the app. **Save design** writes accepted settings to `Design/settings.json`; it does not commit or deploy. A short note can be copied into an agent task for changes beyond the panel. [Refinement workflow](REFINEMENTS.md). Designer access is available through `npm run dev`; production builds use the saved design without editing controls.

Open **LaPlace Intuition (restored)** or any graph project. The add bar now offers **Formulas**, **Points**, **Implicit equation**, **Parameter**, and **Note**. Try `(a, sin(a))` with a parameter a, and `x^2+y^2=9`. Reorder any row by its grip (mouse/touch) or Alt+↑/↓. Play a parameter, open its animation settings, and try reverse or stop mode; 1× traverses the range in five seconds. Curve appearance previews every palette color. Drag a curve label along its line; double-click it or press Enter for text, size, parallel orientation, and typed angles with rotation buttons. Changes support graph undo, persistence, and backups. Review the speed choices, popup layout, and label placement in particular.

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

- The graphing calculator handles explicit functions, ordered pairs, implicit equations in x/y, arithmetic, common real math functions, named functions/constants, and trailing domain restrictions. Points use graph parameters/functions, not spreadsheet names. Angles use radians; `log` and `ln` both mean natural logarithm; use `log10` for base 10. The sample is recreated natively, not imported.
- The spreadsheet starts at 50 × 12 cells and grows to 200 × 26. It supports one worksheet, explicit A1 formulas, ranges, common aggregate/logical/engineering functions, relative/fixed references, and basic formatting. LN is natural log; LOG defaults to base 10. It is a small native editor, not a full Excel/Sheets implementation.
- Multiple sheets, cross-sheet references, custom functions, row/column insertion/deletion, dates, wrapping, sorting/filtering, and external imports remain future work. The engine bounds formula length, nesting, dependencies, and calculation work. Named cells and spreadsheet-to-graph point series are now supported.
- Graph formatted math input, shaded inequalities, calculus, general graph tables, and presentation modes remain future work. Numeric plotting has sampling limits: very small/high-frequency features, implicit repeated roots and isolated points may be missed. Implicit evaluation is bounded by grid, evaluation-count, and total-operation budgets. Automatic label collision avoidance remains future work.
- Graph parameters animate with persistent speed/mode preferences and temporary playback, capped at ten saved updates/second. Pause resumes from the current value and direction; edits, hidden tabs, save failures, and leaving the editor stop playback. Spreadsheet cell sliders are not animated yet. Formula/implicit labels support persisted anchors, size, tangent alignment, and fixed rotation; linked spreadsheet point labels retain their existing behavior.
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

Next: review designer access, try a small refinement request, review the calculator and integrated example, and complete the remote PR/CI cycle. Choose further integration and spreadsheet capabilities from actual examples. Latest checks: 67 unit tests and 58 browser tests pass across the full run and targeted reruns, with TypeScript/build and desktop/mobile accessibility passing.

Verification results are recorded in WORK_LOG.md. The GitHub workflow is configured but has not been run remotely. Merging and deploying await the product owner's decision.
