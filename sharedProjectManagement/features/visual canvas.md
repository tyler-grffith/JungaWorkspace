## New Workspace Feature: Visual Canvas

## Context

Tyler's Google Slides decks since October 2025 and his draw.io files are one kind of work in
several costumes: posters, sticker sheets, business cards, and wall-art layouts made in Slides;
mission-architecture, thermodynamics, and nuclear-rocket flow diagrams made in draw.io; lecture
decks with build steps; and UI mockups referenced from Figma. The spreadsheet, graphing, and
code modules already show the pattern for a tool that lives on a project, saves to the shared
library, and produces read-only outputs. The visual canvas is the fourth module in that row.

## Tyler's Request

> Let's build a visual canvas sub-app that is a recreation of google slides, draw.io, and figma.
> This sub-app should be good for building presentations or UI mockups or simple animations or
> diagrams.

> This sub-app should be called visual canvas because it is a way to make visual
> slides/frames/diagrams which are all fundamentally the same type of thing. The difference is how
> they are output and used after they are made. So the visual canvas app should have a mode for
> organizing visual canvases into a presentation deck or an interactive UI mockup or a diagram
> board or a simple animation (an image whose elements can move over time according to some
> rules). This should be able to export as a pdf or ppt or svg or png or gif or how figma does it.

Answered in conversation: build it natively rather than embedding an existing canvas library;
favor a functional prototype he can refine over completeness; make decisions and keep going.

## Conceptual gaps I, the agent, filled in

- **One document, four modes.** `canvas` is a module id like `graph`, `sheet`, and `code`. Its
  document is a list of pages ("canvases") of positioned elements plus a `mode`: `deck`, `mockup`,
  `board`, or `animation`. The mode changes how pages are named (slide, screen, board, scene),
  which inspector sections appear (build steps, click-through links, motion keyframes), and how
  the presenter plays them. Switching mode never changes the drawing.
- **Elements** are shapes (22 kinds drawn as SVG paths), text, images, and connectors, in one flat
  z-ordered list. Groups are a shared `groupId` rather than nesting, so selection expands to the
  group and ungrouping is a field reset. Connectors attach to elements at an automatic edge point
  or a fixed relative point, keep waypoints, and route straight, orthogonal, or curved with six
  arrowhead styles at either end.
- **Paint** is one string: `none`, a hex color, or `gradient(angle,#from,#to)`, validated by one
  regular expression and rendered through shared `<defs>`. Text supports `x_{1}` and `x^{2}` markup
  for the sub- and superscripts the engineering diagrams lean on, with fonts chosen from a list
  that includes the serif faces those diagrams use.
- **Editing gestures commit once.** Drags work on a transient copy of the document and commit on
  release, so each gesture is one save and one undo step (50 steps, session-local, like the graph).
  Snapping uses the grid plus other elements' edges and centers with visible guides; Alt disables it.
- **Rendering is shared.** The editor stage, page thumbnails, presenter, and SVG export all draw
  through the same components, so exports match the screen.
- **Presentation** is a `canvas-show` output on the existing output route, read-only like the code
  and scene outputs, and also reachable from the editor's Present button. A deck steps through
  slides and `appear` build steps with fade/slide transitions; a mockup shows a device frame and
  navigates through element links (Backspace goes back); a board pans and zooms; an animation
  plays each scene's keyframes over its duration with a scrubber.
- **Animation** is keyframes on elements: at time _t_, an element's position, size, rotation, and
  opacity. "Add keyframe" captures the current pose; once an element has a keyframe, dragging,
  resizing, or rotating it at a preview time records the new pose as a keyframe at that time
  (auto-keying, as in Keynote or Figma). Playback eases between keyframes. This is the tween model
  rather than a scripting model.
- **Export** offers this canvas as SVG, PNG at 2× or 3×, and all canvases as a PDF through the
  browser's print dialog with page size set to the canvas in inches. PPTX and GIF are deliberately
  later increments; both need a zip and an encoder that the repository does not carry yet.
- **draw.io import** reads `.drawio` XML (compressed diagrams included), maps the common shapes,
  gradients, dashes, fonts, HTML labels, groups, containers, edges with waypoints and arrowheads,
  and embedded images, and turns unsupported shapes into labelled rectangles rather than dropping
  them. An import into an empty document that overflows the page switches it to an unbounded board.
- **Images** are stored inside the document as data URLs after downscaling to 1600 px on the long
  edge, bounded at 600 KB each and 2.5 MB per canvas document, because the whole library still
  shares one local-storage key. The Deimos mission diagram alone carries 3.4 MB of images, so a
  separate asset store (IndexedDB) is the next storage decision, recorded in the task list.

## What details should Tyler be able to fine tune by hand?

- In Junga: mode, canvas size presets or custom size, unbounded canvas, grid size/visibility/snap,
  page name, background, transition, duration, and notes; per element, position, size, rotation,
  opacity, fill and stroke paints, dash, corner radius, shadow, text font/size/color/style/alignment,
  connector routing/arrowheads/label, image fit/alt, z-order, alignment, grouping, locking, build
  step, click link, and keyframes.
- In designer mode (group **Visual canvas**): page strip and inspector widths, default grid size,
  default fill and stroke for new shapes, selection color, and rulers.
- For further refinement: the shape library and its default sizes, snapping threshold, the
  presenter's device frame, transition timing, the text markup syntax, storage bounds, and the
  export scale options.
- Not built yet: PPTX and GIF export, a separate image asset store, rich text with mixed styles
  inside one element, per-page master layouts, components/reusable symbols for mockups, path
  editing for freehand shapes, and collaboration.
