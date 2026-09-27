## New Workspace Feature: Portfolio

## Context

The pre-development plan names the purpose of the workspace as the creation, storage, and
presentation of work, and lists portfolios first among the things to export. Decision 26 planned a
portfolio as a library-level presentation view that reads projects rather than editing them,
sharing a per-module presentation render with export targets. Nothing had been built; this is the
first presentation view and the first export target outside a single module.

## Tyler's Request

> Make a feature in the web app for assembling a portfolio

## Conceptual gaps I, the agent, filled in

- **A portfolio belongs to the library, like a collection.** `library.portfolios` is an optional
  list (`src/portfolio/model.ts`), so older libraries and backups load unchanged; it is validated
  on every read and write, carried by backups, and restore-as-copies remaps its entries to the
  copied projects and outputs. The sidebar lists portfolios under **PORTFOLIOS** with a **+**.
- **Entries are references, not copies.** An entry points at a project and, optionally, at one of
  its outputs (a canvas presentation, a reading page, a model view…), with an optional shown
  title, caption, role line ("Design and analysis · 2026"), and size (normal or wide). Because
  nothing is copied, a portfolio always shows the current state of the work. A trashed or missing
  project stays in the editor with a warning and drops out of the reader's page.
- **Assembly is one screen in three columns.** Left: title, tagline, name, introduction, links,
  layout (cards or rows), and accent colour. Middle: sections with editable titles and
  descriptions, each holding entry cards with a live preview and the entry's fields, arrows to
  reorder (an entry crosses into the neighbouring section at the edge), a section selector, an
  open-project link, and remove. Right: the library picker, searchable, with the target section;
  a project already in the portfolio can be added again featuring an output it does not feature
  yet, and rests when nothing is left to feature. Edits save after a pause in typing, like the
  module editors, and a failed write keeps a draft that rides in backups.
- **Two ways in.** The picker on the assembly page, and **Add to portfolio…** in every project's
  menu (cards and the overview), which offers the existing portfolios and their sections, the
  project's outputs to feature, and makes a first portfolio when none exists.
- **Every module renders for presentation.** `src/present/ProjectPreview.tsx` draws one static
  figure per module from the saved document: a live graph plot with grid, axes, curves, points,
  linked series, and labels; the used range of a spreadsheet as a table with formats; the first
  canvas page (or the featured page); the top of a document; a mosaic of collection covers or its
  collection tiles; the painter's picture with its filament swatches; a top-down build plate with
  its objects; a model with its feature list; a file list for code; a globe for the Earth clock.
  Each is inline SVG or plain HTML with colours inline, so the same components draw the editor's
  cards, the in-app page, and the exported file. `previewSummary` gives the one-line facts shown
  beside each ("5 curves · 2 sliders", "1,240 words").
- **One page for the app and the export.** `PortfolioPage.tsx` renders hero, contents, sections,
  and entries; its stylesheet is a string (`pageStyle.ts`) so the standalone HTML export inlines
  it. In the app the page is the read-only route `#/portfolio/<id>/present` (**Preview**), with
  export buttons and print. `src/export/portfolio.ts` is pure: `portfolioHtml` renders the same
  component to a self-contained file whose entries link to the project's reference URL (a reader
  of the file has no library), and `portfolioMarkdown` writes the outline.
- **A designer group, Portfolio.** Panel and picker widths, preview height, default layout and
  accent for new portfolios, and the page's eyebrow and footer line.

## What details should Tyler be able to fine tune by hand?

- In Junga: title, tagline, name, introduction, links, layout, accent; section titles,
  descriptions, and order; per entry the shown title, role, caption, featured output, size,
  section, and order; which portfolio and section a project joins from its menu.
- In designer mode (group **Portfolio**): settings panel width, library picker width, preview
  height, default layout, default accent, page eyebrow, page footer line.
- For further refinement: which module's figure stands for a multi-tool project (`PRIORITY` in
  `ProjectPreview.tsx`), figure sizes and the used-range limits of the sheet table, the page's
  type and spacing (`pageStyle.ts`), the editor's columns (`portfolio.css`), the export's
  `<title>` and Markdown shape, and the wording of the empty states.
- Not built yet: page themes beyond the accent colour, hand-uploaded cover images per entry,
  PDF beyond the print dialog, publishing to a host (the export is a file to put anywhere), and
  the blog, which can reuse the presentation render and the page component as they are.
