import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { DesignContext, DesignerContext } from './context'
import { savedDesign } from './defaults'
import {
  DESIGN_ENDPOINT,
  designVariables,
  sameDesign,
  validDesign,
  type DesignSnapshot,
} from './model'
import DesignerPanel from './DesignerPanel'

const DRAFT_KEY = 'junga.designer.preview.v1'
const MODE_KEY = 'junga.designer.mode'
function restoredPreview(): DesignSnapshot | null {
  if (!import.meta.env.DEV) return null
  try {
    const value = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null')
    return value && validDesign(value.settings) && typeof value.revision === 'string' ? value : null
  } catch {
    return null
  }
}
async function fetchSnapshot(body?: DesignSnapshot): Promise<DesignSnapshot> {
  const response = await fetch(
    DESIGN_ENDPOINT,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Junga-Designer': '1' },
          body: JSON.stringify(body),
        }
      : { cache: 'no-store' },
  )
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? 'Unable to load the saved design.')
  if (!validDesign(result.settings) || typeof result.revision !== 'string')
    throw new Error('The saved design could not be read.')
  return result
}

export default function DesignProvider({ children }: { children: ReactNode }) {
  const [restored] = useState(restoredPreview)
  const [settings, setSettings] = useState(restored?.settings ?? savedDesign)
  const [baseline, setBaseline] = useState<DesignSnapshot>({ settings: savedDesign, revision: '' })
  const [revision, setRevision] = useState(restored?.revision ?? '')
  const [enabled, setEnabled] = useState(() => {
    try {
      return import.meta.env.DEV && sessionStorage.getItem(MODE_KEY) === 'designer'
    } catch {
      return false
    }
  })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const dirty = !sameDesign(settings, baseline.settings)
  const latest = useRef({ dirty, busy })
  latest.current = { dirty, busy }
  const reload = useCallback(async () => {
    setBusy(true)
    try {
      const result = await fetchSnapshot()
      setBaseline(result)
      setSettings(result.settings)
      setRevision(result.revision)
      setReady(true)
      setMessage('Loaded the saved design.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let active = true
    fetchSnapshot()
      .then((result) => {
        if (!active) return
        setBaseline(result)
        setReady(true)
        if (!restored) {
          setSettings(result.settings)
          setRevision(result.revision)
        } else if (restored.revision !== result.revision)
          setMessage(
            'The saved design changed since this preview. Download your preview if needed, then load the saved design.',
          )
      })
      .catch((error) => {
        if (active) setMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [restored])
  useEffect(() => {
    const root = document.documentElement
    for (const [key, value] of Object.entries(designVariables(settings)))
      root.style.setProperty(key, value)
  }, [settings])
  useEffect(() => {
    document.documentElement.classList.toggle('designer-active', enabled)
    if (import.meta.env.DEV) {
      try {
        sessionStorage.setItem(MODE_KEY, enabled ? 'designer' : 'user')
      } catch {
        /* Mode is still usable without storage. */
      }
    }
    return () => document.documentElement.classList.remove('designer-active')
  }, [enabled])
  useEffect(() => {
    if (!import.meta.env.DEV || !ready) return
    try {
      if (dirty) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ settings, revision }))
      else sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      setMessage('This browser could not retain the preview. Save or download it before leaving.')
    }
  }, [settings, revision, dirty, ready])
  useEffect(() => {
    if (!import.meta.hot) return
    const changed = () => {
      if (latest.current.busy) return
      if (latest.current.dirty)
        setMessage(
          'Saved settings changed elsewhere. Your preview is intact; load the saved design before saving again.',
        )
      else void reload()
    }
    import.meta.hot.on('junga:design-updated', changed)
    return () => import.meta.hot?.off('junga:design-updated', changed)
  }, [reload])
  async function save() {
    if (busy || !ready || !validDesign(settings)) return
    setBusy(true)
    try {
      const result = await fetchSnapshot({ settings, revision })
      setBaseline(result)
      setRevision(result.revision)
      setSettings(result.settings)
      setMessage('Saved to Design/settings.json. The next build will use these settings.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <DesignContext.Provider value={settings}>
      <DesignerContext.Provider
        value={{
          enabled,
          dirty,
          busy,
          ready,
          message,
          toggle: () => setEnabled((v) => !v),
          update: setSettings,
          save,
          reload,
          revert: () => {
            setSettings(baseline.settings)
            setRevision(baseline.revision)
            setMessage('Preview reverted to the last loaded design.')
          },
        }}
      >
        {children}
        {import.meta.env.DEV && enabled && <DesignerPanel />}
      </DesignerContext.Provider>
    </DesignContext.Provider>
  )
}
