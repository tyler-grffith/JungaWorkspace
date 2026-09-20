# Small refinements

For Tyler: run the development app and click **User mode** in the top bar to enter designer mode. Choose an area, adjust the controls, and switch back to user mode to try the preview at full workspace width. **Save design** writes accepted settings to [Design/settings.json](../Design/settings.json); **Revert preview** restores the last loaded design. Saving does not commit, merge, or deploy.

The label area includes a sample using the real label manager, so it works even from the library. The angle field starts as typed input and accepts decimals from −180° to 180°. Rotation buttons and the optional dropdown use the chosen step. Custom styles already saved in projects keep their size; the default size applies to unstyled labels. Width, padding, label offsets, graph panel width, formula text size, accent/sidebar colors, and button corners are adjustable.

Previews persist in this tab's session storage, separately from project data. Close the tab only after saving or downloading a preview you want to keep. If the saved design changes elsewhere, save detects a stale revision and retains your preview. Download it if needed, then use **Discard preview & load saved**. Production builds include accepted design settings and omit the designer controls and save endpoint. This is a local development tool, not an account permission system.

For changes beyond the panel, write one sentence under **Need a small code change?**, then **Copy request for agent** and paste into a Codex task. Copying includes the area, relevant files, and this protocol; it does not start a model. A browser comment or a short message in the current task also works. There is no need for a new task per adjustment.

## Agent protocol

- Read the request, the relevant feature record, and the affected implementation. Start with the design settings when they cover the request; avoid rescanning the whole project.
- Make the smallest complete change. Keep unrelated refactoring, dependencies, and redesigns out of the increment. If the requested outcome requires broader work, explain the scope before expanding it.
- Verify what changed: visual inspection for copy/spacing, targeted behavior checks for interactions, and data round-trip checks when a setting changes validation or persistence. Run the required repository checks; avoid adding tests that merely repeat cosmetic implementation details or repeatedly running unaffected suites.
- Update the feature's existing record; create a concise record for a genuinely new feature using the owner's four-section convention. Add unresolved follow-ups to the shared task list and a short work-log entry.
- Finish with the result, what was checked, and any material limit. ProductManagement remains read-only. No merge or deployment authority is granted by this workflow.

For a dedicated batch of small changes, a reusable **UI refinements** task with GPT-5.6 Luna and medium reasoning is a reasonable starting point; low reasoning suits very simple copy changes. Delegation is available for bounded independent work when requested, but adds coordination and is not automatically cheaper. No task or subagent is started by this document. See [OpenAI's model guidance for subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
