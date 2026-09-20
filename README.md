# Junga Workspace

A browser workspace for a project library, graphing calculator, and spreadsheet.

## Run locally

Use Node.js 24 LTS and npm. Run `npm ci`, then `npm run dev`.
Open http://127.0.0.1:5173. The server listens only on this computer.

Click **User mode** in the top bar to enter designer mode. Preview label controls, graph layout, and shared appearance, switch back to user mode to try the result, and **Save design** to keep accepted settings in `Design/settings.json`. The panel also prepares short requests for an agent. See [Small refinements](docs/REFINEMENTS.md). Production builds apply the saved design without designer editing access.

## Checks

Run `npm run check` for unit tests, TypeScript, and a production build.
Run `npx playwright install chromium` once, then `npm run test:e2e` for browser acceptance tests.
CI runs both on pull requests; it does not deploy.

## Working prototype

Create, edit, organize, favorite, duplicate, archive, trash, and restore projects. Search and filter the library, switch grid/list views, and save project notes.

Open any graphing project's calculator to edit functions, add sliders/constants and notes, change curve labels/colors, and pan or zoom the graph. Expressions support arithmetic, named functions/dependencies, common real math functions, and domain restrictions such as `f(t) = e^(-t) sin(t) {t > 0}`. Use **How to write expressions** for notation details. The optional LaPlace Intuition project recreates the first Desmos example with five curves and two sliders.

Use **Formulas**, **Points** (for example `(a, sin(a))`), or **Implicit equation** (`x^2 + y^2 = 9`, `x = 2`). All rows have a drag grip; mouse, touch, and Alt+↑/↓ reordering are supported. Curve appearance includes named color swatches. Parameter play/pause animates one full slider traversal in five seconds at 1×; settings offer 0.125×–16× speed and loop, reverse, or stop modes. Playback pauses on graph edits, hidden tabs, or failed saves. Drag labels along their curves and double-click (or press Enter) to edit text, size, tangent alignment, or a typed fixed angle and rotation buttons (15° by default). Label arrows reposition them without panning the graph. Settings, label positions, and row order persist in projects and backups; playback itself is temporary.

Open a spreadsheet project to edit cells and formulas, select ranges, copy/paste tables, fill relative references, format cells, and resize columns. Use **Load motion example** for editable inputs and a calculated velocity/distance table. Arithmetic, A1 ranges, absolute/mixed references, and common aggregate/logical/engineering functions are supported; **Using the spreadsheet** lists the syntax. The first version has one worksheet per project, starting at 50 rows × 12 columns and growing to 200 × 26.

Projects containing both tools offer **Open side by side**. **Create octahedron example** in the library builds the first integrated example: six coordinate pairs driven by s = 5, h = SQRT(3)*s/2, and a t slider from 0 to 1. Change B2 or move t to update the spreadsheet and connected shape together. **Link settings** configures named cells, numeric cell sliders, and x/y ranges for point series. Formula errors remove affected points and break lines. The graph uses equal axis scale for linked geometry; **Fit points** adjusts its bounds.

Graph and spreadsheet documents save with the project and are included in library backups. Point-series links reference the same project's sheet; graph expressions cannot yet use sheet names. Undo/redo is session-local; slider/settings changes currently reset spreadsheet undo history. Spreadsheet cells commit on Enter, Tab, or blur; Escape cancels. Save failures keep a draft and guard navigation. Multiple worksheets, cross-sheet/custom functions, external imports, graph formatted math, shaded inequalities, and calculus remain deferred. Numeric curve plotting is approximate and can miss very narrow or rapidly oscillating features. Implicit contour sampling can also miss repeated-root curves and isolated roots; use a simpler equivalent equation or a closer view. Equal axis scale is used for points and implicit geometry.

Data stays in this browser's local storage for this exact site address. There is no account, server storage, or synchronization. Clearing site data removes this copy. **Download library backup** saves a native JSON snapshot; **Restore library backup** validates and previews a file (up to 10 MB), then adds independent copies by default. Whole-library replacement requires explicit acknowledgment and offers a download of existing data first. A preview becomes stale if another tab changes the stored library; refresh it before restoring.

Backups include saved content and unsaved notes, graph changes, and spreadsheet cell edits retained on the page. Save failures offer **Download unsaved work** without clearing drafts or marking them saved. Apply project details and calculator settings before downloading. If stored data is unreadable, recovery offers an unchanged raw-data download and replacement from a known-good backup. This is manual backup/recovery, not automatic history or synchronization.

## Repository

- `src/`: application, project model, persistence, and styles.
- `src/backup.ts` and `src/BackupRestore.tsx`: native backup validation, draft snapshots, restoration, and preview/confirmation UI.
- `src/graph/`: graph document, numeric parser/evaluator, sampling, editor, and plot.
- `src/sheet/`: spreadsheet document, bounded formula engine, clipboard/fill operations, and editor.
- `src/linked/`: combined workspace, cell/point link settings, and the native octahedron example.
- `tests/`: browser acceptance tests.
- `docs/`: decisions, work log, and current handoff.
- `sharedProjectManagement/taskList.md`: shared priorities and follow-ups.
- `ProductManagement/`: product-owner material; read-only for agents.

See [current status](docs/HANDOFF.md) and [decision log](docs/DECISIONS.md). Merges and deployments require the product owner's decision; no deployment is configured.
