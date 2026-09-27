## New Workspace Feature: Import and the Library Folder

## Context

The library only grew by hand: a new project, then typing or pasting into an editor, or a
whole-library backup restore. The modules could already read files in their own way (draw.io,
Markdown and HTML, STL, pictures, collection JSON, code files), but only from inside an open
editor, one at a time. And the library lived only in browser storage, which clearing site data
destroys and no other tool can see. This is the first step toward the app being the home of all
of Tyler's projects, stored locally.

## Tyler's Request

> figure out the import functionality and library creation/maintenance so this app can
> hypothetically become the home of all my projects stored locally and referencable and
> mutually linkable.

## Conceptual gaps I, the agent, filled in

- **One Import for the whole library.** **Import** beside **New project**, or files dropped on
  any library page, opens a dialog that shows what each file will become, with the kind
  adjustable where a file could be several things (an HTML file is a document or a code
  project; a JSON file is a Junga project, a backup, a collection export, or code) and the
  project name editable. Every file becomes a project of its own; a chosen folder becomes one
  code project keeping its paths. All of them are added in one save, filed in a chosen
  collection; a single import opens at once. `src/import/importers.ts` is a registry of kinds
  that reuses each module's own importer, plus a small CSV/TSV reader for spreadsheets.
- **A project is a file of its own.** **Export project…** in every project menu writes
  `<name>.junga-project.json`; importing it into any library adds an independent copy (new id,
  fresh output ids, a "(restored)" suffix only if the name is taken), the same way a backup
  restores copies. A library backup dropped on the import dialog is handed to the restore
  dialog, because restoring is a bigger decision than importing.
- **A library folder mirrors browser storage.** **Keep a folder in step** at the bottom of the
  sidebar chooses a folder on this computer (File System Access API; Chrome and Edge); after
  every successful save Junga writes `junga-library.json` (the backup format) and one project
  file per project under `projects/`, removing files of projects that are gone. The folder is a
  mirror the user can back up, sync, or keep in git; browser storage stays the working copy, so
  nothing else in the app changed. **Load from folder…** brings the folder's library into any
  browser through the restore dialog; **Write now** and **Allow writing** cover the click the
  browser needs after a reload. Firefox and Safari see an explanation and keep working with
  downloaded backups.
- Built-in examples are written to the folder only once edited, as in backups.

## What details should Tyler be able to fine tune by hand?

- In Junga: the kind and name of each import, its collection, which folder is connected, and
  when to write or load.
- For further refinement: the extensions each kind accepts (`kindsFor`), the default kind order,
  the sheet reader's delimiter rules and the 200 × 26 bound, how code files are grouped, the file
  names in the folder (`projectFilePath`), the folder's README text, the write delay (1.5 s), and
  the dialog copy.
- Not built yet: Desmos and Excel formats (the former has no export the browser can read; the
  latter needs a zip reader), reading edits made in the folder by other tools back into the
  library (the folder is one-way), a per-project folder with native files, and automatic
  reconnection without the browser's permission click.
