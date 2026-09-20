## New Workspace Feature: Designer Mode

## Context

Tyler needs to fine-tune common design choices directly, without spending agent work on every small adjustment. The first version exposed sixteen hand-coded settings; Tyler asked for the same tool to grow into a general place for details that otherwise look fixed to users.

## Tyler's Request

Build designer access with a switch between designer mode and user mode, including live controls and reusable design settings. Continue it as the developer-facing tool for adjusting fixed UI details.

## Conceptual gaps I, the agent, filled in

- Added a local development panel with a live preview, explicit Save/Revert, preview download, and a sample using the real label manager. User mode keeps the preview while hiding the designer panel.
- Save accepted settings to `Design/settings.json` for version control and production builds. Keep project content separate; retain unsaved previews in the current browser tab and reject stale saves.
- Rebuilt the settings as a declarative registry (`src/design/registry.ts`). Each field declares its kind, bounds, default, and optional CSS variable; validation, the panel, the saved-file shape, and CSS injection derive from it. Saved files may lag the registry: missing fields take defaults, unknown fields are rejected.
- Extended coverage to six areas: label manager, graph layout, spreadsheet sizing, shared appearance (five colors, corners, base text size, heading font), workspace shell (sidebar and content dimensions, brand and workspace text), and project library (grid columns, default view and sort, example buttons, page copy).
- Production uses the saved design and omits designer editing access. Kept it development-only for now because there is no hosting or account model; the registry does not depend on the dev server, so a hosted designer role can reuse it later.

## What details should Tyler be able to fine tune by hand?

- In designer mode: everything listed in [Small refinements](../../docs/REFINEMENTS.md), grouped by area. Default view and sort apply on the next load; everything else previews live.
- In user mode: normal project editing, with the current design preview applied. Save design when satisfied, or revert the preview.
- Bounds, labels, help text, and defaults of every control: one line each in `src/design/registry.ts`. New controls follow [ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
