## New Workspace Feature: PLA Painter

## Context

HueForge and Chroma Canvas turn a picture into a 3D print by stacking thin layers of a few
filaments: where the print is tall, the upper colours show; where it is thin, the lower ones
show through. Tyler asked for a sub-app "analogous to Chroma Canvas and HueForge". A slicer and a
mesh layer already existed in the workspace, so the painter could concentrate on the part those
tools are about: the colour model, the recipe, and the swap plan.

## Tyler's Request

> Create another sub-app called "PLA Painter" that is analagous to chroma canvas and hueforge.

> Your job is to build out the 3D modelor, slicer, and painter. Don't stop until these sub-apps
> are highly capable counterparts of their commercial analogs.

## Conceptual gaps I, the agent, filled in

- **The colour model.** A filament at thickness _t_ over a colour below shows
  `mix(below, filament, min(1, t / TD))`, with TD its transmission distance. Walking the stack
  from the base up gives a colour ramp: the colour seen at every layer count. Each pixel picks the
  ramp step nearest its colour (weighted RGB), and that step is the pixel's height. This is the
  HueForge idea in its simplest honest form; dithering and Lab-space matching are refinements.
- **The recipe is the document.** Image (a bounded data URL, as in the canvas), printed width,
  detail in pixels per mm, layer height, base and total layers, brightness and contrast, and the
  filament stack with colours, TDs, and start layers. The painting, preview, heightmap, mesh,
  swap plan, and print sheet are all derived, never stored, so the document stays small and
  every view agrees.
- **Fast enough to play with.** The working grid is capped at 240,000 pixels, nearest-step
  lookups are cached by quantised colour, and the 3D relief is downsampled before it is built,
  so dragging a slider re-paints immediately and the ramp under the picture shows what colours
  the current stack can reach.
- **Everything the printer needs.** The swap plan gives the layer (and height) at which each
  spool starts; the print sheet adds size, height, grid, and a filament estimate and exports as
  text. The relief exports as a closed, stepped STL, and **Send to Slicer** places a decimated
  copy on the project's plate with the plan in the slicer's notes.
- **September 25 build-out (decision 54).** Layers now mix in linear light and match by CIE
  ΔE2000 (weighted RGB remains an option); Floyd–Steinberg dithering, gamma, saturation, blur,
  sharpening, and a minimum feature size shape the picture; **Auto-place swaps** searches the
  start layers for the lowest mean ΔE and **Suggest filaments** picks a stack from the library;
  a frame with a hanging hole, a layer-by-layer scrub, a compare slider, a print-time estimate,
  a ΔE readout, a TD calibration strip, 3MF, and G-code with M600 pauses (through the slicer
  engine) complete the HueForge workflow. Send to Slicer also sets the slicer's process and the
  spool changes.
- **Presets say they are approximate.** Transmission distances vary by brand and even by spool;
  the presets are typical values and the panel says to measure your own, as HueForge users do.

## What details should Tyler be able to fine tune by hand?

- In Junga: every recipe field, the filament stack (add from presets, rename, recolour, TD,
  start layer, order, remove, space evenly), brightness and contrast, notes.
- In designer mode (group **PLA Painter**): settings panel width, default printed width, default
  layer height.
- For further refinement: presets (`FILAMENT_PRESETS`), the colour distance and the grid cap
  (`paint.ts`, `MAX_PIXELS`), the relief budgets for the 3D view, STL, and slicer
  (`PainterEditor.tsx`), and the filament density used for the estimate.
- For the September 25 build-out: the optimiser budgets (`placeSwaps` shrinks to 3,000 pixels,
  `suggestStack` to 1,200 and six candidate positions), the ΔE sampling stride, the print-time
  constants in `estimateSeconds`, and the calibration strip's steps (`PainterEditor.tsx`).
- Not built, and the obvious next steps: per-filament layer-height limits, luminance-only
  ("lithophane") mode, and a measured-TD input from a photographed strip.
