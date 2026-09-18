# Decisions

## Confirmed with product owner

- ProductManagement is read-only for agents. Product direction and final authority belong to the owner.
- Browser app; functional prototype by October 15, 2026. UX refinement and external launch follow later in the semester.
- First MVP includes the library, spreadsheet, and graphing calculator. Build the library first, then small working editors.
- Spreadsheet and graphing data remain separate initially. Connecting them is a core later goal. Importing is deferred.
- Branches and pull requests are authorized. Merges and deployments require discussion and owner authorization.

## Implemented decisions awaiting owner review

1. **First increment: library lifecycle.** Projects contain metadata, notes, a reference link, and selected tool types. Selecting a tool does not yet provide an editor. This makes the storage/navigation foundation reviewable without claiming calculator functionality.
2. **Organization.** One collection per project, plus favorites, archive, and recoverable trash. Deleting a collection keeps its projects. No permanent project deletion yet.
3. **Storage.** Save locally in the current browser at the current origin. Show this limitation in the interface; provide a downloadable JSON backup. Accounts, synchronization, and backup restoration are future work. Validate saved data and leave unreadable data untouched.
4. **Implementation.** React, TypeScript, and Vite; a small domain module separates project rules and persistence from the UI. Pinned dependencies and unit/browser checks support later agents and CI. Official references: https://react.dev/learn/creating-a-react-app and https://vite.dev/guide/.
5. **Initial design.** Quiet, light workspace with a persistent library sidebar, green accent, grid/list browsing, and a focused project overview. Desktop first, usable on narrow screens. User refinement pending.
6. **Examples.** Offer an optional LaPlace Intuition reference project with source link and notes. Do not preload user examples as if they were imported working models. The larger aircraft graph and engineering workbook remain future capability references.

Review status: all six implemented decisions are **unreviewed**. Record owner feedback here when discussed; do not treat implementation as approval.
