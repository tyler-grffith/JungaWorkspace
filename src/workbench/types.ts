// Declarative description of a desktop-style "workbench" application: menu bar, command tabs
// (a ribbon), a feature tree, a viewport, a property panel for the active tool, and a status
// bar. The 3D modeler and slicer prototypes are each a spec of this shape plus a document;
// `Workbench.tsx` renders the spec, so the two apps share layout, interaction, and styling.
import type { LucideIcon } from 'lucide-react'

export type ParamValue = number | string | boolean
export type ParamDef = {
  id: string
  label: string
  kind: 'number' | 'select' | 'toggle' | 'text'
  default: ParamValue
  unit?: string
  options?: readonly string[]
  min?: number
  max?: number
  step?: number
  help?: string
}
export type ToolDef = {
  id: string
  label: string
  icon: LucideIcon
  hint?: string
  /** Parameters shown in the property panel when the tool starts. None means it runs at once. */
  params?: ParamDef[]
  /** Requires a selection of this kind in the tree before it can start. */
  needs?: 'sketch' | 'feature' | 'object' | 'none'
  disabled?: boolean
}
export type MenuItem =
  { label: string; shortcut?: string; command?: string; disabled?: boolean } | 'separator'
export type Menu = { label: string; items: MenuItem[] }
export type RibbonGroup = { label: string; tools: ToolDef[] }
export type RibbonTab = { id: string; label: string; groups: RibbonGroup[] }
export type TreeNode = {
  id: string
  label: string
  icon?: LucideIcon
  children?: TreeNode[]
  /** Shown greyed and struck through, like a suppressed feature. */
  suppressed?: boolean
  badge?: string
  kind?: string
}
export type PanelTab = { id: string; label: string; icon: LucideIcon }
export type StatusItem = { id: string; text: string; icon?: LucideIcon }
