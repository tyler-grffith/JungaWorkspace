## New Workspace Feature: Project Links

## Context

The pre-development plan wants a universal project library that is "readily accessible and
referenceable". Collections could already file a Junga project link, and portfolios feature
projects by reference, but a project had no way to say what it relates to, and nothing showed
where a project was referenced from. This makes projects referencable and mutually linkable.

## Tyler's Request

> figure out the import functionality and library creation/maintenance so this app can
> hypothetically become the home of all my projects stored locally and referencable and
> mutually linkable.

## Conceptual gaps I, the agent, filled in

- **Related projects are named in one direction and seen from both.** A project keeps
  `relatedIds`; the overview's context column lists them (with an unlink control) and **Link a
  project** opens a searchable picker where each click links at once. The other side sees the
  link under **Linked from**, so a link never has to be made twice, and a directed link is still
  meaningful ("this builds on that").
- **Backlinks gather everything that points at a project.** `src/linking.ts` finds projects that
  name it, collection items whose link is its route, document phrases linked to it, and
  portfolios that feature it, without those places knowing about each other. Trashed sources
  drop out; archived ones stay.
- **Documents can link to projects.** The link box accepts `#/project/<id>` beside web
  addresses, and such links open in place rather than in a new tab, in the editor's preview, the
  reading output, and exported HTML.
- **Copy link** in every project menu puts an address on the clipboard that works wherever the
  app is hosted (site root or subfolder), so a project can be referenced from notes, documents,
  collections, chats, and other tools.
- Links survive duplication (the copy relates to the same targets) and restore-as-copies (links
  between restored projects follow the copies; links to built-in examples keep their ids).
  Validation is lenient about targets that no longer exist, so a library never becomes
  unreadable because a link went stale; the overview simply omits it.

## What details should Tyler be able to fine tune by hand?

- In Junga: which projects a project names, in what order (link and unlink), and links in
  documents and collections.
- For further refinement: the picker's ordering and size (`LinkProjectForm` in `App.tsx`), the
  backlink kinds and their detail lines (`backlinks` in `src/linking.ts`), the context column's
  styling (`.related-list` in `styles.css`), and whether links should become two-way on creation.
- Not built yet: links from graph and spreadsheet cells, `[[wiki-style]]` links in notes, a graph
  view of the whole library's links, and tags.
