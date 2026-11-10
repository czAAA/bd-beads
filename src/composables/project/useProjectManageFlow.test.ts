import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { useProjectManageFlow } from './useProjectManageFlow'
import { canvasOf } from '../../domain/layerRecord'

const make = (name: string) => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name, size: { width: 3, height: 3, unit: 'beads' } })

function setup(projects: Project[]) {
  const library = { projects, open: projects[0] as Project | undefined }
  const deps = {
    currentProject: () => library.open,
    projects: () => library.projects,
    replaceProject: vi.fn((project: Project) => void (library.projects = library.projects.map((p) => (p.id === project.id ? project : p)))),
    addProject: vi.fn((project: Project) => void (library.projects = [project, ...library.projects])),
    removeAllProjects: vi.fn(() => void (library.projects = [])),
  }
  return { flow: useProjectManageFlow(deps), deps, library }
}

describe('useProjectManageFlow', () => {
  it('renames, and refuses an empty name', () => {
    const { flow, deps } = setup([make('Moth')])
    expect(flow.onRenameProject('   ')).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()
    expect(flow.onRenameProject(' Owl ')).toBe(true)
    expect(canvasOf(deps.replaceProject.mock.calls[0]![0]).name).toBe('Owl')
  })

  it('suggests the next free number and Cancel changes nothing', () => {
    const { flow, deps } = setup([make('Moth'), make('Moth 2')])
    flow.onRequestDuplicate()
    expect(flow.duplicating.value).toBe('Moth 3')
    flow.onCancelDuplicate()
    expect(flow.duplicating.value).toBeUndefined()
    expect(deps.addProject).not.toHaveBeenCalled()
  })

  // What a copy keeps (Row progress included) is duplicateProject's (projectName.test).
  it('duplicates under the chosen name, and refuses an empty one', () => {
    const moth = make('Moth')
    const { flow, deps } = setup([moth])
    flow.onRequestDuplicate()
    expect(flow.onConfirmDuplicate('')).toBe(false)
    expect(flow.onConfirmDuplicate('Copy')).toBe(true)
    const copy = deps.addProject.mock.calls[0]![0]
    expect(canvasOf(copy).name).toBe('Copy')
    expect(copy.id).not.toBe(moth.id)
  })

  it('deletes every Project only after being asked, and leaves none open', () => {
    const { flow, deps, library } = setup([make('Moth'), make('Owl')])
    flow.onRequestDeleteAllProjects()
    expect(flow.deletingAll.value).toBe(true)
    flow.onCancelDeleteAllProjects()
    expect(deps.removeAllProjects).not.toHaveBeenCalled()

    flow.onRequestDeleteAllProjects()
    flow.onConfirmDeleteAllProjects()
    expect(library.projects).toEqual([])
    expect(flow.deletingAll.value).toBe(false)
  })

  it('does not ask to delete all with no Project saved', () => {
    const { flow } = setup([])
    flow.onRequestDeleteAllProjects()
    expect(flow.deletingAll.value).toBe(false)
  })
})
