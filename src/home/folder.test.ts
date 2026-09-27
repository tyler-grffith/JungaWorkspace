import { describe, expect, it } from 'vitest'
import { homeFiles, LIBRARY_FILE, projectFilePath, README_FILE } from './folder'
import { addProject, emptyLibrary, saveNotes, starterInput } from '../library'
import { builtInId, mergeBuiltIns } from '../modules/builtins'
import { parseBackup } from '../backup'
import { parseProjectFile } from '../import/add'

describe('library folder files', () => {
  it('writes the library in the backup format plus one file per project the user owns', () => {
    const own = addProject(mergeBuiltIns(emptyLibrary()), {
      ...starterInput,
      title: 'Bridge: loads!',
    })
    const edited = saveNotes(own.library, builtInId('laplace'), 'my note')
    const files = homeFiles(edited)
    expect(files.map((f) => f.path)).toEqual([
      LIBRARY_FILE,
      `projects/bridge-loads-${own.project.id.slice(0, 8)}.junga-project.json`,
      `projects/laplace-intuition-example-.junga-project.json`,
      README_FILE,
    ])
    // The library file restores through the backup reader; pristine built-ins are not in it.
    const backup = parseBackup(files[0].content)
    expect(backup.library.projects.map((p) => p.title).sort()).toEqual([
      'Bridge: loads!',
      'LaPlace Intuition',
    ])
    expect(backup.library.projects).toHaveLength(2)
    // Each project file imports on its own.
    expect(parseProjectFile(files[1].content).title).toBe('Bridge: loads!')
    expect(files[3].content).toContain(LIBRARY_FILE)
    expect(projectFilePath({ ...own.project, title: '   ' })).toMatch(/^projects\/project-/)
  })
})
