import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { withProjectName } from '../../domain/projectName'
import { useImportSwitchFlow } from './useImportSwitchFlow'

function make(id: string, updatedAt: number, name = id): Project {
  return { ...createProject({ name, technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), id, updatedAt }
}

const open = make('open', 1000)
const older = make('older', 2000)
const newer = make('newer', 3000)

/** The library's add as the flow sees it: what joined, `rename` naming the Projects whose name was taken. */
function setup(options: { open?: boolean; saved?: boolean; rename?: Record<string, string> } = {}) {
  const deps = {
    currentProject: () => (options.open === false ? undefined : open),
    addProjects: vi.fn((projects: Project[]) => projects.map((project) => (options.rename?.[project.id] ? withProjectName(project, options.rename[project.id]!) : project))),
    openProject: vi.fn(),
    saveNow: vi.fn(() => options.saved ?? true),
  }
  return { deps, ...useImportSwitchFlow(deps) }
}

describe('useImportSwitchFlow', () => {
  it('joins the library and asks nothing with no Project open', () => {
    const { deps, pendingImport, onImportProjects } = setup({ open: false })
    onImportProjects([older])
    expect(deps.addProjects).toHaveBeenCalledWith([older])
    expect(pendingImport.value).toBeUndefined()
  })

  it('asks nothing when nothing came in', () => {
    const { pendingImport, onImportProjects } = setup()
    onImportProjects([])
    expect(pendingImport.value).toBeUndefined()
  })

  it('joins the library at once while a Project is open, and offers the most recently updated one (ticket 0860)', () => {
    const { deps, pendingImport, pendingImportOpens, onImportProjects } = setup()
    onImportProjects([older, newer])
    expect(deps.addProjects).toHaveBeenCalledWith([older, newer])
    expect(pendingImport.value?.projects).toEqual([older, newer])
    expect(pendingImport.value?.takenNames.size).toBe(0)
    expect(pendingImportOpens.value?.id).toBe('newer')
    expect(deps.openProject).not.toHaveBeenCalled()
  })

  it('keeps the name a Project came with where the library had it, for the question to say (ticket 0860)', () => {
    const { pendingImport, pendingImportOpens, onImportProjects } = setup({ rename: { newer: 'newer 2' } })
    onImportProjects([older, newer])
    expect(pendingImport.value?.takenNames).toEqual(new Map([['newer', 'newer']]))
    expect(pendingImportOpens.value?.id).toBe('newer')
  })

  it('Stay here opens nothing and closes the question', () => {
    const { deps, pendingImport, onImportProjects, onKeepCurrentAfterImport } = setup()
    onImportProjects([older])
    onKeepCurrentAfterImport()
    expect(deps.addProjects).toHaveBeenCalledOnce()
    expect(deps.openProject).not.toHaveBeenCalled()
    expect(pendingImport.value).toBeUndefined()
  })

  it('Open opens the import\'s most recent Project, adding nothing twice', () => {
    const { deps, pendingImport, onImportProjects, onSwitchToImported } = setup()
    onImportProjects([older, newer])
    onSwitchToImported()
    expect(deps.addProjects).toHaveBeenCalledOnce()
    expect(deps.openProject).toHaveBeenCalledWith('newer')
    expect(pendingImport.value).toBeUndefined()
  })

  it('hands the library the Projects it was given, not reactive copies (ticket 0616)', () => {
    const { deps, onImportProjects } = setup()
    onImportProjects([older])
    expect(deps.addProjects.mock.calls[0]![0][0]).toBe(older)
  })

  it('answering with nothing pending does nothing', () => {
    const { deps, onKeepCurrentAfterImport, onSwitchToImported } = setup()
    onKeepCurrentAfterImport()
    onSwitchToImported()
    expect(deps.addProjects).not.toHaveBeenCalled()
    expect(deps.openProject).not.toHaveBeenCalled()
  })

  it('remembers when Save current was refused, and forgets it on the next import', () => {
    const { importSaveRefused, onImportProjects, onSaveBeforeImportSwitch } = setup({ saved: false })
    onImportProjects([older])
    onSaveBeforeImportSwitch()
    expect(importSaveRefused.value).toBe(true)
    onImportProjects([newer])
    expect(importSaveRefused.value).toBe(false)
  })

  it('does not report a refusal when Save current got through', () => {
    const { importSaveRefused, onSaveBeforeImportSwitch } = setup({ saved: true })
    onSaveBeforeImportSwitch()
    expect(importSaveRefused.value).toBe(false)
  })
})
