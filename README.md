# Junga Workspace

A browser workspace for a project library, graphing calculator, spreadsheet, code projects, a visual canvas, and documents.

## Run locally

Use Node.js 24 LTS and npm. Run `npm ci`, then `npm run dev`.
Open http://127.0.0.1:5173. The server listens only on this computer.

Click **User mode** in the top bar to enter designer mode. Preview label controls, graph and spreadsheet layout, shared appearance, the workspace shell, and library copy; switch back to user mode to try the result, and **Save design** to keep accepted settings in `Design/settings.json`. Every control is one entry in `src/design/registry.ts`. The panel also prepares short requests for an agent. See [Small refinements](docs/REFINEMENTS.md). Production builds apply the saved design without designer editing access.

## Hosting in a website subfolder

Run `npm run build` with Node 24, then copy the **contents of `dist/`** into the chosen website folder, preserving its directory structure. For example, `https://your-site.example/junga/` can serve `index.html`, `favicon.svg`, and `assets/` together. The same build works at the site root or a deeper folder; no hostname or folder name is compiled into it.

Vite uses `base: './'` to produce relative scripts, styles, fonts and CSS image references. Runtime assets use `import.meta.env.BASE_URL`, including the logo, Earth textures, time-zone data and credits. Keep the folder URL's trailing slash (the host should redirect `/junga` to `/junga/`), or open `/junga/index.html`. Routes stay in the hash, such as `/junga/#/project/<id>/output/<outputId>`, so they do not require server-side route rewrites. External design/source links keep their original URLs.

Upload the built files, not the source/development server — `dist/` is gitignored here on purpose, so nothing serves this app until something explicitly builds and copies it out. Publishing the app does not publish your browser-local projects; move a library using explicit backup/restore. Browser storage is shared by origin (scheme, hostname and port), so two Junga folders on the same origin use the same library key.

`npm run test:e2e -- tests/subfolder.spec.ts --project=chromium --workers=2` verifies the production build beneath a nested folder with no files or fallback at the site root, including direct `index.html` entry, scene reloads and asset requests.

## Deploying to tylergriffith.us

`tylergriffith.us` vendors this app's `dist/` output as plain static files under `JungaWorkspace/`; there is no build step on the server, so a deploy means build here, copy the output into that repo, and push it there.

```
npm run deploy            # check, build, vendor, commit locally — review before pushing
npm run deploy -- --push  # also push the website repo's remote
npm run deploy -- --live  # also deploy live via SSH
```

The script refuses to publish an unclean tree, a commit that is not on `origin/main`, or a failing build. It assumes the website repo is a sibling directory (`../tylergriffith.us`); override with `WEBSITE_REPO`.

**[docs/RELEASING.md](docs/RELEASING.md) is the full runbook** — merging to `main`, deploying, what each stage does and does not change, and the failure modes worth recognizing. Per [AGENTS.md](AGENTS.md), deploying is Tyler's explicit decision, never a side effect of a feature change.

## Checks

Run `npm run check` for unit tests, TypeScript, and a production build.
Run `npx playwright install chromium` once, then `npm run test:e2e` for browser acceptance tests.
CI runs both on pull requests and on pushes to `main`; it does not deploy. See [docs/RELEASING.md](docs/RELEASING.md).

## Collaborate from another computer

See [CONTRIBUTING.md](CONTRIBUTING.md) for the initial checkout branch, setup, branch/PR workflow, and review responsibilities. Agents start with [AGENTS.md](AGENTS.md). Git shares the code and design settings; projects in the app require an explicit library backup/restore to move between browsers.

## Working prototype

Create, edit, organize, favorite, duplicate, archive, trash, and restore projects. Search and filter the library, switch grid/list views, and save project notes.

Open any graphing project's calculator to edit functions, add sliders/constants and notes, change curve labels/colors, and pan or zoom the graph. Expressions support arithmetic, named functions/dependencies, common real math functions, and domain restrictions such as `f(t) = e^(-t) sin(t) {t > 0}`. Use **How to write expressions** for notation details. The optional LaPlace Intuition project recreates the first Desmos example with five curves and two sliders.

Use **Formulas**, **Points** (for example `(a, sin(a))`), or **Implicit equation** (`x^2 + y^2 = 9`, `x = 2`). All rows have a drag grip; mouse, touch, and Alt+↑/↓ reordering are supported. Curve appearance includes named color swatches. Parameter play/pause animates one full slider traversal in five seconds at 1×; settings offer 0.125×–16× speed and loop, reverse, or stop modes. Playback pauses on graph edits, hidden tabs, or failed saves. Drag labels along their curves and double-click (or press Enter) to edit text, size, tangent alignment, or a typed fixed angle and rotation buttons (15° by default). Label arrows reposition them without panning the graph. Settings, label positions, and row order persist in projects and backups; playback itself is temporary.

Open a spreadsheet project to edit cells and formulas, select ranges, copy/paste tables, fill relative references, format cells, and resize columns. Use **Load motion example** for editable inputs and a calculated velocity/distance table. Arithmetic, A1 ranges, absolute/mixed references, and common aggregate/logical/engineering functions are supported; **Using the spreadsheet** lists the syntax. The first version has one worksheet per project, starting at 50 rows × 12 columns and growing to 200 × 26.

Projects containing both tools offer **Open side by side**. **Create octahedron example** in the library builds the first integrated example: six coordinate pairs driven by s = 5, h = SQRT(3)*s/2, and a t slider from 0 to 1. Change B2 or move t to update the spreadsheet and connected shape together. **Link settings** configures named cells, numeric cell sliders, and x/y ranges for point series. Formula errors remove affected points and break lines. The graph uses equal axis scale for linked geometry; **Fit points** adjusts its bounds.

Graph and spreadsheet documents save with the project and are included in library backups. Point-series links reference the same project's sheet; graph expressions cannot yet use sheet names. Undo/redo is session-local; slider/settings changes currently reset spreadsheet undo history. Spreadsheet cells commit on Enter, Tab, or blur; Escape cancels. Save failures keep a draft and guard navigation. Multiple worksheets, cross-sheet/custom functions, external imports, graph formatted math, shaded inequalities, and calculus remain deferred. Numeric curve plotting is approximate and can miss very narrow or rapidly oscillating features. Implicit contour sampling can also miss repeated-root curves and isolated roots; use a simpler equivalent equation or a closer view. Equal axis scale is used for points and implicit geometry.

Data stays in this browser's local storage for this exact site address. There is no account, server storage, or synchronization. Clearing site data removes this copy. **Download library backup** saves a native JSON snapshot; **Restore library backup** validates and previews a file (up to 10 MB), then adds independent copies by default. Whole-library replacement requires explicit acknowledgment and offers a download of existing data first. A preview becomes stale if another tab changes the stored library; refresh it before restoring.

Backups include saved content and unsaved notes, graph changes, and spreadsheet cell edits retained on the page. Save failures offer **Download unsaved work** without clearing drafts or marking them saved. Apply project details and calculator settings before downloading. If stored data is unreadable, recovery offers an unchanged raw-data download and replacement from a known-good backup. This is manual backup/recovery, not automatic history or synchronization.

## Code projects

Tick **Code** when creating a project to get a file workspace. **Open files** lists the project's files as a folder tree, with **New file**, **Import files**, rename, delete, and an entry file marked with a star. Editing uses CodeMirror, which loads the first time a code project is opened. A project holds up to 100 text files, 128 KB each and 512 KB in total, because the whole library shares one browser-storage key; images, fonts and other binary assets are not stored yet.

**Run** opens the entry file beside the editor. **Add output** on the project overview creates an output that opens the same files on their own page, at `#/project/<id>/output/<outputId>`; **Edit output settings** names it and chooses which HTML file it opens.

Running needs no server and no build step. Every file but the entry becomes a `data:` URL and an import map resolves the project's own relative imports, so `import './lib/util.js'` works across several files. The page runs in a sandboxed frame without `allow-same-origin`, so it cannot read your saved library or the page around it; it _can_ reach the network, so a CDN library works. The console panel shows the running page's logs, warnings and errors. Not supported: JSX or TypeScript compilation, bare npm imports without a CDN URL, and navigating between HTML files inside one output.

## Visual canvas

Tick **Visual canvas** when creating a project, then **Open visual canvas**. A canvas document is a set of pages of shapes, text, images, and connectors, plus a **mode** that says how the pages are used: a **presentation deck** (slides with build steps and transitions), an **interactive mockup** (screens linked by clickable elements), a **diagram board** (unbounded canvases), or a **simple animation** (elements move between keyframes). The drawing is the same in every mode; only naming, the inspector's extra sections, and playback change.

Draw with the toolbar or keys (V select, H pan, R rectangle, O ellipse, T text, L connector); drag to size a shape, double-click to edit text (`x_{1}` and `x^{2}` give sub- and superscripts), and drag a connector from one shape to another to attach it. Snapping uses the grid and other elements' edges; hold Alt to disable. Select several with Shift or a marquee; Ctrl+G groups, [ and ] change order, Ctrl+D duplicates, Ctrl+Z undoes. The inspector edits every property, including paints (`none`, a color, or a two-stop gradient), fonts, arrowheads, build steps, links, and keyframes. Pages are added, duplicated, reordered, and deleted in the strip.

**Present** plays the canvases by mode; **Add canvas output** on the overview publishes the same playback on the read-only output route. **Export** writes this canvas as SVG or PNG (2× or 3×) and all canvases as a PDF through the print dialog, and imports `.drawio` files (compressed or not) as canvases. Images are stored inside the document after downscaling, up to 600 KB each and 2.5 MB per canvas; PPTX and GIF export are planned. See `sharedProjectManagement/features/visual canvas.md`.

## Documents

Tick **Document** when creating a project, then **Open document**. The page edits like Google Docs: type and select naturally, Ctrl+B/I/U for marks, Ctrl+K for a link, and Docs-style shortcuts (`# `, `## `, `### `, `- `, `1. `, `> `, "```") to start a title, heading, list, quote, or code block. Tab and Shift+Tab nest list items; Enter on an empty item leaves the list; Enter after a heading returns to normal text. The toolbar covers text style, marks, links, alignment, lists, indent, images (with a width control), dividers, font, text size, and page size, margin, and line spacing. Headings appear in an outline that scrolls the page; the footer counts words and estimates pages.

The document is saved as blocks of styled runs, validated like every other module document. **Preview** and the **reading output** present it read-only with an outline and a print button. **Export** writes PDF (through the print dialog), Markdown, HTML, or plain text; **Import** reads Markdown, HTML, or text files. Images are stored inside the document after downscaling, under the same 2.5 MB bound as the canvas. See `sharedProjectManagement/features/document.md`.

## Bundled source projects and scene outputs

Choose **Cosmic Clock** in the library, then **Open scene** on its Earth Clock output card. The code project's **Working material** lists the actual bundled modules, assets, licenses, documentation, and maintenance scripts, and **View file** opens any of them read-only, with **Copy into** to put a text file in a code project where it can be edited and run — source from the application bundle, served assets from their URL, images as a preview, and very large data files truncated with a link to the whole file; **Outputs** contains the experiences made by that project. **Edit output settings** saves validated camera, time, overlay, and metadata defaults explicitly. This is the **Bundled source project** type in the project form: source that ships with the app, with no files kept in the browser.

The nested output route identifies its owner and provides **Back to Cosmic Clock**. Orbit/zoom, local-time hover/pinning, date, pause/speed, Live, and boundary toggles last only for that visit; they do not save or dirty the source. Existing project/backup data stays compatible, and copies and lifecycle actions retain authored definitions. No template is seeded automatically.

For a bundled source project, Junga manages metadata/configuration and a source inventory, **not repository file editing or filesystem synchronization**; its scene code, images, and boundary data ship with the app. Files you write or import live in a code-tool project instead, as described above. See the [scene guide](src/interactive-scenes/cosmic-clock/README.md) for schema, lifecycle, licensing and map/time accuracy limits.

## Repository

- `src/`: application, project model, persistence, and styles. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the layers and how to add a module, a design setting, or an example.
- `src/modules/`: tool ids, the module registry (names, icons, routes, combined views), and built-in examples.
- `src/design/`: the design settings registry, designer panel, and local save endpoint.
- `src/backup.ts` and `src/BackupRestore.tsx`: native backup validation, draft snapshots, restoration, and preview/confirmation UI.
- `src/graph/`: graph document, numeric parser/evaluator, sampling, editor, and plot.
- `src/sheet/`: spreadsheet document, bounded formula engine, clipboard/fill operations, and editor.
- `src/linked/`: combined workspace, cell/point link settings, and the native octahedron example.
- `src/canvas/`: visual canvas document model, geometry, shared SVG rendering, editor, inspector, presenter, export, and draw.io import.
- `src/document/`: document block model, HTML renderer and parser, block-level DOM edits, editor, reader, Markdown import/export.
- `tests/`: browser acceptance tests.
- `docs/`: decisions, work log, and current handoff.
- `sharedProjectManagement/taskList.md`: shared priorities and follow-ups.
- `ProductManagement/`: product-owner material; read-only for agents.

See [current status](docs/HANDOFF.md) and [decision log](docs/DECISIONS.md). Merges and deployments require the product owner's decision; no deployment is configured.
