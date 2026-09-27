// Modeler and slicer example: a mounting bracket built from a feature history, and a print
// plate that already holds the bracket's mesh beside a calibration cube. The same part feeds
// both documents, which is what Send to Slicer does inside the modeler.
import {
  emptyModeler,
  newFeature,
  newSketch,
  printableMesh,
  type ModelerDocument,
} from '../modeler/model'
import { emptySlicer, meshObject, newObject, type SlicerDocument } from '../slicer/model'

export function bracketModel(): ModelerDocument {
  const base = newSketch('Top', 'rectangle', 80, 50, 1)
  const boss = newSketch('Top', 'circle', 22, 22, 2, { offset: 6 })
  const slot = newSketch('Top', 'slot', 30, 8, 3, { offset: 6, x: 0, y: -16 })
  const holes = [
    [-30, 17],
    [30, 17],
    [-30, -17],
    [30, -17],
  ] as const
  const plate = newFeature('extrude', 1, { depth: 6, end: 'Blind' }, base.id)
  const bossFeature = newFeature('extrude', 2, { depth: 14, end: 'Blind' }, boss.id)
  return {
    ...emptyModeler(),
    material: 'Aluminum 6061',
    color: '#8fa3b8',
    sketches: [base, boss, slot],
    features: [
      plate,
      bossFeature,
      newFeature('hole', 1, { diameter: 8, x: 0, y: 0, end: 'Through All' }),
      ...holes.map(([x, y], i) =>
        newFeature('hole', i + 2, {
          diameter: 5,
          x,
          y,
          end: 'Through All',
          type: 'Counterbore',
          cbDiameter: 9,
          cbDepth: 2.5,
        }),
      ),
      newFeature('cut', 1, { depth: 6, end: 'Blind' }, slot.id),
      newFeature('fillet', 1, { radius: 6, edges: 'Vertical edges', targetId: plate.id }),
      newFeature('chamfer', 1, { distance: 1, edges: 'Top edges', targetId: bossFeature.id }),
    ],
    notes:
      'A mounting bracket: 80 × 50 × 6 mm plate with rounded corners, a Ø22 boss with a chamfered top and a Ø8 through hole, four counterbored Ø5 mounting holes, and a slot cut into the plate. Every feature is real geometry: double-click one in the tree to edit it.',
  }
}

export function bracketPlate(model = bracketModel()): SlicerDocument {
  const doc = emptySlicer()
  const plate = doc.plates[0]
  const bracket = meshObject('Mounting bracket', printableMesh(model), 0)
  bracket.x = -35
  bracket.y = 0
  const cube = newObject('Calibration cube', 20, 20, 20, 1)
  cube.x = 45
  cube.y = 0
  plate.objects = [bracket, cube]
  return {
    ...doc,
    filament: { type: 'PLA', brand: 'Bambu', color: '#3b8beb' },
    process: { ...doc.process, infill: 20, infillPattern: 'gyroid', brim: true },
    notes:
      'The bracket mesh came from the project’s modeler (Send to Slicer does the same). Slice the plate to see walls, gyroid infill, and the brim; export G-code from the plate menu.',
  }
}
