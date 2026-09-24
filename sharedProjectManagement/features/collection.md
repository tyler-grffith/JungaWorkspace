## New Workspace Feature: Collection

## Context

Tyler's product plan lists hobby libraries: a photo library, a movie library, ideas, browsed as
lists or lists with preview images that open little windows of text, images, and links. The
Collection module is that idea as a sixth module: a way to curate collections of things that is
quick to change and pleasant to browse.

## Tyler's Request

> make another sub-app that is called "collection" which is a way to curate collections of
> things. For example music with links to youtube music that display the relavent information
> about the song including user writing and a little window to display the album/song cover.
> Collections should be able to nest. For example music is the parent of all music but within that
> there can be albums. Children of one collection should be able to be children of multiple
> different collections as well. Other examples besides music: movies, photography, poems, etc.
> Each collection should be flexible in what kinds of elements it supports: different combination
> of image, link, text, etc. The primary goal for this sub-app is to be easily updated and malleble
> so there isnt much barrier to making or updating collections. The secondary goal is to make it
> easy for the user to quickly make a nice looking and easy to peruse curation of different things.

## Conceptual gaps I, the agent, filled in

- **A graph, not a tree.** The document is a pool of items plus collections that reference items
  and child collections by id. A collection or an item can be filed under several parents without
  copying, so "Albums" can sit under both "Music" and "Favourites" and a song can be in an album
  and a playlist. Loops are refused at validation; removing a collection from one parent keeps it
  if another parent still holds it, and deletes it (and items only it holds) otherwise.
- **Fields per collection, values per item.** Each collection names the fields its items show
  (short text, long text, link, number, date, tags) and whether each appears on the card. Items
  hold whatever fields they have, so one item can appear in collections with different templates.
  Presets (Music, Movies, Photography, Poems, Books, Ideas, blank) seed the fields, emoji, accent,
  and layout; every one of those is editable afterwards.
- **Low barrier to adding.** One box adds an item from a typed title or a pasted link; the detail
  panel opens at once for the rest. A YouTube or YouTube Music link produces the cover from the
  video id with no upload. Names, descriptions, and emoji edit in place; layout, sort, accent color,
  and fields are one control each.
- **Images** are either an `https` link or an uploaded image downscaled to 800 px and bounded at
  200 KB, with the document bounded at 2.5 MB, because the library shares one local-storage key.
  Covers link to the item's source where one exists.
- **Browsing.** Grid, list, and gallery layouts; a sticky tree; breadcrumbs; sub-collection cards
  with counts; search within a collection once it holds more than a few items; a read-only
  `collection-browse` output on the output route plus Browse from the editor. Export writes
  Markdown for everything, or JSON that re-imports (merging under the current collection).
- **Shared editor host.** Collection is the first module wired through the new document-module
  registry (`src/modules/documents.ts`, `src/modules/editors.tsx`): storage, validation, drafts,
  outputs, the output route, card art, and the shell's editor branch come from two registry
  entries. Canvas and Document were moved onto the same host, so the next modules (3D modeler,
  slicer) add no new wiring in `App.tsx`.

## What details should Tyler be able to fine tune by hand?

- In Junga: collection name, description, emoji, accent, layout, sort, fields (name, kind, on
  card), where a collection is filed; per item, title, subtitle, link, image, rating, every field,
  notes, and which collections hold it; item order in manual sort.
- In designer mode (group **Collection**): tree width, detail panel width, card minimum width,
  cover shape.
- For further refinement: the preset list and their fields, link-label mapping (YouTube Music,
  Spotify, Letterboxd, IMDb), the quick-add title heuristic, storage bounds, card typography.
- Not built yet: drag-and-drop ordering and filing, bulk import from CSV or a Spotify/YouTube
  export, fetching titles and covers from a pasted link (needs a server or a CORS-friendly API),
  tag-based smart collections, and an items-across-all-collections search.
