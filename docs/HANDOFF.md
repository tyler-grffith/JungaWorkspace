# Current handoff

## Document module — branch `codex/canvas-module`, September 24, 2026

`document` is the fifth module: tick **Document** when creating a project, then **Open document**. The page is edited like Docs: type, select, Ctrl+B/I/U, Ctrl+K for a link, `# `/`## `/`### ` for headings, `- ` or `1. ` for lists (Tab nests, Enter on an empty item leaves), `> ` for a quote, "```" for code. The toolbar has text style, marks, links, alignment, lists, indent, image, divider, font, size, and a **Page** menu (size, margin, line spacing). Headings appear in the outline on the left; the footer counts words and estimates pages. **Preview** opens the reading view; **Add reading output** on the overview publishes it on the read-only output route. **Export** offers PDF (print), Markdown, HTML, plain text, and **Import** brings in Markdown, HTML, or text.

**Validation on the branch.** `npm run check` passes (unit tests including the Markdown round trip; TypeScript; build). `tests/document.spec.ts` covers writing, shortcuts, bold, nested lists, reload persistence, links, Markdown export, and the reading output with accessibility scans, alongside the existing suites. Decision 40 and `sharedProjectManagement/features/document.md` hold the rationale and limits (document-wide font, no tables or real pagination, images bounded as in the canvas).

## Visual canvas module — branch `codex/canvas-module`, September 23, 2026

`canvas` is the fourth module: tick **Visual canvas** when creating a project, then **Open visual canvas**. One document holds pages ("canvases") of shapes, text, images, and connectors, plus a **mode** that says how the canvases are organized and used afterwards: **Presentation deck** (slides with build steps and transitions), **Interactive mockup** (screens linked by clickable elements, previewed in a device frame), **Diagram board** (unbounded canvases to pan and zoom), or **Simple animation** (elements move between keyframes over each scene's duration). Switching mode never changes a drawing.

**Try this.** Draw a rectangle (R) and an ellipse (O), press L and drag from one to the other to connect them, double-click a shape to type into it (`T_{0}` becomes a subscript), and drag a connector's line to add a waypoint. Change the mode in the inspector with nothing selected, add a second slide from the strip, set a shape's **Appear on step** to 1, then **Present**: click or arrow keys advance, Escape returns. On the overview, **Add canvas output** and **Open output** play the same canvases on the read-only output route. **Export** offers this canvas as SVG or PNG, all canvases as PDF (through the print dialog), and **Import draw.io file…** brings in any of the `.drawio` files from Drive. Designer mode has a **Visual canvas** group for panel widths, default grid, default paints, selection color, and rulers.

**Validation on the branch.** 133 unit tests, TypeScript, and the production build pass (`npm run check`). Four new Chromium tests (`tests/canvas.spec.ts`) cover drawing, connecting, text editing, properties, reload persistence, slides and the output route with an accessibility scan, draw.io import, and SVG export; they pass with the existing suites. Manual check in the dev browser: drew, connected, text-edited, and presented a slide with no console errors. The branch descends from `codex/deploy-hygiene` ([PR #8](https://github.com/tyler-grffith/JungaWorkspace/pull/8)), which holds the two deploy-hygiene commits, so merging both in order leaves no conflicts.

**Boundaries.** Images are stored inside the document as downscaled data URLs, at most 600 KB each and 2.5 MB per canvas, because the library still shares one local-storage key; a separate asset store is the next storage decision. PPTX and GIF export are not built. Text is one style per element (with sub/superscript markup), there are no master layouts or reusable components yet, and connectors route with simple elbows rather than obstacle avoidance. Decisions 34–39 and the feature record `sharedProjectManagement/features/visual canvas.md` hold the rationale.

## All branches consolidated into `main` — September 21, 2026

At Tyler's direction, all outstanding work is now merged into `main`, in order: [PR #1](https://github.com/tyler-grffith/JungaWorkspace/pull/1) (GitHub collaboration baseline), [PR #2](https://github.com/tyler-grffith/JungaWorkspace/pull/2) (extensible baseline: module and design registries), and [PR #3](https://github.com/tyler-grffith/JungaWorkspace/pull/3) (Cosmic Clock code project + interactive-scene output, and portable subfolder hosting). `main` now holds the full application; the feature branches were deleted after merging.

Merging PR #3 required rebasing `codex/cosmic-clock-outputs` (previously uncommitted work in the worktree `~/Work/Creative Code/Cosmic Clock/junga-integration`) onto the post-registry `main`. `src/App.tsx` and `src/library.ts` had real conflicts — both branches had independently rewritten them — resolved by hand to keep the registry-driven module/example rendering from the extensible baseline while adding the Code project branch (`CodeProjectOverview`, `OutputPage`, `outputs.ts`) alongside it. `tests/cosmic-clock.spec.ts`'s reload test also needed a longer timeout (`test.setTimeout(90000)`): two full WebGL scene loads plus two accessibility scans exceeded the default 30s limit on GitHub Actions' software-rendered runner, though it passed locally.

The standalone `Cosmic Clock` project (a separate, unrelated git repository that had been copied into this repo's working tree, along with a stray duplicate of the integration worktree) has been deleted — its content is fully superseded by `src/interactive-scenes/cosmic-clock/`, now part of this repo's own history. The `~/Work/Creative Code/Cosmic Clock/junga-integration` git worktree was also removed.

**Validation on `main`:** Node 24.21.0, `npm ci`. `npm run check`: **93 unit tests, TypeScript and production build pass**. All **65 Playwright tests** pass (chromium + designer projects) across backup, graph, sheet, linked, library, designer, cosmic-clock, and subfolder specs. Manual verification: creating a Cosmic Clock project and opening its Earth Clock output renders the live day/night globe with real local time.

Run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173.

### Try this

Click **User mode** in the top bar to enter designer mode. Six areas are available: Label manager (with its sample preview), Graph layout, Spreadsheet, Shared appearance, Workspace shell, and Project library. Change the sidebar width, a color, the heading font, the library title, or the grid columns and watch the app update; switch to user mode to inspect. **Save design** writes accepted settings to `Design/settings.json`; it does not commit or deploy. A short note can be copied into any agent session for changes beyond the panel. [Refinement workflow](REFINEMENTS.md). Designer access is available through `npm run dev`; production builds use the saved design without editing controls. Adding a control is one line in `src/design/registry.ts`.

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

### Code project module — branch `codex/code-project-module`

`code` is now a module you tick when creating a project, beside Graphing and Spreadsheet. It holds text files and folders you write or import, edits them with CodeMirror, and runs them through `code-run` outputs on the existing output route — data URLs plus an import map inside a frame sandboxed without `allow-same-origin`, so no server, no build step, and no access to the saved library. Cosmic Clock is unchanged; its `projectType: 'code'` container is now labelled "Bundled source project" in the form. See decisions 27–29 and `sharedProjectManagement/features/code projects.md`.

**Working material** in a bundled source project now opens each file it lists, read-only, reusing the code module's editor. See decision 30.

Bundled text files can also be copied into a code project (existing or new) and edited there; see decision 31.

Open questions for Tyler: whether copying should bring a file's imports with it; binary assets (images, fonts, data) need storage beyond the shared local-storage key before they can be imported; JSX/TypeScript compilation and bare npm imports need a build step; navigation between HTML files inside one output is not supported; and the sandbox's network access should be reconsidered when accounts arrive.

### Next increment

Next: try a code project end to end and say what the file workspace is missing; review Cosmic Clock source/output separation; try the expanded designer areas; shape the portfolio/blog presentation render. Latest checks on `codex/code-project-module`: 114 unit tests, TypeScript, and the production build pass; all 69 Playwright tests pass.

Deploying awaits the product owner's decision.
