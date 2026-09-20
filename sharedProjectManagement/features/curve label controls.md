## New Graphing Calculator Feature: Curve Label Controls

## Context

Curve labels can be positioned along their plot lines and styled directly from the graph.

## Tyler's Request

Make labels draggable along the plot line. Double-clicking should open a small label manager for text, size, local parallel alignment, and rotation in 15-degree increments. Later, allow Tyler to switch the angle dropdown to typed input through designer access.

## Conceptual gaps I, the agent, filled in

- Project dragged positions onto the sampled curve and save an anchor that follows the curve as it changes. Arrow keys offer another way to move labels.
- Added a double-click/Enter manager with Apply/Cancel, 8–36 px text (13 px default), fixed rotation, or alignment to the local screen slope.
- Keep parallel labels upright. Save positions/styles with the project and support undo and backups.
- Designer settings now choose the angle/size control types, rotation step, default label size, popup dimensions/title, and label offsets. Typed angles accept decimals within −180° to 180°; the dropdown preserves an existing custom angle.
- Automatic overlap avoidance and styling of spreadsheet-linked point labels remain follow-ups.

## What details should Tyler be able to fine tune by hand?

- In user mode: label position, text, size, parallel/fixed orientation, and a typed angle (or configured dropdown). Rotation buttons default to 15° steps. Curve appearance controls the shared curve/label color.
- In designer mode: control variants, rotation step, default size, offsets, popup title/width/padding. Further refinements include automatic placement, popup placement, size limits, and overlap avoidance.
