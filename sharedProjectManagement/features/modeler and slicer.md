## New Workspace Feature: 3D Modeler and Slicer prototypes

## Context

Tyler's list of workspace mediums includes a 3D modeler and a slicer; his daily tools are
SolidWorks (in a GPU-passthrough Windows VM) and Bambu Studio. They started as clickable
prototypes with projected-box geometry; the same day Tyler asked for more functionality, and
both now run on a small real mesh layer: the modeler rebuilds solids from its feature history and
the slicer produces toolpaths and G-code. A geometry kernel (booleans, fillets) is still absent.

## Tyler's Request

> next make the 3D modeler recreation of solidworks. If it is too slow or expensive to build an
> actual 3D modeler right now, just build a UI that looks just like solidworks and with clickable
> buttons and everything except for the rendered 3d model. You can expect me to make changes and
> additions to this app later, but the priority now is to build a fully clickable placeholder.

> I also want a recreation of bambu studio. This will be a related but different sub-app that
> should share human centered design traits. Build the UI prototype for this too. Again, if it is
> too much, we can save the 3D rendering for later, but make a UI skeleton that is interactive.
> Make design decisions that streamline the development process across sub-apps.

> figure out how to add functionality to the modeler and the slicer and do it

## Conceptual gaps I, the agent, filled in

- **One workbench shell, two specs.** `src/workbench/` is a declarative desktop-application shell:
  title bar, menu bar with dropdowns, command tabs with grouped tool buttons (SolidWorks'
  CommandManager, Bambu's top tabs), a left panel that is a tree or a settings panel, a property
  panel for the running tool with OK/Cancel (the PropertyManager pattern), a viewport with a
  heads-up view toolbar, an optional right panel, and a status bar. Each app is a spec (menus,
  tabs, tools with typed parameters) plus a document and a command handler. Light theme with a
  red accent for the modeler, dark theme with green for the slicer; the same interaction pattern
  everywhere (start a tool, fill its parameters, OK; Escape cancels; disabled tools say why).
- **A mesh layer instead of a kernel.** After Tyler asked for more functionality, the placeholder
  boxes became `src/workbench/geometry.ts`: convex profiles extrude and revolve on plane frames
  into triangle meshes; meshes move, turn, mirror, decimate, and report bounds and signed volume;
  STL reads and writes; horizontal slicing chains loops, offsets walls, and hatches infill. There
  are no booleans. A cut or hole is a mesh with reversed winding, which volume and slicing both
  treat as a hole and the viewport draws hollow. That is honest and cheap, and it is exactly the
  shape a real kernel would replace later.
- **The modeler has a real feature history and rebuilds real solids.** Sketches (plane, profile,
  size, offset from the plane, centre) and features (extrude with end conditions, revolve about
  the sketch centreline, cut, hole from the top face, mirror, linear pattern, reference plane;
  fillet, chamfer, shell recorded and badged "awaits kernel") are saved; `derive` rebuilds the
  part from them on every render. A new sketch's offset defaults to the top of the material, so
  stacking features behaves like sketching on the last face. Mass properties are signed mesh
  volumes; measure is the material's bounding box. The part exports as STL or goes to the slicer.
- **One orbitable viewport for both.** `Viewport3D.tsx` is an orthographic camera on a canvas:
  drag to orbit, shift-drag to pan, wheel to zoom, double-click or F to fit, arrow keys to orbit,
  standard views from the toolbar, click to pick, drag an object along the ground plane. Faces
  are painter-sorted and back-face culled; only edges where the surface bends by more than 20°
  are drawn, so a box shows twelve edges and a cylinder its rims.
- **The slicer really slices.** Objects are boxes, imported STL meshes (decimated to 4,000
  triangles so a plate stays storable), or the modeler's part. `slicing.ts` cuts the plate mesh
  into layers, classifies loops as outlines or holes, offsets walls inward, hatches sparse infill
  (grid, triangles, honeycomb, gyroid, lightning as hatch families) and solid infill on exposed
  top and bottom surfaces, adds a brim, and sums the paths into time, filament, and cost. Preview
  draws the paths by line type with a legend; the same paths export as G-code. Supports are not
  generated and the Device tab is a simulation; both say so.
- **Both are document modules that talk to each other.** They register in `documents.ts` and
  `editors.tsx`, so storage, drafts, backups, duplication, outputs, and card art came for free,
  and the host's `related` handle lets **Send to Slicer** and **Import from Modeler** move a part
  between them on the same project without either knowing about storage.

## What details should Tyler be able to fine tune by hand?

- In Junga: everything in the two specs is a data entry (menus, tabs, groups, tools, parameters
  with defaults and ranges) in `ModelerEditor.tsx` and `SlicerEditor.tsx`; presets for printers,
  materials, filaments, and infill patterns are constants in the models.
- In designer mode (group **Modeler and slicer**): feature tree width and right panel width.
- For further refinement: theme colours and accents (`workbench.css`), lighting, the smooth-edge
  angle, and camera speeds (`Viewport3D.tsx`), profile segment counts (`SEGMENTS` in the modeler
  model), the slicer's speeds, solid layer count, brim loops, and path colours (`slicing.ts`), the
  mesh budget (`MAX_TRIANGLES`), and the status bar contents.
- Not built, and the obvious next steps: support generation, a free sketcher, fillet/chamfer/
  shell geometry (a boundary-representation kernel or a mesh-based approximation), 3MF, printer
  connectivity, and an asset store so meshes leave the library key. The shell, documents, and
  mesh layer are shaped so those slot in without moving the UI.
