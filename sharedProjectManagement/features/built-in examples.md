## New Workspace Feature: Built-in Examples That Open Rather Than Copy

## Context

The library offered a **Cosmic Clock** button, a **Create octahedron example** button, and a welcome strip for the first graph. Each click created another copy of the same project, and only three of the workspace's modules had an example at all.

## Tyler's Request

> Make a class of projects called examples that are permanently on the web app no matter the user save data and put them all in the same folder. […] Make a separate class of projects that are selected as "shortcuts" that also are permanently on the web app […] accessible on the left of the web-app UI with Workspace and Collections. Make Cosmic Clock and Octahedron sections the first two projects in shortcuts.
>
> (Earlier the same day:) The Cosmic Clock button should open the Project Cosmic Clock. It shouldn't open a new project which is a copy of that. This is one example but there should be a whole class of projects that have shortcuts to open that specific project built into the app without creating more copies. The same thing goes for the octahedron example.
>
> There should be examples for each type of project. Cosmic Clock is an example of a code project. Octahedron example is an example of combining spreadsheet with graphing calculator. Use the examples of spreadsheets and graphing calculator in the project management folder. The example visual canvas should be a recreation of PDR_visuals.drawio and the document example should be Pre-Development-Plan [Junga Workspace] in google drive.

## Conceptual gaps I, the agent, filled in

- (Second request, same day.) Examples are built-in projects: present in every library whatever is saved, merged over the stored library on every read. Editing one stores an overlay under its id, so the edit persists and travels in backups; **Reset to original** discards it. Built-ins cannot be archived or trashed, live in the **Examples** sidebar view rather than All projects, and duplicate into ordinary projects.
- **Shortcuts** is a separate sidebar group beside Workspace and Collections, linking straight to chosen examples at their opening route (the side-by-side workspace for Octahedron Sections). Which examples, and in what order, is the `Shortcut examples` designer setting, Cosmic Clock and Octahedron Sections by default.
- The heavy draw.io board loads the first time its project opens rather than on every app start; the module loading fallback shows meanwhile.
- One example per kind of project. From Tyler's material: **XJ-1 Flight Envelope** (graph, from the Desmos model: constants stay constants, the density ratio is the reader's slider, the reference's label anchors became curve labels and notes, and the best-climb line uses an analytic derivative since the calculator has no derivative operator), **Compressible Flow Calculator** (sheet, from the workbook's calculator sheet: named inputs and Mach/β sliders feed isentropic, shock, Rayleigh, Fanno, and Prandtl–Meyer panels; the workbook's LAMBDA names are inlined), **PDR Visuals** (canvas, the original draw.io file bundled with the app and imported through the canvas importer on first open, its eight pictures downscaled to fit the document budget), **Pre-Development Plan** (document, from the Google Doc), and **Workspace Ideas** (collection, from the sub-app and library-ideas notes). Small originals fill the rest: **Orbit Sketch** (code files with a run output), **Mounting Bracket** (modeler + slicer, so Send to Slicer has a plate), and **Sunset Relief** (painter + slicer, its picture drawn by the example itself).
- The XJ-1 graph needed axes that scale independently (speed in the thousands, power in the ten-millions), so **Equal axes** became a per-graph checkbox; it stays on by default wherever points or implicit equations used to force it.
- Example cards and overviews say "Example", so a reader can tell the built-in project from a copy.

## What details should Tyler be able to fine tune by hand?

- Now: every example's title, description, notes, reference link, documents, outputs, and opening route are one entry in `src/modules/examples.ts`, with larger content in `src/examples/<name>.ts`; the Examples view follows the array order; **Shortcut examples** in designer mode chooses and orders the sidebar shortcuts; **Offer example projects** hides the welcome strip's example.
- Possible refinements: a design setting for which examples appear on the welcome strip; letting a user's own project be pinned as a shortcut; keeping the draw.io pictures at full size once an asset store exists; a derivative operator in the calculator so the XJ-1 graph can write `d/dx` as the reference does.
