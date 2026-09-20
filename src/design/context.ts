import { createContext, useContext } from 'react'
import { savedDesign } from './defaults'
import type { DesignSettings } from './model'

export const DesignContext = createContext<DesignSettings>(savedDesign)
export function useDesign() {
  return useContext(DesignContext)
}

export type DesignerControls = {
  enabled: boolean
  dirty: boolean
  busy: boolean
  ready: boolean
  message: string
  toggle: () => void
  update: (settings: DesignSettings) => void
  save: () => Promise<void>
  revert: () => void
  reload: () => Promise<void>
}
export const DesignerContext = createContext<DesignerControls | null>(null)
