// Declarative registry of every adjustable design setting.
// Adding a field here is the whole change: validation, defaults, the designer panel,
// CSS variables, and the saved-file shape all derive from this file.
// See docs/ARCHITECTURE.md ("Adding a design setting").

type Common = { label: string; help?: string; cssVar?: string }
export type NumberField = Common & {
  kind: 'number'
  default: number
  min: number
  max: number
  unit?: '' | 'px'
}
export type ColorField = Common & { kind: 'color'; default: string }
export type SelectField<V extends string | number = string | number> = Common & {
  kind: 'select'
  default: V
  options: readonly { value: V; label: string }[]
}
export type TextField = Common & { kind: 'text'; default: string; maxLength: number }
export type ToggleField = Common & { kind: 'toggle'; default: boolean }
export type Field = NumberField | ColorField | SelectField | TextField | ToggleField

const number = (
  label: string,
  def: number,
  min: number,
  max: number,
  extra: Partial<Pick<NumberField, 'help' | 'cssVar' | 'unit'>> = {},
): NumberField => ({ kind: 'number', label, default: def, min, max, ...extra })
const color = (label: string, def: string, cssVar: string, help?: string): ColorField => ({
  kind: 'color',
  label,
  default: def,
  cssVar,
  help,
})
const select = <const V extends string | number>(
  label: string,
  def: NoInfer<V>,
  options: readonly { value: V; label: string }[],
  extra: Partial<Pick<SelectField, 'help' | 'cssVar'>> = {},
): SelectField<V> => ({ kind: 'select', label, default: def, options, ...extra })
const text = (label: string, def: string, maxLength = 60, help?: string): TextField => ({
  kind: 'text',
  label,
  default: def,
  maxLength,
  help,
})
const toggle = (label: string, def: boolean, help?: string): ToggleField => ({
  kind: 'toggle',
  label,
  default: def,
  help,
})

export type Group = {
  title: string
  description: string
  /** Source files an agent should start with for changes beyond these settings. */
  files: string
  fields: Record<string, Field>
}

export const designGroups = {
  labels: {
    title: 'Label manager',
    description: 'Curve label popup controls and default placement.',
    files:
      'src/graph/LabelManager.tsx; src/graph/CurveLabel.tsx; src/graph/model.ts; sharedProjectManagement/features/curve label controls.md',
    fields: {
      title: text('Popup title', 'Label manager', 40),
      angleControl: select('Angle control', 'number', [
        { value: 'number', label: 'Typed number' },
        { value: 'dropdown', label: 'Dropdown' },
      ]),
      angleStep: select(
        'Rotation step',
        15,
        [1, 5, 10, 15, 30, 45, 90].map((n) => ({ value: n, label: `${n}°` })),
        { help: 'Used by the rotation buttons and dropdown. Typed angles can include decimals.' },
      ),
      sizeControl: select('Size control', 'slider', [
        { value: 'slider', label: 'Slider' },
        { value: 'number', label: 'Typed number' },
      ]),
      defaultSize: number('Default label size (px)', 13, 8, 36, {
        help: 'Applies to labels without a saved style. Existing custom label styles stay as set.',
      }),
      width: number('Popup width (px)', 285, 240, 420, { cssVar: '--design-label-width' }),
      padding: number('Popup padding (px)', 14, 8, 28, { cssVar: '--design-label-padding' }),
      offsetX: number('Label offset right (px)', 9, -30, 40),
      offsetY: number('Label offset above (px)', 10, -30, 40),
    },
  },
  graph: {
    title: 'Graph layout',
    description: 'Open a graph to preview these changes. Narrow screens keep the stacked layout.',
    files: 'src/graph/GraphCalculator.tsx; src/graph/graph.css',
    fields: {
      panelWidth: number('Expression panel width (px)', 310, 250, 440, {
        cssVar: '--design-panel-width',
      }),
      formulaSize: number('Formula text size (px)', 17, 12, 24, {
        cssVar: '--design-formula-size',
      }),
    },
  },
  sheet: {
    title: 'Spreadsheet',
    description: 'Grid sizing for new columns and rows. Open a spreadsheet to preview.',
    files: 'src/sheet/SheetEditor.tsx; src/sheet/sheet.css',
    fields: {
      columnWidth: number('Default column width (px)', 128, 60, 300, {
        help: 'Columns resized by hand keep their saved width.',
      }),
      rowHeight: number('Row height (px)', 32, 24, 48, { cssVar: '--design-row-height' }),
      fontSize: number('Cell text size (px)', 13, 11, 16, { cssVar: '--design-sheet-font-size' }),
    },
  },
  code: {
    title: 'Code project',
    description: 'File tree and editor sizing. Open a code project to preview these changes.',
    files: 'src/code/CodeEditor.tsx; src/code/code.css',
    fields: {
      treeWidth: number('File tree width (px)', 232, 160, 360, {
        cssVar: '--code-tree-width',
      }),
      editorHeight: number('Editor height (px)', 560, 320, 900, {
        cssVar: '--code-editor-height',
      }),
      fontSize: number('Code text size (px)', 13, 11, 18, { cssVar: '--code-font-size' }),
      runHeight: number('Run preview height (px)', 320, 200, 700, {
        cssVar: '--code-run-height',
        help: 'The output page always fills its own page height.',
      }),
    },
  },
  canvas: {
    title: 'Visual canvas',
    description: 'Panels, grid, and defaults for new canvas elements. Open a canvas to preview.',
    files: 'src/canvas/CanvasEditor.tsx; src/canvas/canvas.css; src/canvas/model.ts',
    fields: {
      pageStripWidth: number('Page strip width (px)', 168, 120, 260, {
        cssVar: '--canvas-strip-width',
      }),
      inspectorWidth: number('Inspector width (px)', 264, 200, 360, {
        cssVar: '--canvas-inspector-width',
      }),
      gridSize: number('Default grid size (px)', 10, 2, 100, {
        help: 'Applies to new canvases; each canvas keeps its own grid setting.',
      }),
      defaultFill: color('Default shape fill', '#eef3e9', '--canvas-default-fill'),
      defaultStroke: color('Default shape stroke', '#285f4b', '--canvas-default-stroke'),
      handleColor: color('Selection color', '#2f6fed', '--canvas-handle-color'),
      showRulers: toggle('Show rulers', true, 'Pixel rulers along the top and left of the stage.'),
    },
  },
  document: {
    title: 'Document',
    description: 'Page, type, and panel defaults for new documents. Open a document to preview.',
    files: 'src/document/DocumentEditor.tsx; src/document/document.css; src/document/model.ts',
    fields: {
      outlineWidth: number('Outline width (px)', 220, 160, 320, {
        cssVar: '--document-outline-width',
      }),
      defaultFont: select(
        'Default font',
        "'DM Sans Variable', 'Segoe UI', sans-serif",
        [
          { value: "'DM Sans Variable', 'Segoe UI', sans-serif", label: 'DM Sans' },
          { value: "'Manrope Variable', 'Segoe UI', sans-serif", label: 'Manrope' },
          { value: "'Instrument Serif', Georgia, serif", label: 'Instrument Serif' },
          { value: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
          { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
          { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
        ],
        { help: 'Applies to new documents; each document keeps its own font.' },
      ),
      defaultFontSize: number('Default text size (pt)', 12, 8, 24),
      defaultMargin: number('Default page margin (in)', 1, 0.25, 2),
      pageShadow: toggle('Page shadow', true, 'Draw the page as a sheet on a grey desk.'),
    },
  },
  theme: {
    title: 'Shared appearance',
    description: 'Colors, corners, and type used across the workspace. Check text readability.',
    files: 'src/styles.css; src/design/designer.css',
    fields: {
      accent: color('Accent color', '#285f4b', '--green'),
      sidebar: color('Sidebar color', '#f2f4ef', '--sidebar'),
      ink: color('Text color', '#233c32', '--ink'),
      border: color('Border color', '#e4e9e2', '--border'),
      soft: color('Soft fill color', '#eef3e9', '--soft'),
      buttonRadius: number('Button corner radius (px)', 6, 0, 24, {
        cssVar: '--design-button-radius',
      }),
      cardRadius: number('Card corner radius (px)', 9, 0, 24, { cssVar: '--design-card-radius' }),
      fontSize: number('Base text size (px)', 14, 12, 18, { cssVar: '--design-font-size' }),
      headingFont: select(
        'Heading font',
        "'Manrope Variable', 'Segoe UI', sans-serif",
        [
          { value: "'Manrope Variable', 'Segoe UI', sans-serif", label: 'Manrope' },
          { value: "'DM Sans Variable', 'Segoe UI', sans-serif", label: 'DM Sans' },
        ],
        { cssVar: '--design-heading-font' },
      ),
    },
  },
  shell: {
    title: 'Workspace shell',
    description: 'Sidebar, content width, and the fixed text around the workspace.',
    files: 'src/App.tsx; src/styles.css',
    fields: {
      sidebarWidth: number('Sidebar width (px)', 250, 200, 340, {
        cssVar: '--design-sidebar-width',
      }),
      contentMaxWidth: number('Content max width (px)', 1440, 960, 1920, {
        cssVar: '--design-content-width',
      }),
      contentPadding: number('Content side padding (px)', 42, 16, 64, {
        cssVar: '--design-content-padding',
      }),
      brandSubtitle: text('Brand subtitle', 'YOUR WORKSPACE', 30),
      workspaceName: text('Workspace name', 'Personal workspace', 40),
      workspaceTagline: text('Workspace tagline', 'A place for your work', 60),
    },
  },
  library: {
    title: 'Project library',
    description: 'Browsing defaults and the copy on the library pages.',
    files: 'src/App.tsx; src/library.ts; src/modules/examples.ts',
    fields: {
      gridColumns: select(
        'Grid columns',
        3,
        [2, 3, 4].map((n) => ({ value: n, label: `${n} across` })),
        { cssVar: '--design-grid-columns' },
      ),
      defaultLayout: select(
        'Default view',
        'grid',
        [
          { value: 'grid', label: 'Grid' },
          { value: 'list', label: 'List' },
        ],
        { help: 'Applies when the app loads.' },
      ),
      defaultSort: select('Default sort', 'updated', [
        { value: 'updated', label: 'Last updated' },
        { value: 'name', label: 'Name A–Z' },
        { value: 'created', label: 'Newest created' },
      ]),
      showExamples: toggle(
        'Offer example projects',
        true,
        'Shows the built-in example buttons in the library.',
      ),
      eyebrow: text('Library eyebrow', 'YOUR WORK, TOGETHER', 40),
      title: text('Library title', 'Your library', 40),
      tagline: text('Library tagline', 'A home for your ideas, models, and working projects.', 120),
      footerLine: text('Footer line', 'A little more organized. A little more possible.', 80),
    },
  },
} as const satisfies Record<string, Group>

export type GroupId = keyof typeof designGroups
export const groupIds = Object.keys(designGroups) as GroupId[]
export const DESIGN_VERSION = 2

type Value<F> = F extends NumberField
  ? number
  : F extends ColorField | TextField
    ? string
    : F extends SelectField<infer V>
      ? V
      : F extends ToggleField
        ? boolean
        : never
export type DesignSettings = { version: typeof DESIGN_VERSION } & {
  [G in GroupId]: {
    [K in keyof (typeof designGroups)[G]['fields']]: Value<(typeof designGroups)[G]['fields'][K]>
  }
}

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

export function validField(field: Field, value: unknown): boolean {
  switch (field.kind) {
    case 'number':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= field.min &&
        value <= field.max
      )
    case 'color':
      return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    case 'select':
      return field.options.some((option) => option.value === value)
    case 'text':
      return typeof value === 'string' && value.trim().length > 0 && value.length <= field.maxLength
    case 'toggle':
      return typeof value === 'boolean'
  }
}

export function defaultDesign(): DesignSettings {
  const settings: Record<string, unknown> = { version: DESIGN_VERSION }
  for (const id of groupIds)
    settings[id] = Object.fromEntries(
      Object.entries(designGroups[id].fields).map(([key, field]) => [key, field.default]),
    )
  return settings as DesignSettings
}

/**
 * Accept a saved file that may predate newer registry fields: missing fields take their
 * defaults, present fields must be valid, and unknown groups or fields are rejected.
 * Returns null when the value cannot be used.
 */
export function completeDesign(value: unknown): DesignSettings | null {
  if (!record(value) || ![1, DESIGN_VERSION].includes(value.version as number)) return null
  const result: Record<string, unknown> = { version: DESIGN_VERSION }
  for (const key of Object.keys(value)) if (key !== 'version' && !(key in designGroups)) return null
  for (const id of groupIds) {
    const group = value[id] ?? {}
    if (!record(group)) return null
    const fields = designGroups[id].fields as Record<string, Field>
    const complete: Record<string, unknown> = {}
    for (const key of Object.keys(group)) if (!(key in fields)) return null
    for (const [key, field] of Object.entries(fields)) {
      const present = key in group
      if (present && !validField(field, group[key])) return null
      complete[key] = present ? group[key] : field.default
    }
    result[id] = complete
  }
  return result as DesignSettings
}

/** Strict check for a complete current-version settings object (what the panel saves). */
export function validDesign(value: unknown): value is DesignSettings {
  if (!record(value) || value.version !== DESIGN_VERSION) return false
  const complete = completeDesign(value)
  return (
    !!complete &&
    groupIds.every(
      (id) =>
        record(value[id]) &&
        Object.keys(value[id] as object).length === Object.keys(designGroups[id].fields).length,
    )
  )
}

/** CSS custom properties for every field that declares one. */
export function designVariables(settings: DesignSettings): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const id of groupIds)
    for (const [key, field] of Object.entries(designGroups[id].fields as Record<string, Field>)) {
      if (!field.cssVar) continue
      const value = (settings[id] as Record<string, unknown>)[key]
      variables[field.cssVar] =
        field.kind === 'number' ? `${value}${field.unit ?? 'px'}` : String(value)
    }
  return variables
}
