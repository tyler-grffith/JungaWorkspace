# Current handoff

## Ready for product review

First increment: **library organization and project lifecycle**. Local branch: `codex/library-prototype`.

Run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173.

### Try this

1. Create a collection and a project. Choose graphing, spreadsheet, or both.
2. Add notes and a reference link. Refresh and reopen the project.
3. Favorite, duplicate, or archive it. Move it to trash and restore it.
4. Search, filter by tool, and switch grid/list views.
5. Optionally use the LaPlace Intuition starter to create a project containing the first Desmos reference and notes.

### Boundaries

- Graphing and spreadsheet editors are not implemented yet; tool panels say so. Project metadata, references, and notes are functional.
- Projects live in local storage in the current browser at the exact site address. No authentication, backend, synchronization, or deployment.
- Downloadable JSON backups are available. Restoration/import is deferred. Trash is recoverable; no permanent deletion is exposed.
- Failed note saves retain a draft and warn before navigation. Unreadable saved data is left untouched with a raw-data download available.
- Other tabs receive changes. This is a single-user prototype, not a collaborative editing system.
- The large example workbook has not been exhaustively analyzed; its accompanying note identifies it as a future capability target.
- No ProductManagement file has been edited. Existing owner changes remain outside the implementation commit.

### Review prompts

- Does a project containing one or both tools fit your expectations?
- Do collection organization and the project overview feel natural?
- What should change in the visual direction before building the editors?

### Next increment

Per the agreed sequence, add a basic spreadsheet editor inside the saved project. The graphing editor follows, using LaPlace Intuition as its early target. Preserve separate data models for the two tools. Revisit priorities after the first library discussion.

Verification results are recorded in WORK_LOG.md. The GitHub workflow is configured but has not been run remotely. Merging and deploying await the product owner's decision.
