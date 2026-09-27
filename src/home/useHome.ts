// The library folder's state for the shell: whether the browser can do this at all, which
// folder is connected, whether it can be written to right now, and what the last write said.
// `mirror` is what the library hook calls after every successful save; writes are debounced
// so a burst of edits becomes one write. A module-level store, subscribed by `useHome`.
import { useSyncExternalStore } from 'react'
import type { Library } from '../library'
import {
  chooseFolder,
  folderPermission,
  forgetFolder,
  readFolderLibrary,
  requestFolderAccess,
  storedFolder,
  supportsFolders,
  writeFolder,
  type DirHandle,
} from './folder'

export type HomeState = {
  supported: boolean
  /** Whether the remembered folder has been looked up yet. */
  ready: boolean
  handle: DirHandle | null
  name: string
  /** 'granted' means writes go through; 'prompt' means a click is needed first. */
  permission: PermissionState | null
  writing: boolean
  lastWrite: string | null
  error: string
}
let state: HomeState = {
  supported: supportsFolders(),
  ready: false,
  handle: null,
  name: '',
  permission: null,
  writing: false,
  lastWrite: null,
  error: '',
}
const listeners = new Set<() => void>()
function set(patch: Partial<HomeState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function useHome(): HomeState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}

let loaded: Promise<void> | null = null
/** Look up the remembered folder once. */
export function loadHome(): Promise<void> {
  loaded ??= (async () => {
    if (!state.supported) {
      set({ ready: true })
      return
    }
    const handle = await storedFolder()
    set({
      ready: true,
      handle,
      name: handle?.name ?? '',
      permission: handle ? await folderPermission(handle) : null,
    })
  })()
  return loaded
}

let pending: Library | null = null
let timer: ReturnType<typeof setTimeout> | undefined
async function flush() {
  const library = pending
  pending = null
  if (!library || !state.handle) return
  const permission = await folderPermission(state.handle)
  set({ permission })
  if (permission !== 'granted') return
  set({ writing: true, error: '' })
  try {
    await writeFolder(state.handle, library)
    set({ writing: false, lastWrite: new Date().toISOString() })
  } catch (error) {
    set({
      writing: false,
      error: error instanceof Error ? error.message : 'The folder could not be written.',
    })
  }
}
/** Write the library to the connected folder after a short pause; harmless when none is. */
export function mirror(library: Library, delay = 1500) {
  if (!state.supported) return
  pending = library
  clearTimeout(timer)
  timer = setTimeout(() => void flush(), delay)
}
/** Write now, asking for access first if the folder needs a click. */
export async function writeNow(library: Library): Promise<boolean> {
  if (!state.handle) return false
  if (
    (await folderPermission(state.handle)) !== 'granted' &&
    !(await requestFolderAccess(state.handle))
  ) {
    set({ permission: 'denied', error: 'Access to the folder was not granted.' })
    return false
  }
  clearTimeout(timer)
  pending = library
  await flush()
  return !state.error
}
export async function connect(library: Library): Promise<void> {
  try {
    const handle = await chooseFolder()
    set({ handle, name: handle.name, permission: 'granted', error: '', lastWrite: null })
    await writeNow(library)
  } catch (error) {
    // A closed picker is not an error worth showing.
    if (error instanceof DOMException && error.name === 'AbortError') return
    set({ error: error instanceof Error ? error.message : 'The folder could not be opened.' })
  }
}
export async function grantAccess(library: Library): Promise<void> {
  if (!state.handle) return
  if (await requestFolderAccess(state.handle)) {
    set({ permission: 'granted', error: '' })
    await writeNow(library)
  } else set({ permission: 'denied', error: 'Access to the folder was not granted.' })
}
export async function disconnect(): Promise<void> {
  clearTimeout(timer)
  pending = null
  await forgetFolder()
  set({ handle: null, name: '', permission: null, lastWrite: null, error: '', writing: false })
}
/** The folder's library file for the restore dialog, asking for access if needed. */
export async function loadFromFolder(): Promise<File> {
  if (!state.handle) throw new Error('No folder is connected.')
  if (
    (await folderPermission(state.handle)) !== 'granted' &&
    !(await requestFolderAccess(state.handle))
  )
    throw new Error('Access to the folder was not granted.')
  return readFolderLibrary(state.handle)
}
