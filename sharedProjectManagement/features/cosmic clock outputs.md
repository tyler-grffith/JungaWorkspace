## New Workspace Feature: Code Projects and Interactive Scene Outputs

## Context

The completed p5.js Cosmic Clock needs to live inside Junga while preserving the distinction between source work and the experience it produces.

## Tyler's Request

Integrate Cosmic Clock as a code project with a tangible source manifest, editable output defaults/metadata, and a ready Earth Clock interactive-scene output. Viewing must not modify the source project. Preserve old libraries, backups, lifecycle behavior, assets and licenses.

## Conceptual gaps I, the agent, filled in

- Existing projects migrate in memory to `workable`; code projects own serializable outputs and a versioned reference to a bundled repository inventory. Scene code and binaries remain application assets.
- The source page edits defaults explicitly. A nested output route shows a dark p5 scene and its owner, without project controls or persistence callbacks. Each visit owns disposable camera, clock, and time-zone state.
- Chose Sun-relative camera defaults so live scenes start near the terminator; mobile pulls back slightly. Preserved spherical Earth, real boundaries, city lights, keyboard exploration, and date/DST behavior.
- Duplication/restore-as-copies creates independent output IDs. Trashed source projects retain outputs but require restoration before viewing. No template is seeded silently.

## What details should Tyler be able to fine tune by hand?

- In Junga: project type/details; output title, description, status, camera, time mode/date/speed/pause, initial boundaries, attribution and source link. Apply settings before backup; viewer controls remain temporary.
- In repository source: rendering, textures, typography, shader tuning and manifest contents. Full browser code editing, filesystem synchronization, additional scene kinds and named tours require later decisions.
