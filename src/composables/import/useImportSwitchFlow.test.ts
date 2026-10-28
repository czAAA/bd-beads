import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { useImportSwitchFlow } from './useImportSwitchFlow'

function make(id: string, updatedAt: number): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), id, updatedAt }
}

const open = make('open', 1000)
const older = make('older', 2000)
const newer = make('newer', 3000)

function setup(options: { open?: boolean; saved?: boolean } = {}) {
  const deps = {
    currentProject: () => (options.open === false ? undefined : open),
    addProjects: vi.fn(),
    openProject: vi.fn(),
    saveNow: vi.fn(() => options.saved ?? true),
  }
  return { deps, ...useImportSwitchFlow(deps) }
}

describe('useImportSwitchFlow', () => {
  it('joins the library straight away with no Project open', () => {
    const { deps, pendingImport, onImportProjects } = setup({ open: false })
    onImportProjects([older])
    expect(deps.addProjects).toHaveBeenCalledWith([older])
    expect(pendingImport.value).toBeUndefined()
  })

  it('joins the library straight away when nothing came in', () => {
    const { deps, pendingImport, onImportProjects } = setup()
    onImportProjects([])
    expect(deps.addProjects).toHaveBeenCalledWith([])
    expect(pendingImport.value).toBeUndefined()
  })

  it('holds the import back while a Project is open, and offers the most recently updated one', () => {
    const { deps, pendingImport, pendingImportOpens, onImportProjects } = setup()
    onImportProjects([older, newer])
    expect(deps.addProjects).not.toHaveBeenCalled()
    expect(pendingImport.value).toEqual([older, newer])
    expect(pendingImportOpens.value?.id).toBe('newer')
  })

  it('keep current adds the import and opens nothing', () => {
    const { deps, pendingImport, onImportProjects, onKeepCurrentAfterImport } = setup()
    onImportProjects([older])
    onKeepCurrentAfterImport()
    expect(deps.addProjects).toHaveBeenCalledWith([older])
    expect(deps.openProject).not.toHaveBeenCalled()
    expect(pendingImport.value).toBeUndefined()
  })

  it('switch adds the import and opens its most recent Project', () => {
    const { deps, pendingImport, onImportProjects, onSwitchToImported } = setup()
    onImportProjects([older, newer])
    onSwitchToImported()
    expect(deps.addProjects).toHaveBeenCalledWith([older, newer])
    expect(deps.openProject).toHaveBeenCalledWith('newer')
    expect(pendingImport.value).toBeUndefined()
  })

  it('hands the library the Projects it was given, not reactive copies (ticket 0616)', () => {
    const { deps, onImportProjects, onKeepCurrentAfterImport } = setup()
    onImportProjects([older])
    onKeepCurrentAfterImport()
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
