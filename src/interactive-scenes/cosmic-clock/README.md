# Cosmic Clock in Junga

Cosmic Clock is a **code project**. Earth Clock is its first **interactive-scene output**. Create it intentionally with **Cosmic Clock** in the library; nothing is seeded automatically. A generic Code project can also attach an Earth Clock output.

The light source overview separates **Working material** (the versioned repository manifest, sources, asset licenses and configuration) from **Outputs**. **Edit output settings → Apply output settings** saves metadata and validated defaults. This app does not edit or synchronize repository source files. In-browser programming requires a separate architecture decision.

## Data and routes

`Project.projectType` is `workable | code`; missing legacy values become `workable` in memory. `outputs` defaults to `[]`. Library version/storage key stay at 1 so old unmodified backups remain readable. Reading never writes a migration to storage. A code project's optional `{ kind: 'cosmic-clock', version: 1 }` source-manifest reference selects `manifest.ts`, a bundled inventory of actual repository files. Backups carry that reference and output definitions, not binary assets or executable code; the matching Junga application supplies the implementation.

An output has an ID, `type: 'interactive-scene'`, title, description, `draft | ready` status, source kind/version/default state, and attribution/source-link metadata. Unknown scene kinds, schema versions, fields, unsafe source links, invalid dates, duplicate IDs and out-of-range values are rejected before storage writes. Duplication and restore-as-copies deep-copy defaults and assign new project/output IDs. Lifecycle actions preserve content. Trashed projects retain outputs but must be restored before viewing/editing.

- Source: `#/project/<project-id>`
- Output: `#/project/<project-id>/output/<output-id>`

`OutputPage` receives only its owner and output; there is no library commit callback in the viewer. `SceneHost` freezes a deep copy of defaults for each visit. Orbit/zoom, current date, live/pause/speed, hover/pinning, and overlay toggles are temporary. Returning to an output starts from authored defaults. Updates in another browser tab do not reset an active viewer's camera/time. A renamed or removed owner still updates navigation/availability.

## Defaults and runtime

Camera defaults use latitude (−75° to 75°), longitude east of the subsolar meridian (−180° to 180°), and distance in Earth radii (2.05–6). A Sun-relative starting camera makes the day/night edge useful at any live date; reset uses those same authored settings. Narrow screens multiply distance by 1.18, capped at 6. This is a starting viewpoint, not a camera that follows Earth while exploring.

Live follows the system clock at 1×. Simulation uses the saved UTC date, speed (1–86,400×), and initial pause state. Runtime speed changes/resume use a monotonic clock. Dates are bounded to 1970–2100; reaching a boundary pauses there. Browser `Intl` supplies local civil time and DST. Planet orientation and Sun direction use Astronomy Engine, in an ecliptic frame. Earth is intentionally spherical.

The existing tested JavaScript astronomy/rendering modules are retained. `runtime.d.ts` defines the typed React boundary; `runtime.js` replaces the standalone `sketch.js` orchestration. p5 is imported lazily after mounting. The host handles cancellation during lazy import; runtime teardown aborts requests/listeners, disconnects the resize observer, removes camera events, stops p5, frees sphere buffers, removes canvases, and releases the WebGL context. Hidden tabs stop drawing. There is no iframe, second application entry, or second Vite server requirement.

Keyboard: focus the globe and use arrows to orbit, +/− to zoom. The searchable IANA zone list provides a keyboard alternative to hover/pin. The route keeps a visible **Back to Cosmic Clock** ownership link. WebGL failure leaves a readable error and return path.

## Assets and licenses

Assets live at `public/assets/cosmic-clock/` (~3.7 MB). See [credits](../../../public/assets/cosmic-clock/CREDITS.md) and the adjacent license texts. NASA Blue Marble December 2004 and Black Marble 2016 are fixed composites, not live weather. The 419-zone map derives from Timezone Boundary Builder **2026d**, © OpenStreetMap contributors, under ODbL 1.0. It is simplified to 2.5 km with preserved islands and rounded to 0.001°. Current geography is not historical geography. Near-boundary accuracy and future browser time-zone rules have limits; open ocean/uncovered areas use labeled nautical offsets.

For maintenance only, copy `prepare-zones.mjs` into a temporary Node project with `mapshaper@0.7.62` installed, then run that copy against the upstream `combined.json`, from the Junga repository root. This dependency is not needed for app installation or rendering. The script writes the derived asset in the path above. Preserve ODbL and attribution when redistributing modifications.

Pinned runtime dependencies: p5.js 2.3.3 (LGPL-2.1), Astronomy Engine 2.1.19 (MIT), DM Mono and Instrument Serif (SIL OFL); Junga supplies DM Sans. Full licenses are bundled. The scene's lazy renderer chunk is about 1.27 MB / 377 KB gzip; Vite reports its normal >500 KB chunk warning. It is fetched when opening an output, not when browsing the project library.

## Verification

`npm run check` covers model migration, validation, source/output cloning, lifecycle, persistence, backups, astronomy, picking, civil-time offsets and DST. `npm run test:e2e -- tests/cosmic-clock.spec.ts --project=chromium --workers=2` covers creation, settings, read-only viewer sessions, routes/reload, desktop/mobile accessibility, repeated context cleanup, and departure during asset loading. Full Junga browser checks guard the existing tools.
