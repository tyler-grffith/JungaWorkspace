## New Workspace Feature: Document

## Context

Google Docs is on Tyler's list of favourite apps to recreate ("slides, docs"). With the visual
canvas covering slides, diagrams, and mockups, the document is the writing surface: notes,
reports, and the text that accompanies other project work. It is the fifth module, wired the same
way as graphing, spreadsheet, code, and canvas.

## Tyler's Request

> Ok now build another sub-app that recreates google docs called "Document". do this on the same
> branch.

## Conceptual gaps I, the agent, filled in

- **The page is one contenteditable region, edited natively.** The browser handles typing,
  selection, caret movement, spellcheck, and undo/redo. On every change the page is parsed back
  into blocks and saved; the model is written back into the page only when the document changes
  from outside (another tab, an import). This keeps the editor small, keeps native undo intact,
  and avoids the caret bugs of re-rendering a contenteditable from state.
- **Structural edits are ours, not the browser's.** Chrome's `formatBlock` and list commands leave
  stray empty paragraphs and nest lists inside neighbouring paragraphs, so headings, quotes, code
  blocks, lists, indent/outdent, dividers, and images are done with small DOM operations that keep
  the caret where the writer expects it. Inline formatting (bold, italic, underline, strike, links)
  still uses the browser's commands, which behave well.
- **The model is blocks of runs.** Paragraph, title, three heading levels, bulleted and numbered
  list items with indent, quote, code, divider, and image blocks; each text block holds runs with
  a set of marks (bold, italic, underline, strike, code) and an optional `https`, `http`, or
  `mailto` link. Alignment is per block. Font, size, and line spacing are document-wide, with page
  size (Letter or A4) and margin. Only the tags the renderer writes (plus the aliases browsers
  produce) survive parsing, so pasted HTML is reduced to this vocabulary.
- **Docs-style shortcuts.** `# `, `## `, `### `, `#### ` for title and headings, `- ` and `1. ` for
  lists, `> ` for a quote, "```" for code; Tab and Shift+Tab nest list items; Enter on an empty
  item leaves the list; Enter after a heading or quote returns to normal text; Backspace at the
  start of a heading, quote, or code block makes it a paragraph; Ctrl+K links, Ctrl+Shift+X strikes,
  Ctrl+Alt+0–4 sets text style.
- **Outline and counts.** Headings appear in a sticky outline that scrolls the page; the footer
  shows words, characters, an estimated page count, and page settings.
- **Reading output.** A `document-read` output presents the document on the read-only output route
  with an outline and a print button; the editor's Preview opens the same reader.
- **Export and import.** Markdown, HTML, plain text, and PDF (print dialog); import of Markdown,
  HTML, and text files, appended to a document or replacing an empty one. The Markdown reader and
  writer are pure functions in `model.ts` and unit-tested as a round trip.
- **Images** are inserted as data URLs after downscaling (1400 px long edge, 600 KB cap) with a
  width control (25–100 %), under the same 2.5 MB per-document bound as the canvas, for the same
  reason: the library shares one local-storage key.

## What details should Tyler be able to fine tune by hand?

- In Junga: text style per block, inline marks and links, alignment, list nesting, images and
  their width, font family, text size, line spacing, page size and margin.
- In designer mode (group **Document**): outline width, default font, default text size, default
  margin, and whether the page casts a shadow on a grey desk or sits flat.
- For further refinement: the shortcut table, heading sizes and spacing (`.doc-content` rules in
  `document.css`), the font list, storage bounds, the page-count estimate, and the reader layout.
- Not built yet: per-run fonts and colors, tables, footnotes, comments, headers and footers, page
  breaks as real pagination, find and replace, collaborative editing, and DOCX export.
