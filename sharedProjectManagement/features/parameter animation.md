## New Graphing Calculator Feature: Parameter Animation

## Context

Graph parameters can play automatically so users can watch a model change over time.

## Tyler's Request

Add play/pause beside each parameter and an animation settings popup, with a five-second low-to-high traversal, adjustable speed multiplier, and loop, reverse, or stop behavior, similar to Desmos.

## Conceptual gaps I, the agent, filled in

- Chose loop at 1× by default, with speed halving/doubling from 0.125× to 16×. A full traversal takes `5 / speed` seconds.
- Resume uses the current value and preserves reverse direction. Replay after a one-way finish starts at the minimum.
- Save values at most ten times per second and group playback into an undo step. Edits, hidden tabs, navigation, or failed saves stop playback.
- Save speed/mode preferences; playing state is temporary. Spreadsheet cell sliders remain a follow-up.

## What details should Tyler be able to fine tune by hand?

- In the app: speed, end behavior, current value, and the slider's minimum, maximum, and step.
- For further refinement: default behavior, speed choices, playback smoothness, and settings-popup layout.
