import { useCallback, useEffect, useState } from 'react'
import { commitLibrary, readLibrary, STORAGE_KEY, type Library } from './library'
import { restoreBackup, type RestoreMode } from './backup'
import { mergeBuiltIns, stripBuiltIns, subscribeBuiltIns } from './modules/builtins'

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Browser storage is unavailable.'
// Storage holds the user's projects and the built-ins they changed; the app always sees every
// built-in, so reads merge the pristine ones in and writes strip the unchanged ones out.
function load(): { library: Library | null; error: string } {
  try {
    return { library: mergeBuiltIns(readLibrary(window.localStorage)), error: '' }
  } catch (error) {
    return { library: null, error: message(error) }
  }
}

export function useLibrary() {
  const [state, setState] = useState(load)
  const [saveError, setSaveError] = useState('')
  const reload = useCallback(() => {
    const next = load()
    setState((previous) => (next.error ? { ...next, library: previous.library } : next))
    if (!next.error) setSaveError('')
  }, [])
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        const next = load()
        setState((previous) => (next.error ? { ...next, library: previous.library } : next))
      }
    }
    window.addEventListener('storage', changed)
    // A built-in that loaded its material on demand is re-read the same way as another tab's write.
    const unsubscribe = subscribeBuiltIns(reload)
    return () => {
      window.removeEventListener('storage', changed)
      unsubscribe()
    }
  }, [reload])
  const commit = useCallback((change: (current: Library) => Library): boolean => {
    try {
      const stored = commitLibrary(window.localStorage, (current) =>
        stripBuiltIns(change(mergeBuiltIns(current))),
      )
      setState({ library: mergeBuiltIns(stored), error: '' })
      setSaveError('')
      return true
    } catch (error) {
      setSaveError(message(error))
      return false
    }
  }, [])
  const restore = (backup: Library, mode: RestoreMode, expectedRaw: string | null) => {
    const library = restoreBackup(window.localStorage, backup, mode, expectedRaw)
    setState({ library: mergeBuiltIns(library), error: '' })
    setSaveError('')
  }
  return { ...state, saveError, commit, restore, reload }
}
