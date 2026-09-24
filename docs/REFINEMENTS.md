# Small refinements

For Tyler: run the development app and click **User mode** in the top bar to enter designer mode. Choose an area, adjust the controls, and switch back to user mode to try the preview at full workspace width. **Save design** writes accepted settings to [Design/settings.json](../Design/settings.json); **Revert preview** restores the last loaded design. Saving does not commit, merge, or deploy.

Areas: **Label manager** (control variants, rotation step, popup geometry, with a sample using the real label manager), **Graph layout**, **Spreadsheet** (default column width, row height, cell text size), **Visual canvas** (page strip and inspector widths, default grid size, default fill and stroke, selection color, rulers), **Document** (outline width, default font, text size, margin, page shadow), **Collection** (tree and detail widths, card width, cover shape), **Shared appearance** (accent, sidebar, text, border and soft colors; button and card corners; base text size; heading font), **Workspace shell** (sidebar width, content width and padding, brand and workspace text), and **Project library** (grid columns, default view and sort, example buttons, library copy). Every control is one entry in [src/design/registry.ts](../src/design/registry.ts); see [ARCHITECTURE.md](ARCHITECTURE.md) for adding more.

Previews persist in this tab's session storage, separately from project data. Close the tab only after saving or downloading a preview you want to keep. If the saved design changes elsewhere, save detects a stale revision and retains your preview. Download it if needed, then use **Discard preview & load saved**. Production builds include accepted design settings and omit the designer controls and save endpoint. This is a local development tool, not an account permission system.

For changes beyond the panel, write one sentence under **Need a small code change?**, then **Copy request for agent** and paste it into whichever agent session you are using. Copying includes the area, relevant files, and this protocol; it does not start a model. A short message in a current session also works. There is no need for a new session per adjustment.

## Agent protocol

- Read the request, the relevant feature record, and the affected implementation. Start with the design registry when it covers the request; avoid rescanning the whole project.
- If the request is a value Tyler will likely adjust again, register it as a design setting instead of hard-coding the new value.
- Make the smallest complete change. Keep unrelated refactoring, dependencies, and redesigns out of the increment. If the requested outcome requires broader work, explain the scope before expanding it.
- Verify what changed: visual inspection for copy/spacing, targeted behavior checks for interactions, and data round-trip checks when a setting changes validation or persistence. Run the required repository checks; avoid adding tests that merely repeat cosmetic implementation details or repeatedly running unaffected suites.
- Update the feature's existing record; create a concise record for a genuinely new feature using the owner's four-section convention. Add unresolved follow-ups to the shared task list and a short work-log entry.
- Finish with the result, what was checked, and any material limit. ProductManagement remains read-only. No merge or deployment authority is granted by this workflow.

For a batch of small changes, a lighter model or lower reasoning setting in your agent tool is usually enough; copy changes need very little. Delegation to subagents is available for bounded independent work but adds coordination and is not automatically cheaper. No task or subagent is started by this document.
