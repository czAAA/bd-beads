import { describe, expect, it, vi } from 'vitest'
import { createProject, type Project } from '../../domain/project'
import { useProjectManageFlow } from './useProjectManageFlow'

const make = (name: string) => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name, size: { width: 3, height: 3, unit: 'beads' } })

function setup(projects: Project[]) {
  const library = { projects, open: projects[0] as Project | undefined }
  const deps = {
    currentProject: () => library.open,
    projects: () => library.projects,
    replaceProject: vi.fn((project: Project) => void (library.projects = library.projects.map((p) => (p.id === project.id ? project : p)))),
    addProject: vi.fn((project: Project) => void (library.projects = [project, ...library.projects])),
    removeProject: vi.fn((id: string) => void (library.projects = library.projects.filter((p) => p.id !== id))),
    closeProject: vi.fn(() => void (library.open = undefined)),
  }
  return { flow: useProjectManageFlow(deps), deps, library }
}

describe('useProjectManageFlow', () => {
  it('renames, and refuses an empty name', () => {
    const { flow, deps } = setup([make('Moth')])
    expect(flow.onRenameProject('   ')).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()
    expect(flow.onRenameProject(' Owl ')).toBe(true)
    expect(deps.replaceProject.mock.calls[0]![0].name).toBe('Owl')
  })

  it('suggests the next free number and Cancel changes nothing', () => {
    const { flow, deps } = setup([make('Moth'), make('Moth 2')])
    flow.onRequestDuplicate()
    expect(flow.duplicating.value).toBe('Moth 3')
    flow.onCancelDuplicate()
    expect(flow.duplicating.value).toBeUndefined()
    expect(deps.addProject).not.toHaveBeenCalled()
  })

  it('duplicates under the chosen name, keeping Row progress', () => {
    const moth = { ...make('Moth'), rowProgress: { direction: 'rows' as const, currentRow: 2, currentColumn: 0 } }
    const { flow, deps } = setup([moth])
    flow.onRequestDuplicate()
    expect(flow.onConfirmDuplicate('')).toBe(false)
    expect(flow.onConfirmDuplicate('Copy')).toBe(true)
    const copy = deps.addProject.mock.calls[0]![0]
    expect(copy).toMatchObject({ name: 'Copy', rowProgress: moth.rowProgress })
    expect(copy.id).not.toBe(moth.id)
  })

  it('deletes only the open Project and leaves none open', () => {
    const { flow, deps, library } = setup([make('Moth'), make('Owl')])
    flow.onRequestDelete()
    expect(flow.deleting.value).toBe(true)
    flow.onConfirmDelete()
    expect(deps.removeProject).toHaveBeenCalledOnce()
    expect(library.projects.map((p) => p.name)).toEqual(['Owl'])
    expect(library.open).toBeUndefined()
    expect(flow.deleting.value).toBe(false)
  })
})
