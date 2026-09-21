## New Workspace Feature: Module and Example Registries

## Context

Tyler plans new modules (text, diagram, presentation, and others), a portfolio, and a blog. The shell previously hard-coded the graphing and spreadsheet tools in many places, so each new module would have meant edits across the project form, filters, cards, overview, breadcrumbs, and routing.

## Tyler's Request

Build features in a scalable, interconnection-friendly way that gives him a baseline to adjust, without stopping for approval on ordinary build decisions.

## Conceptual gaps I, the agent, filled in

- Introduced `src/modules/ids.ts` (stable tool ids), `src/modules/registry.ts` (names, icons, copy, routes, combined views), and `src/modules/examples.ts` (built-in examples and their placement). The shell renders from these registries; routing resolves editor segments against the project's tools.
- Kept editor components and their draft/save plumbing explicit in `App.tsx`, since two editors do not yet justify a generic host. The checklist for adding a module is in `docs/ARCHITECTURE.md`.
- Saved project and backup formats are unchanged; older libraries keep loading.
- Wrote `docs/ARCHITECTURE.md` to carry the extension philosophy and the planned shape for portfolio, blog, and export targets.

## What details should Tyler be able to fine tune by hand?

- Module names, long names, descriptions, open-button labels, icons, and order: one entry each in `src/modules/registry.ts`.
- Example projects, their button labels, placement (welcome strip or library toolbar), and where they open: `src/modules/examples.ts`. The **Offer example projects** design toggle hides them all.
- Which combined views exist and which modules they require: `combinedViews` in the same registry.
