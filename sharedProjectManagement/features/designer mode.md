## New Workspace Feature: Designer Mode

## Context

Tyler needs to fine-tune common design choices directly, without spending agent work on every small adjustment.

## Tyler's Request

Build designer access with a switch between designer mode and user mode, including live controls and reusable design settings.

## Conceptual gaps I, the agent, filled in

- Added a local development panel with a live preview, explicit Save/Revert, preview download, and a sample using the real label manager. User mode keeps the preview while hiding the designer panel.
- Save accepted settings to `Design/settings.json` for version control and production builds. Keep project content separate; retain unsaved previews in the current browser tab and reject stale saves.
- Start the label angle control as typed input, including decimals. Preserve existing project styles; changing the default size affects unstyled labels.
- Production uses the saved design and omits designer editing access. This is development tooling, not a hosted account role.

## What details should Tyler be able to fine tune by hand?

- In designer mode: angle dropdown/typed input and rotation step; size slider/typed input; label default size, offsets, popup title, width and padding; graph panel width and formula text size; accent/sidebar colors and button corners.
- In user mode: normal project editing, with the current design preview applied. Save design when satisfied, or revert the preview.
- Further controls can be added from actual refinement needs; this first panel is not a general page builder. Instructions: [Small refinements](../../docs/REFINEMENTS.md).
