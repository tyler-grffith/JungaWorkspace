// Printer, filament, and process profiles in the shape of Bambu Studio's presets: the bed and
// nozzle a printer has, the temperatures and density a material wants, and the layer-height
// families a process starts from. Everything the slicer computes reads these; nothing here is
// a measurement of a real machine, only the manufacturer's published numbers.

export type PrinterProfile = {
  name: string
  family: 'Bambu' | 'Prusa' | 'Creality' | 'Voron' | 'Elegoo' | 'Other'
  /** Build volume in mm. */
  bed: { x: number; y: number; z: number }
  /** Nozzle sizes the printer can take. */
  nozzles: readonly number[]
  /** Peak travel and print speed in mm/s, and acceleration in mm/s². */
  maxSpeed: number
  acceleration: number
  /** Multi-material unit slots (AMS, MMU); 1 for a single spool. */
  slots: number
  /** Whether the bed is centred on the origin (Bambu style) or starts at (0, 0). */
  origin: 'center' | 'corner'
}
export const PRINTER_PROFILES: readonly PrinterProfile[] = [
  {
    name: 'Bambu Lab X1 Carbon',
    family: 'Bambu',
    bed: { x: 256, y: 256, z: 256 },
    nozzles: [0.2, 0.4, 0.6, 0.8],
    maxSpeed: 500,
    acceleration: 10000,
    slots: 4,
    origin: 'center',
  },
  {
    name: 'Bambu Lab P1S',
    family: 'Bambu',
    bed: { x: 256, y: 256, z: 256 },
    nozzles: [0.2, 0.4, 0.6, 0.8],
    maxSpeed: 500,
    acceleration: 10000,
    slots: 4,
    origin: 'center',
  },
  {
    name: 'Bambu Lab P1P',
    family: 'Bambu',
    bed: { x: 256, y: 256, z: 256 },
    nozzles: [0.2, 0.4, 0.6, 0.8],
    maxSpeed: 500,
    acceleration: 10000,
    slots: 4,
    origin: 'center',
  },
  {
    name: 'Bambu Lab A1',
    family: 'Bambu',
    bed: { x: 256, y: 256, z: 256 },
    nozzles: [0.2, 0.4, 0.6, 0.8],
    maxSpeed: 500,
    acceleration: 10000,
    slots: 4,
    origin: 'center',
  },
  {
    name: 'Bambu Lab A1 mini',
    family: 'Bambu',
    bed: { x: 180, y: 180, z: 180 },
    nozzles: [0.2, 0.4, 0.6, 0.8],
    maxSpeed: 500,
    acceleration: 10000,
    slots: 4,
    origin: 'center',
  },
  {
    name: 'Bambu Lab H2D',
    family: 'Bambu',
    bed: { x: 350, y: 320, z: 325 },
    nozzles: [0.2, 0.4, 0.6, 0.8],
    maxSpeed: 600,
    acceleration: 20000,
    slots: 8,
    origin: 'center',
  },
  {
    name: 'Prusa MK4S',
    family: 'Prusa',
    bed: { x: 250, y: 210, z: 220 },
    nozzles: [0.25, 0.4, 0.6, 0.8],
    maxSpeed: 300,
    acceleration: 4000,
    slots: 5,
    origin: 'corner',
  },
  {
    name: 'Prusa XL',
    family: 'Prusa',
    bed: { x: 360, y: 360, z: 360 },
    nozzles: [0.4, 0.6, 0.8],
    maxSpeed: 300,
    acceleration: 4000,
    slots: 5,
    origin: 'corner',
  },
  {
    name: 'Prusa MINI+',
    family: 'Prusa',
    bed: { x: 180, y: 180, z: 180 },
    nozzles: [0.25, 0.4, 0.6],
    maxSpeed: 200,
    acceleration: 2500,
    slots: 1,
    origin: 'corner',
  },
  {
    name: 'Creality Ender 3 V3',
    family: 'Creality',
    bed: { x: 220, y: 220, z: 250 },
    nozzles: [0.4, 0.6, 0.8],
    maxSpeed: 600,
    acceleration: 8000,
    slots: 1,
    origin: 'corner',
  },
  {
    name: 'Creality K1 Max',
    family: 'Creality',
    bed: { x: 300, y: 300, z: 300 },
    nozzles: [0.4, 0.6, 0.8],
    maxSpeed: 600,
    acceleration: 20000,
    slots: 1,
    origin: 'corner',
  },
  {
    name: 'Voron 2.4 350',
    family: 'Voron',
    bed: { x: 350, y: 350, z: 340 },
    nozzles: [0.4, 0.6],
    maxSpeed: 400,
    acceleration: 8000,
    slots: 1,
    origin: 'corner',
  },
  {
    name: 'Elegoo Neptune 4 Pro',
    family: 'Elegoo',
    bed: { x: 225, y: 225, z: 265 },
    nozzles: [0.4, 0.6],
    maxSpeed: 500,
    acceleration: 8000,
    slots: 1,
    origin: 'corner',
  },
]
export const PRINTERS = PRINTER_PROFILES.map((p) => p.name)
export const printerProfile = (name: string): PrinterProfile =>
  PRINTER_PROFILES.find((p) => p.name === name) ?? PRINTER_PROFILES[0]

export type FilamentType =
  'PLA' | 'PLA Silk' | 'PLA-CF' | 'PETG' | 'PETG-CF' | 'ABS' | 'ASA' | 'TPU' | 'PA' | 'PC'
export type FilamentProfile = {
  nozzleTemp: number
  bedTemp: number
  /** g/cm³ */
  density: number
  /** USD per kg, a typical retail figure. */
  pricePerKg: number
  /** Print speed ceiling in mm/s the material tolerates. */
  maxSpeed: number
  /** Part-cooling fan for layers after the first, 0–100. */
  fan: number
  /** Whether the printer's enclosure should be closed. */
  enclosed: boolean
}
export const FILAMENT_PROFILES: Record<FilamentType, FilamentProfile> = {
  PLA: {
    nozzleTemp: 220,
    bedTemp: 55,
    density: 1.24,
    pricePerKg: 25,
    maxSpeed: 300,
    fan: 100,
    enclosed: false,
  },
  'PLA Silk': {
    nozzleTemp: 225,
    bedTemp: 55,
    density: 1.24,
    pricePerKg: 28,
    maxSpeed: 120,
    fan: 100,
    enclosed: false,
  },
  'PLA-CF': {
    nozzleTemp: 230,
    bedTemp: 55,
    density: 1.3,
    pricePerKg: 40,
    maxSpeed: 200,
    fan: 80,
    enclosed: false,
  },
  PETG: {
    nozzleTemp: 245,
    bedTemp: 75,
    density: 1.27,
    pricePerKg: 26,
    maxSpeed: 200,
    fan: 40,
    enclosed: false,
  },
  'PETG-CF': {
    nozzleTemp: 255,
    bedTemp: 75,
    density: 1.3,
    pricePerKg: 45,
    maxSpeed: 150,
    fan: 40,
    enclosed: false,
  },
  ABS: {
    nozzleTemp: 260,
    bedTemp: 95,
    density: 1.04,
    pricePerKg: 25,
    maxSpeed: 200,
    fan: 20,
    enclosed: true,
  },
  ASA: {
    nozzleTemp: 260,
    bedTemp: 100,
    density: 1.07,
    pricePerKg: 30,
    maxSpeed: 200,
    fan: 20,
    enclosed: true,
  },
  TPU: {
    nozzleTemp: 230,
    bedTemp: 40,
    density: 1.21,
    pricePerKg: 35,
    maxSpeed: 40,
    fan: 60,
    enclosed: false,
  },
  PA: {
    nozzleTemp: 270,
    bedTemp: 90,
    density: 1.14,
    pricePerKg: 45,
    maxSpeed: 150,
    fan: 0,
    enclosed: true,
  },
  PC: {
    nozzleTemp: 275,
    bedTemp: 100,
    density: 1.2,
    pricePerKg: 45,
    maxSpeed: 150,
    fan: 0,
    enclosed: true,
  },
}
export const FILAMENT_TYPES = Object.keys(FILAMENT_PROFILES) as FilamentType[]

/** A process preset: the layer-height family and the speeds Bambu ships for it. */
export type ProcessPreset = {
  name: string
  layerHeight: number
  firstLayerHeight: number
  walls: number
  topLayers: number
  bottomLayers: number
  infill: number
}
export const PROCESS_PRESETS: readonly ProcessPreset[] = [
  {
    name: '0.08 mm Extra Fine',
    layerHeight: 0.08,
    firstLayerHeight: 0.2,
    walls: 2,
    topLayers: 8,
    bottomLayers: 6,
    infill: 15,
  },
  {
    name: '0.12 mm Fine',
    layerHeight: 0.12,
    firstLayerHeight: 0.2,
    walls: 2,
    topLayers: 6,
    bottomLayers: 4,
    infill: 15,
  },
  {
    name: '0.16 mm Optimal',
    layerHeight: 0.16,
    firstLayerHeight: 0.2,
    walls: 2,
    topLayers: 5,
    bottomLayers: 3,
    infill: 15,
  },
  {
    name: '0.20 mm Standard',
    layerHeight: 0.2,
    firstLayerHeight: 0.2,
    walls: 2,
    topLayers: 4,
    bottomLayers: 3,
    infill: 15,
  },
  {
    name: '0.20 mm Strength',
    layerHeight: 0.2,
    firstLayerHeight: 0.2,
    walls: 4,
    topLayers: 5,
    bottomLayers: 4,
    infill: 40,
  },
  {
    name: '0.24 mm Draft',
    layerHeight: 0.24,
    firstLayerHeight: 0.24,
    walls: 2,
    topLayers: 3,
    bottomLayers: 3,
    infill: 15,
  },
  {
    name: '0.28 mm Extra Draft',
    layerHeight: 0.28,
    firstLayerHeight: 0.28,
    walls: 2,
    topLayers: 3,
    bottomLayers: 2,
    infill: 10,
  },
]
