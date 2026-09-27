// A folder on this computer that mirrors the library. Every save writes `junga-library.json`
// (the same format as a downloaded backup) and one file per project under `projects/`, so the
// work exists as plain files that other tools, git, and file backups can see, and the library
// can be loaded back from the folder in any browser through the restore dialog. Uses the File
// System Access API (Chrome and Edge); elsewhere the feature explains itself and stays out of
// the way. Browser storage remains the source of truth; the folder is a mirror. No React.
import type { Library, Project } from '../library'
import { serializeBackup } from '../backup'
import { serializeProject } from '../import/add'
import { stripBuiltIns } from '../modules/builtins'

export const LIBRARY_FILE = 'junga-library.json'
export const PROJECTS_DIR = 'projects'
export const README_FILE = 'README.md'

type PermissionMode = { mode: 'read' | 'readwrite' }
/** The parts of the File System Access API this module uses, typed here so lib.dom need not. */
export type DirHandle = {
  kind: 'directory'
  name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle>
  removeEntry(name: string): Promise<void>
  entries(): AsyncIterableIterator<[string, { kind: 'file' | 'directory'; name: string }]>
  queryPermission(options?: PermissionMode): Promise<PermissionState>
  requestPermission(options?: PermissionMode): Promise<PermissionState>
}
type FileHandle = {
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
}
type PickerWindow = {
  showDirectoryPicker?: (options?: {
    id?: string
    mode?: 'read' | 'readwrite'
  }) => Promise<DirHandle>
}

export const supportsFolders = () =>
  typeof window !== 'undefined' &&
  typeof (window as unknown as PickerWindow).showDirectoryPicker === 'function' &&
  typeof indexedDB !== 'undefined'

// --- Remembering the handle ---------------------------------------------------------------------
const DB_NAME = 'junga-home'
const STORE = 'handles'
const KEY = 'library'
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('The folder record could not be opened.'))
  })
}
function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () =>
          reject(request.error ?? new Error('The folder record could not be read.'))
        transaction.oncomplete = () => db.close()
      }),
  )
}
/** The folder chosen earlier, if the browser still remembers it. */
export async function storedFolder(): Promise<DirHandle | null> {
  if (!supportsFolders()) return null
  try {
    return (
      ((await withStore<DirHandle | undefined>('readonly', (s) => s.get(KEY))) as DirHandle) ?? null
    )
  } catch {
    return null
  }
}
/** Ask for a folder; the choice is remembered for next time. */
export async function chooseFolder(): Promise<DirHandle> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker
  if (!picker) throw new Error('This browser cannot open folders. Chrome and Edge can.')
  const handle = await picker({ id: 'junga-library', mode: 'readwrite' })
  await withStore('readwrite', (s) => s.put(handle, KEY))
  return handle
}
export async function forgetFolder(): Promise<void> {
  if (!supportsFolders()) return
  await withStore('readwrite', (s) => s.delete(KEY))
}
export const folderPermission = (handle: DirHandle) =>
  handle.queryPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState)
export const requestFolderAccess = async (handle: DirHandle) =>
  (await handle.requestPermission({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted'

// --- What goes in the folder --------------------------------------------------------------------
const slug = (title: string) =>
  title
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'project'
/** `projects/<slug>-<id>.junga-project.json`, stable for a project across renames of others. */
export const projectFilePath = (project: Project) =>
  `${PROJECTS_DIR}/${slug(project.title)}-${project.id.slice(0, 8)}.junga-project.json`
export const README = `# Junga library folder

This folder mirrors a Junga Workspace library. Junga writes it after every change; do not edit
these files by hand while Junga is open, because the next save overwrites them.

- \`${LIBRARY_FILE}\` is the whole library in the backup format. In Junga, use Restore library
  backup (or Library folder › Load from folder) to bring it into any browser.
- \`${PROJECTS_DIR}/\` holds one file per project. Import one into any Junga library through
  Import in the library, or drop it onto the library page.

Built-in examples are not written unless they have been edited.
`
/** The files a library becomes in its folder: the whole library, one file per project, a note. */
export function homeFiles(library: Library): { path: string; content: string }[] {
  const own = stripBuiltIns(library)
  return [
    { path: LIBRARY_FILE, content: serializeBackup(own) },
    ...own.projects.map((project) => ({
      path: projectFilePath(project),
      content: serializeProject(project),
    })),
    { path: README_FILE, content: README },
  ]
}

// --- Reading and writing ------------------------------------------------------------------------
async function writeFile(dir: DirHandle, name: string, content: string) {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}
/** Write the library into the folder and remove project files that no longer belong. */
export async function writeFolder(
  handle: DirHandle,
  library: Library,
): Promise<{ written: number; removed: number }> {
  const files = homeFiles(library)
  const projects = await handle.getDirectoryHandle(PROJECTS_DIR, { create: true })
  const wanted = new Set(
    files
      .filter((f) => f.path.startsWith(`${PROJECTS_DIR}/`))
      .map((f) => f.path.slice(PROJECTS_DIR.length + 1)),
  )
  for (const file of files) {
    if (file.path.startsWith(`${PROJECTS_DIR}/`))
      await writeFile(projects, file.path.slice(PROJECTS_DIR.length + 1), file.content)
    else await writeFile(handle, file.path, file.content)
  }
  let removed = 0
  for await (const [name, entry] of projects.entries())
    if (entry.kind === 'file' && name.endsWith('.junga-project.json') && !wanted.has(name)) {
      await projects.removeEntry(name)
      removed++
    }
  return { written: files.length, removed }
}
/** The folder's library file, as a File the restore dialog can read. */
export async function readFolderLibrary(handle: DirHandle): Promise<File> {
  const file = await handle.getFileHandle(LIBRARY_FILE)
  const contents = await file.getFile()
  return new File([await contents.text()], LIBRARY_FILE, { type: 'application/json' })
}
