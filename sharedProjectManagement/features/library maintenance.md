## New Workspace Feature: Library Maintenance

## Context

For the app to be the home of all of Tyler's projects, the library has to stay manageable as
it grows: quick to open things from, searchable by what a project is, honest about what it can
hold, and able to let go of work for good. Before this pass the trash could not be emptied
(decision 2 deferred permanent deletion), the browser's storage allowance was invisible, and
opening a tool took two clicks from the library.

## Tyler's Request

> After you are done, go through a few rounds of refinement for all aspects of the web app
> where you analyze it from a user perspective and anticipate friction points then formulate
> solutions and implement them.

## Conceptual gaps I, the agent, filled in

- **Tool chips on cards open the editor.** Each chip on a project card is a button
  ("Open spreadsheet · Footbridge study") that creates the tool's document if needed and opens
  it, so the overview is a stop only when wanted.
- **Sort by recently opened; search by what a project is.** The sort menu (and the design
  registry's default sort) gained _Recently opened_; search also matches tool names and the
  collection a project is filed in. Collections in the sidebar show their counts.
- **Delete forever and Empty trash.** A trashed project's menu offers _Delete forever_, and the
  trash page offers _Empty trash_; both confirm, and the confirmation suggests _Export project…_
  first. Deleting also drops the project from other projects' related links and from portfolio
  entries, so nothing points at what is gone. Built-in examples cannot be deleted.
- **A storage meter.** The _Saved in this browser_ dialog shows how much of the roughly 5 MB a
  browser allows the library uses, amber past 70 % and red past 90 %, with a pointer to the
  library folder and exported project files as the way past the limit.
- **A backup reminder.** The sidebar's storage note says when the library was last downloaded as
  a backup, or that it never was, once the library has projects of the user's own.
- **Smaller frictions.** The import dialog's file inputs were showing; spreadsheet and document
  previews were cropped in compact portfolio cards; an unbounded canvas board opened showing a
  corner rather than its content; the sidebar had grown past a laptop's height; the welcome panel
  now offers _Import existing files_; the document link box offers the library's projects.

## What details should Tyler be able to fine tune by hand?

- In designer mode: the default sort (now including _Recently opened_).
- For further refinement: the storage allowance constant and thresholds (`STORAGE_BUDGET` in
  `App.tsx`), the confirmation wording, the chip labels, the sidebar spacing (`.nav-item`,
  `.collections-label` in `styles.css`), the backup reminder's wording and when it appears.
- Not built yet: multi-select and bulk actions, undo for permanent deletion (by design), a
  "continue where you left off" strip, and moving storage off the single local-storage key.
