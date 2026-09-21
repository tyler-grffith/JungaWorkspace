## New Workspace Feature: Viewing a Bundled Project's Files

## Context

A bundled source project's **Working material** listed its modules, assets, licenses,
documentation and maintenance files as paths and one-line descriptions. You could read what each
file was for, but not what was in it.

## Tyler's Request

> Can we make the modules and Assets and licenses and documentation and maintenance files viewable?

## Conceptual gaps I, the agent, filled in

- Every manifest row that can be shown is now a button reading **View file**; a row with no
  available file stays plain text rather than opening an empty dialog.
- Application source is bundled as raw text through a narrow `import.meta.glob`, one lazily loaded
  chunk per file, so nothing is downloaded until a file is opened and no test files are pulled in.
  Served assets under `public/` are fetched from their normal URL instead, which keeps the viewer
  working from a hosting subfolder.
- The viewer reuses the code module's CodeMirror in read-only mode, so a `.tsx` module, a shader and
  a license file each read the way they do in an editor. Images preview inline; text longer than
  120 KB is truncated with a note naming how much is not shown, because `timezones.geojson` alone is
  over a megabyte. Served files also offer **Open in a new tab** for the complete original.
- The dialog says the file ships with the application and is read-only, so it is never mistaken for
  something a project owns or can edit.

## Follow-up Tyler approved: copying a file out

- Any viewable text file offers **Copy into**, choosing an existing code project or a new one. The
  copy lands at its path below the scene root (`shaders/earth.frag`, not the whole repository path)
  and is numbered rather than overwriting a file already there (`math-2.js`).
- The whole file is copied, never the truncated preview. Files a code project cannot store — the
  megabyte of time-zone data, the textures — are refused with the reason, not silently skipped.
- A new project starts from that one file rather than the starter template, and takes the bundled
  project's name plus "files". The confirmation names the project it actually created and links
  straight to its files.

## What details should Tyler be able to fine tune by hand?

- In Junga: which files the manifest lists and how each is described (`manifest.ts`).
- For further refinement: the 120 KB preview limit, the dialog's width and height, and whether
  images should show their pixel dimensions or file size.
- For the copy: the name a new project takes, and whether copying a file should bring its imports
  with it.
- Not built, and awaiting a decision: copying a whole manifest group at once, and syntax
  highlighting for GLSL shaders (no CodeMirror language package for it is installed).
