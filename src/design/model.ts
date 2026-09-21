import { designGroups, type DesignSettings, type GroupId } from './registry.ts'

export {
  completeDesign,
  defaultDesign,
  designGroups,
  designVariables,
  groupIds,
  validDesign,
  validField,
  DESIGN_VERSION,
} from './registry.ts'
export type { DesignSettings, Field, Group, GroupId } from './registry.ts'

export const sameDesign = (a: DesignSettings, b: DesignSettings) =>
  JSON.stringify(a) === JSON.stringify(b)
export type DesignSnapshot = { settings: DesignSettings; revision: string }
export const DESIGN_ENDPOINT = '/__designer/settings'

export function refinementBrief(group: GroupId, request: string) {
  const area = designGroups[group]
  return `Small refinement: ${area.title}\n\nRequested change: ${request.trim()}\n\nStart with Design/settings.json, src/design/registry.ts, and ${area.files}.\nFollow docs/REFINEMENTS.md and docs/ARCHITECTURE.md. Keep the change focused, check the affected behavior, and update the feature record. ProductManagement is read-only. No merge or deployment.`
}
