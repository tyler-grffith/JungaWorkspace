// Stable identifiers for project modules (tools). Each id is also the key of that module's
// saved document on a project (project.graph, project.sheet) and its route segment.
// Add a new id here first; see docs/ARCHITECTURE.md ("Adding a module").
export const TOOL_IDS = ['graph', 'sheet'] as const
export type Tool = (typeof TOOL_IDS)[number]
export const isTool = (value: unknown): value is Tool => TOOL_IDS.includes(value as Tool)
