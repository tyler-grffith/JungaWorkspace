# Junga Workspace

A browser workspace for a project library, graphing calculator, and spreadsheet.

## Run locally

Use Node.js 24 LTS and npm. Run `npm ci`, then `npm run dev`.
Open http://127.0.0.1:5173. The server listens only on this computer.

## Checks

Run `npm run check` for unit tests, TypeScript, and a production build.
Run `npx playwright install chromium` once, then `npm run test:e2e` for browser acceptance tests.
CI runs both on pull requests; it does not deploy.

## First increment

Create, edit, organize, favorite, duplicate, archive, trash, and restore projects. Search and filter the library, switch grid/list views, and save project notes. An optional starter project records the first Desmos example; calculator and spreadsheet editors are subsequent increments.

Data stays in this browser's local storage for this exact site address. There is no account, server storage, or synchronization. Clearing site data removes this copy. The library can be downloaded as a JSON backup; backup restoration is not implemented yet.

## Repository

- `src/`: application, project model, persistence, and styles.
- `tests/`: browser acceptance tests.
- `docs/`: decisions, work log, and current handoff.
- `ProductManagement/`: product-owner material; read-only for agents.

See [current status](docs/HANDOFF.md) and [decision log](docs/DECISIONS.md). Merges and deployments require the product owner's decision; no deployment is configured.
