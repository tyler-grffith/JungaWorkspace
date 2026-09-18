# Junga Workspace

A browser workspace for a project library, graphing calculator, and spreadsheet.

## Run locally

Use Node.js 24 LTS and npm. Run `npm ci`, then `npm run dev`.
Open http://127.0.0.1:5173. The server listens only on this computer.

## Checks

Run `npm run check` for unit tests, TypeScript, and a production build.
Run `npx playwright install chromium` once, then `npm run test:e2e` for browser acceptance tests.
CI runs both on pull requests; it does not deploy.

## Working prototype

Create, edit, organize, favorite, duplicate, archive, trash, and restore projects. Search and filter the library, switch grid/list views, and save project notes.

Open any graphing project's calculator to edit functions, add sliders/constants and notes, change curve labels/colors, and pan or zoom the graph. Expressions support arithmetic, named functions/dependencies, common real math functions, and domain restrictions such as `f(t) = e^(-t) sin(t) {t > 0}`. Use **How to write expressions** for notation details. The optional LaPlace Intuition project recreates the first Desmos example with five curves and two sliders.

Graph data and view settings save with the project and are included in library backups. Undo/redo is session-local. The spreadsheet editor is next; formatted math, implicit equations, shaded inequalities, calculus, and imports are not implemented. Numeric plotting is approximate and can miss very narrow or rapidly oscillating features.

Data stays in this browser's local storage for this exact site address. There is no account, server storage, or synchronization. Clearing site data removes this copy. The library can be downloaded as a JSON backup; backup restoration is not implemented yet.

## Repository

- `src/`: application, project model, persistence, and styles.
- `src/graph/`: graph document, numeric parser/evaluator, sampling, editor, and plot.
- `tests/`: browser acceptance tests.
- `docs/`: decisions, work log, and current handoff.
- `sharedProjectManagement/taskList.md`: shared priorities and follow-ups.
- `ProductManagement/`: product-owner material; read-only for agents.

See [current status](docs/HANDOFF.md) and [decision log](docs/DECISIONS.md). Merges and deployments require the product owner's decision; no deployment is configured.
