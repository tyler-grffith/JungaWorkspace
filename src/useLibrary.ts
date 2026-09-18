import { useCallback, useEffect, useState } from 'react'
import { commitLibrary, readLibrary, STORAGE_KEY, type Library } from './library'

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
      if (event.key === STORAGE_KEY || event.key === null) setState(load())
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
  return { ...state, saveError, commit, reload: () => setState(load()) }
}
