## New Graphing Calculator Feature: Ordered Pair Points

## Context

Points can be entered directly in the calculator, including coordinates calculated from graph parameters and functions.

## Tyler's Request

> In addition to formula, parameter, and note, users should be able to add points as in ordered pairs, and implicit equation.

## Conceptual gaps I, the agent, filled in

- Chose one ordered pair per Points row, such as `(2, 3)` or `(a, sin(a))`.
- Coordinates recalculate when their dependencies change. Invalid coordinates show a row error.
- Applied equal axis scale and existing visibility, color, label, save, undo, and backup behavior. Spreadsheet-linked points remain available separately.

## What details should Tyler be able to fine tune by hand?

- In the app: both coordinate expressions, their parameters, point color/visibility, label text/size/angle, and graph bounds.
- For further refinement: point size, multiple pairs in one row, and connections between directly entered points.
