## New Workspace Feature: Portable Subfolder Hosting

## Context

Junga will live in a folder under Tyler’s personal website. Its assets need to resolve within that folder.

## Tyler's Request

Make references relative to the root of Junga Workspace rather than the root of the website.

## Conceptual gaps I, the agent, filled in

- Set Vite’s relative base (`./`), corrected the runtime logo path, and made HTML entry references relative. Vite rewrites CSS/public assets; existing scene assets already use the build base. External source links remain external.
- Retained hash routing, which needs no server route rewrites. Hosting uses a slash-terminated directory URL or `index.html`, with the complete build directory uploaded together.
- Added a browser check serving the production build strictly under `/personal/tools/junga/`; root assets return 404 so absolute-path regressions are visible.

## What details should Tyler be able to fine tune by hand?

- Choose any hosting folder and upload the contents of `dist/`. Configure the host’s normal directory-slash redirect if necessary. No folder-specific rebuild is needed.
- Publishing still needs an explicit hosting action. Browser library transfer remains an explicit backup/restore operation; project data is not included automatically in the website build.
