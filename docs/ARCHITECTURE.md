# Architecture and extension philosophy

How Junga Workspace is put together and how to extend it. Read this before adding a module, a design setting, an example, or an export target. The shared working rules are in [AGENTS.md](../AGENTS.md); this file explains the code.

## Philosophy

Tyler is the product manager and UI designer. Agents build complete, working baselines that he adjusts afterwards. The code is organized so those adjustments are cheap:

- **Registries over branches.** Anything that comes in a list (modules, examples, design settings, combined views) is a data entry in one file, not an `if` chain spread across components. A new entry should be most of the work of adding a new thing.
- **Adjustable by hand.** Text, sizes, colors, and defaults that Tyler may want to change live in `Design/settings.json`, edited through designer mode, not in component source. If a value is being requested repeatedly, register it.
- **Compatible persistence.** Saved projects and backups from earlier versions must keep loading. Document shapes are versioned and validated; new fields are optional with defaults. Never rename a saved key.
- **Bounded engines.** The graph and spreadsheet engines are small, validated, and never evaluate JavaScript. Prefer extending them over embedding an external calculator. The code module is the deliberate exception: it runs the user's own JavaScript, and confines it to a sandboxed frame with an opaque origin rather than trusting it (`src/code/bundle.ts`, decisions 27–29).
- **Decide, record, move on.** Fill ordinary gaps without waiting. Record novel decisions in [DECISIONS.md](DECISIONS.md), keep the feature record current, and leave a reviewable PR.

## Layers

```
Design/settings.json ──► src/design/registry.ts ──► DesignProvider (CSS variables + useDesign())
                                                            │
src/modules/ids.ts ──► src/library.ts (domain, storage) ──► src/App.tsx (shell, routing, drafts)
        │                        │                                │
src/modules/registry.ts   src/modules/examples.ts        editors: src/graph, src/sheet, src/code, src/canvas, src/linked
```

| Layer           | Files                                                                 | Responsibility                                                                                                                             |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Module ids      | `src/modules/ids.ts`                                                  | The stable tool identifiers. Also the key of each module's saved document on a project and its route segment.                              |
| Domain          | `src/library.ts`, `src/backup.ts`                                     | Projects, collections, lifecycle, validation, local-storage commits, backup/restore. No React.                                             |
| Module registry | `src/modules/registry.ts`                                             | Names, icons, copy, routes, and combined views. The shell renders from this.                                                               |
| Examples        | `src/modules/examples.ts`                                             | Built-in example projects and where the library offers them.                                                                               |
| Editors         | `src/graph/`, `src/sheet/`, `src/code/`, `src/canvas/`, `src/linked/` | Each module's document model, engine, and editor component. Editors receive a document and return the next one; they do not touch storage. |
| Shell           | `src/App.tsx`                                                         | Hash routing, sidebar, library views, project overview, per-editor draft/save plumbing, toasts, dialogs.                                   |
| Design          | `src/design/`                                                         | Settings registry, validation, designer panel, dev-server save endpoint, CSS variable injection.                                           |

## Routing

Hash routes: `#/all`, `#/favorites`, `#/archive`, `#/trash`, `#/collection/<id>`, `#/project/<id>`, and `#/project/<id>/<segment>` where `<segment>` is a module route (`graph`, `sheet`, `code`, `canvas`) or a combined view route (`workspace`). `#/project/<id>/output/<outputId>` opens one of a project's outputs, read-only. `moduleForRoute` and `combinedViewForRoute` in the module registry resolve the segment against the project's tools, so a project cannot open an editor it does not have.

## Adding a module

1. **Id.** Add the id to `TOOL_IDS` in `src/modules/ids.ts`. Validation in `library.ts` and the tool filter follow automatically.
2. **Document.** Create `src/<module>/model.ts` with a versioned document type, `empty<Module>()`, and `valid<Module>()`. Add the optional `project.<id>?: <Document>` field, a `save<Module>` and `initialize<Module>` function, and the initializer entry in `library.ts`. Extend `parseLibrary`, `duplicateProject`, and the backup draft overlay in `backup.ts` to carry the document.
3. **Registry entry.** Add the module to `modules` in `src/modules/registry.ts`: name, long name, description, open-button label, route, icon, CSS class. The project form, filter, cards, overview panel, breadcrumb, and view links render from it.
4. **Editor.** Build `src/<module>/<Module>Editor.tsx` taking `{ title, document, readOnly, unsaved, onBack, onChange }`. In `App.tsx`, add a draft state and a render branch next to the graph and sheet ones. This is the one place a new module still needs explicit wiring, because each editor's document and callbacks differ.
5. **Combined views.** If the module pairs with another, add a `combinedViews` entry with the required tools; the overview button and view links appear only for projects that have all of them.
6. **Design settings.** Register the module's adjustable values as a group in `src/design/registry.ts` (see below).
7. **Example, tests, record.** Optionally add an example, add unit tests for the model and a browser test for the editor, and write a feature record in `sharedProjectManagement/features/`.

## Adding a design setting

Add one field to a group in `src/design/registry.ts`. Field kinds: `number` (min/max, optional `cssVar` and unit), `color` (hex, `cssVar`), `select` (typed options), `text` (max length), `toggle`. That single entry gives you:

- validation and the saved-file shape (`completeDesign` fills missing fields with defaults, so the committed JSON may lag the registry; `validDesign` is strict for saves),
- a control in the designer panel under the group's title,
- a CSS custom property when `cssVar` is set, applied to `<html>` by `DesignProvider`,
- the value on `useDesign().<group>.<field>` for anything CSS cannot express.

Then consume it: reference `var(--your-var, <fallback>)` in CSS, or read `useDesign()` in the component. Keep the CSS fallback equal to the registry default so styles read correctly without the provider. Add a new group when the fields belong to a distinct area; give it a `files` hint so refinement requests point agents at the right code.

Designer mode is the development-server tool for this. Production builds apply `Design/settings.json` and omit the panel and save endpoint. When the app is hosted with accounts, the same registry can back a hosted designer role; nothing in the registry assumes the dev server.

## Adding an example project

Add an entry to `src/modules/examples.ts` with the project input, notes, a `documents()` factory, its placement (`welcome` strip or library `toolbar`), and where to open after creation. The `library.showExamples` design toggle hides all example buttons.

## Portfolio, blog, and export (planned)

These are both in-app views and exported outputs, with no hosting target chosen yet. The intended shape:

- **Presentation views** are library-level modules that read projects rather than editing them: a portfolio view selects and orders projects with presentation metadata; a blog view is a dated, tagged list with rich text. They register like modules but operate on the library, not a single project's document.
- **Export targets** are pure functions from a project or a selection of projects to files (HTML, JSON, images). Keep them in `src/export/` with one file per target and no React dependency, so a hosting choice later is a deployment detail rather than a rewrite.
- Module documents should expose a `render for presentation` path (static SVG for graphs, static table for sheets) that both the in-app views and the export targets reuse. The canvas module already does this: `src/canvas/render.tsx` draws the editor stage, thumbnails, presenter, and SVG export from one set of components, and `src/canvas/export.ts` holds the pure export functions.

## What is deliberately not abstracted

- Editor props and draft/save plumbing in `App.tsx`. Four editors now share the same shape of draft state, render branch, and backup overlay; the next module should extract a generic editor host rather than add a fifth copy.
- Storage. One local-storage key holds the whole library, which is why code projects are bounded to text files and a few hundred KB; binary assets need a storage decision first. Accounts, sync, and server storage are future decisions and are isolated behind `useLibrary`/`commitLibrary`.
- The engines. Each module owns its parser and evaluator. Sharing between them happens through explicit links (`src/linked/`), not a shared expression language.

## Conventions

- TypeScript, React 19, Vite. Pinned dependencies. `npm run check` runs unit tests, TypeScript, and the production build; `npm run test:e2e` runs the Chromium suite.
- Validate at boundaries: storage reads, backup files, design files, and the save endpoint. Inside the app, trust typed values.
- Browser tests reference visible labels (`Open calculator`, `Use this example`, `Create octahedron example`, designer field labels). Changing a label means updating the test or the registry that the test reads.
- Keep `ProductManagement/` read-only. Feature records and shared notes go in `sharedProjectManagement/` and `docs/`.
