export type DesignSettings = {
  version: 1
  theme: { accent: string; sidebar: string; buttonRadius: number }
  graph: { panelWidth: number; formulaSize: number }
  labels: {
    title: string
    angleControl: 'number' | 'dropdown'
    angleStep: number
    sizeControl: 'slider' | 'number'
    defaultSize: number
    width: number
    padding: number
    offsetX: number
    offsetY: number
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const range = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
export function validDesign(v: unknown): v is DesignSettings {
  if (!record(v) || v.version !== 1 || !record(v.theme) || !record(v.graph) || !record(v.labels))
    return false
  const { theme, graph, labels } = v
  return (
    color(theme.accent) &&
    color(theme.sidebar) &&
    range(theme.buttonRadius, 0, 24) &&
    range(graph.panelWidth, 250, 440) &&
    range(graph.formulaSize, 12, 24) &&
    typeof labels.title === 'string' &&
    labels.title.trim().length > 0 &&
    labels.title.length <= 40 &&
    ['number', 'dropdown'].includes(labels.angleControl as string) &&
    [1, 5, 10, 15, 30, 45, 90].includes(labels.angleStep as number) &&
    ['slider', 'number'].includes(labels.sizeControl as string) &&
    range(labels.defaultSize, 8, 36) &&
    range(labels.width, 240, 420) &&
    range(labels.padding, 8, 28) &&
    range(labels.offsetX, -30, 40) &&
    range(labels.offsetY, -30, 40) &&
    Object.keys(v).length === 4 &&
    Object.keys(theme).length === 3 &&
    Object.keys(graph).length === 2 &&
    Object.keys(labels).length === 9
  )
}
export const sameDesign = (a: DesignSettings, b: DesignSettings) =>
  JSON.stringify(a) === JSON.stringify(b)
export type DesignSnapshot = { settings: DesignSettings; revision: string }
export const DESIGN_ENDPOINT = '/__designer/settings'
export function designVariables(d: DesignSettings) {
  return {
    '--green': d.theme.accent,
    '--sidebar': d.theme.sidebar,
    '--design-button-radius': `${d.theme.buttonRadius}px`,
    '--design-panel-width': `${d.graph.panelWidth}px`,
    '--design-formula-size': `${d.graph.formulaSize}px`,
    '--design-label-width': `${d.labels.width}px`,
    '--design-label-padding': `${d.labels.padding}px`,
  }
}
export function refinementBrief(area: string, request: string) {
  const files: Record<string, string> = {
    'Label manager':
      'src/graph/LabelManager.tsx; src/graph/CurveLabel.tsx; src/graph/model.ts; sharedProjectManagement/features/curve label controls.md',
    'Graph layout': 'src/graph/GraphCalculator.tsx; src/graph/graph.css',
    'Shared appearance': 'src/styles.css; src/design/designer.css',
  }
  return `Small refinement: ${area}\n\nRequested change: ${request.trim()}\n\nStart with Design/settings.json and ${files[area] ?? 'the relevant feature record'}.\nFollow docs/REFINEMENTS.md. Keep the change focused, check the affected behavior, and update the feature record. ProductManagement is read-only. No merge or deployment.`
}
