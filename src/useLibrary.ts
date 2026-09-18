import { useCallback, useEffect, useState } from 'react'
import { commitLibrary, readLibrary, STORAGE_KEY, type Library } from './library'
import { restoreBackup, type RestoreMode } from './backup'

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Browser storage is unavailable.'
function load(): { library: Library | null; error: string } {
  try {
    return { library: readLibrary(window.localStorage), error: '' }
  } catch (error) {
    return { library: null, error: message(error) }
  }
}

export function useLibrary() {
  const [state, setState] = useState(load)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        const next = load()
        setState((previous) => (next.error ? { ...next, library: previous.library } : next))
      }
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  const commit = useCallback((change: (current: Library) => Library): boolean => {
    try {
      const library = commitLibrary(window.localStorage, change)
      setState({ library, error: '' })
      setSaveError('')
      return true
    } catch (error) {
      setSaveError(message(error))
      return false
    }
  }, [])
  const restore = (backup: Library, mode: RestoreMode, expectedRaw: string | null) => {
    const library = restoreBackup(window.localStorage, backup, mode, expectedRaw)
    setState({ library, error: '' })
    setSaveError('')
  }
  return {
    ...state,
    saveError,
    commit,
    restore,
    reload: () => {
      const next = load()
      setState((previous) => (next.error ? { ...next, library: previous.library } : next))
      if (!next.error) setSaveError('')
    },
  }
}
