## New Graphing Calculator Feature: Implicit Equations

## Context

The calculator now graphs equations involving both x and y, such as `x^2 + y^2 = 9` or `x = 2`.

## Tyler's Request

> In addition to formula, parameter, and note, users should be able to add points as in ordered pairs, and implicit equation.

## Conceptual gaps I, the agent, filled in

- Added a separate Implicit equation row that can reuse graph parameters and functions, including domain restrictions.
- Used bounded numerical contour sampling and equal axis scale. Tiny features, repeated roots, and isolated solutions may be missed.
- Included visibility, colors, editable labels, saving, undo, and backup support.

## What details should Tyler be able to fine tune by hand?

- In the app: equation, parameters, restrictions, graph bounds, color, visibility, and label styling/position.
- For further refinement: supported notation, sampling detail versus responsiveness, and the explanation of plotting limitations.

