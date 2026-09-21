// The persisted manifest reference selects this application-bundled inventory.
const moduleRoot = 'src/interactive-scenes/cosmic-clock/'
const assetRoot = 'public/assets/cosmic-clock/'
export const cosmicClockManifest = [
  {
    group: 'Modules',
    entries: [
      ['SceneHost.tsx', 'React controls and mount/unmount boundary.'],
      [
        'runtime.js',
        'Instance-scoped scene session, asset loading, rendering, and cleanup; adapted from sketch.js.',
      ],
      ['runtime.d.ts', 'Typed contract between the React host and p5 runtime.'],
      ['EarthView.js', 'Sphere geometry, surface textures, and atmosphere rendering.'],
      ['CameraController.js', 'Pointer, touch, zoom, and keyboard camera controls.'],
      ['SimulationClock.js', 'Live and simulated time using a monotonic clock.'],
      [
        'SolarSystemModel.js',
        'Astronomical Earth orientation, Sun direction, and orbital positions.',
      ],
      ['TimeZoneLayer.js', 'Geographic zone lookup, boundary textures, and local civil time.'],
      ['math.js', 'Shared globe coordinates, rotation, and ray picking.'],
      ['shaders/earth.vert', 'Vertex transformation into the astronomical frame.'],
      [
        'shaders/earth.frag',
        'Day/night transition, night lights, boundaries, and atmospheric rim.',
      ],
      ['scene.css', 'Styles scoped to the output route and scene.'],
      ['manifest.ts', 'Versioned source inventory.'],
    ].map(([path, description]) => ({ path: moduleRoot + path, description })),
  },
  {
    group: 'Assets & licenses',
    entries: [
      ['earth-day.jpg', 'NASA Blue Marble, December 2004; fixed surface mosaic.'],
      ['earth-night.jpg', 'NASA Black Marble 2016; city-light composite.'],
      ['timezones.geojson', '419 simplified zones from Timezone Boundary Builder 2026d.'],
      ['CREDITS.md', 'NASA, OpenStreetMap, software, typography, and design source references.'],
      ['TIMEZONE_DATA_LICENSE.txt', 'ODbL 1.0 for the derived time-zone database.'],
      ['licenses/p5.txt', 'p5.js LGPL-2.1 license.'],
      ['licenses/astronomy-engine.txt', 'Astronomy Engine MIT license.'],
      ['licenses/dm-mono.txt', 'DM Mono SIL Open Font License.'],
      ['licenses/dm-sans.txt', 'DM Sans SIL Open Font License.'],
      ['licenses/instrument-serif.txt', 'Instrument Serif SIL Open Font License.'],
    ].map(([path, description]) => ({ path: assetRoot + path, description })),
  },
  {
    group: 'Documentation & maintenance',
    entries: [
      {
        path: moduleRoot + 'README.md',
        description: 'Architecture, ownership, runtime limits, and asset provenance.',
      },
      {
        path: moduleRoot + 'prepare-zones.mjs',
        description: 'Reproducible boundary simplification; maintenance-only script.',
      },
      {
        path: 'src/outputs.ts',
        description: 'Versioned output definitions, defaults, and validation.',
      },
      {
        path: 'src/CodeProjectOverview.tsx',
        description: 'Source material and explicit metadata/defaults editor.',
      },
      { path: 'src/OutputPage.tsx', description: 'Read-only nested output route shell.' },
    ],
  },
]
