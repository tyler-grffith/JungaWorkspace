## New Workspace Feature: 3D Modeler and Slicer prototypes

## Context

Tyler's list of workspace mediums includes a 3D modeler and a slicer; his daily tools are
SolidWorks (in a GPU-passthrough Windows VM) and Bambu Studio. A real geometry kernel and a real
slicer are large pieces of work, so these two modules are clickable prototypes: everything around
the 3D rendering is real (menus, command tabs, feature history, property panels, settings, plates,
outputs, saving) and the rendering is a projected-box stand-in.

## Tyler's Request

> next make the 3D modeler recreation of solidworks. If it is too slow or expensive to build an
> actual 3D modeler right now, just build a UI that looks just like solidworks and with clickable
> buttons and everything except for the rendered 3d model. You can expect me to make changes and
> additions to this app later, but the priority now is to build a fully clickable placeholder.

> I also want a recreation of bambu studio. This will be a related but different sub-app that
> should share human centered design traits. Build the UI prototype for this too. Again, if it is
> too much, we can save the 3D rendering for later, but make a UI skeleton that is interactive.
> Make design decisions that streamline the development process across sub-apps.

## Conceptual gaps I, the agent, filled in

- **One workbench shell, two specs.** `src/workbench/` is a declarative desktop-application shell:
  title bar, menu bar with dropdowns, command tabs with grouped tool buttons (SolidWorks'
  CommandManager, Bambu's top tabs), a left panel that is a tree or a settings panel, a property
  panel for the running tool with OK/Cancel (the PropertyManager pattern), a viewport with a
  heads-up view toolbar, an optional right panel, and a status bar. Each app is a spec (menus,
  tabs, tools with typed parameters) plus a document and a command handler. Light theme with a
  red accent for the modeler, dark theme with green for the slicer; the same interaction pattern
  everywhere (start a tool, fill its parameters, OK; Escape cancels; disabled tools say why).
- **The modeler has a real feature history.** Sketches (plane, profile shape, size) and features
  (extrude, revolve, cut, hole, fillet, chamfer, shell, mirror, pattern, plane) with their
  parameters are saved; the FeatureManager tree shows planes, origin, material, orphan sketches,
  and features with their consumed sketch; suppress, delete, undo/redo, rebuild, orientation,
  display style, section view, planes and origin toggles, material, appearance color, units, mass
  properties, and measure all work on that history. The viewport projects each extrusion as a
  stacked box and each cut or hole as a dashed box (isometric, front, top, right), so the tree and
  the picture agree without a kernel. Mass properties come from those boxes and the material.
- **The slicer has real settings and plates.** Printer and nozzle, filament (type, brand, color),
  process (layer height, walls, infill and pattern, supports and type, brim, seam, speed profile,
  temperatures), plates with box objects (add, clone, delete, arrange, edit position and size),
  Prepare/Preview/Device/Project views. Slicing computes a consistent estimate (time, grams,
  metres, layers, cost) from object volume and settings; Preview shows layers up to a slider;
  Device simulates a printer with temperatures and progress; Project holds notes and plates.
- **Honest placeholders.** Tools that need geometry (trim, offset, split, cut mesh, paint
  supports, import STL, export STEP or G-code) are present but disabled or answer with a status
  message saying what they await, so the layout is complete without pretending.
- **Both are document modules.** They register in `documents.ts` and `editors.tsx`, so storage,
  drafts, backups, duplication, outputs (read-only model view and plate view on the output route),
  and library-card art came for free. A generic `ModuleOutputs` panel serves both.

## What details should Tyler be able to fine tune by hand?

- In Junga: everything in the two specs is a data entry (menus, tabs, groups, tools, parameters
  with defaults and ranges) in `ModelerEditor.tsx` and `SlicerEditor.tsx`; presets for printers,
  materials, filaments, and infill patterns are constants in the models.
- In designer mode (group **Modeler and slicer**): feature tree width and right panel width.
- For further refinement: theme colors and accents (`workbench.css`), the isometric projection
  and box shading (`Isometric.tsx`), the estimate model (`estimateSlice`), the stand-in solids
  (`solids`), and the status bar contents.
- Not built, and the obvious next steps: a real renderer (three.js or WebGL) behind the same
  viewport slot, a sketcher, a geometry kernel or a boundary representation import, STL/3MF
  loading, real slicing, and printer connectivity. The workbench shell and documents are shaped
  so those replace the placeholders without moving the UI.
