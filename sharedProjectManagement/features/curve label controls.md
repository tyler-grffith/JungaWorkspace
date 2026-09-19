## New Graphing Calculator Feature: Curve Label Controls

## Context

Curve labels can be positioned along their plot lines and styled directly from the graph.

## Tyler's Request

Make labels draggable along the plot line. Double-clicking should open a small label manager for text, size, local parallel alignment, and rotation in 15-degree increments.

## Conceptual gaps I, the agent, filled in

- Project dragged positions onto the sampled curve and save an anchor that follows the curve as it changes. Arrow keys offer another way to move labels.
- Added a double-click/Enter manager with Apply/Cancel, 8–36 px text (13 px default), fixed rotation, or alignment to the local screen slope.
- Keep parallel labels upright. Save positions/styles with the project and support undo and backups.
- Automatic overlap avoidance and styling of spreadsheet-linked point labels remain follow-ups.

## What details should Tyler be able to fine tune by hand?

- In the app: label position, text, size, parallel/fixed orientation, and fixed angle in 15-degree steps. Curve appearance controls the shared curve/label color.
- For further refinement: default placement, distance from the line, text-size range, popup placement, and overlapping-label behavior.
