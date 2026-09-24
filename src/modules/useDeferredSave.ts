// Editors report every edit, but writing the library (validate, stringify, localStorage) on
// each keystroke is wasteful for large documents. This holds the latest value, saves it once
// typing pauses, and flushes early on navigation or when the page is hidden so nothing is lost.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type DeferredSave<T> = {
  /** The value waiting to be written, if any; hosts show it as the current document. */
  value: T | null
  /** Replace the pending value and restart the timer. */
  schedule: (value: T) => void
  /** Write the pending value now, if there is one. */
  flush: () => void
}

export function useDeferredSave<T>(save: (value: T) => boolean, delay = 400): DeferredSave<T> {
  const [value, setValue] = useState<T | null>(null)
  const latest = useRef<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saveRef = useRef(save)
  saveRef.current = save

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const pending = latest.current
    if (pending === null) return
    latest.current = null
    setValue(null)
    saveRef.current(pending)
  }, [])
  const schedule = useCallback(
    (next: T) => {
      latest.current = next
      setValue(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [flush, delay],
  )
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])
  return useMemo(() => ({ value, schedule, flush }), [value, schedule, flush])
}
