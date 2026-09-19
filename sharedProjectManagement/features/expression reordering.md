## New Graphing Calculator Feature: Expression Reordering

## Context

Users can arrange the calculator's expression list to match how they want to explain or explore a model.

## Tyler's Request

> All expressions should be draggable by the user to rearrange their order

## Conceptual gaps I, the agent, filled in

- Added a grip to every row type, supporting mouse and touch dragging with a highlighted drop target.
- Added Alt+Up/Down on a focused grip as a keyboard alternative and announced the new position.
- Each move supports undo and saves the new order. Named dependencies continue to work regardless of row order.

## What details should Tyler be able to fine tune by hand?

- In the app: the order of every formula, point, equation, parameter, and note.
- For further refinement: grip size/location, drag feedback, drop placement, and scrolling behavior during a drag.
