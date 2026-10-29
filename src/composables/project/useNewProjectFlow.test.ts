import { describe, expect, it, vi } from 'vitest'
import type { CreateProjectInput } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { starterById, starterDesign } from '../../domain/starters'
import { useNewProjectFlow } from './useNewProjectFlow'

const draft: CreateProjectInput = {
  technique: 'loom',
  beadId: 'toho-cube-1.5mm',
  size: { width: 3, height: 2, unit: 'beads' },
}

function setup() {
  const deps = { addProject: vi.fn<(project: Project) => void>() }
  return { deps, flow: useNewProjectFlow(deps) }
}

describe('useNewProjectFlow', () => {
  it('creates a blank Project from the form', () => {
    const { deps, flow } = setup()
    flow.onCreateProject(draft)
    expect(deps.addProject).toHaveBeenCalledOnce()
    expect(deps.addProject.mock.calls[0][0]).toMatchObject({ frame: { columns: 3, rows: 2 } })
  })

  it('creates a Project from a Starter, its design in the Frame (ticket 0596)', () => {
    const { deps, flow } = setup()
    flow.onCreateFromStarter(starterById('triangle'), { name: 'Sun', beadId: 'miyuki/delica/11-0', sizes: { rounds: 10 }, useDesign: true })
    const created = deps.addProject.mock.calls[0][0]
    expect(created).toMatchObject({ name: 'Sun', frame: { kind: 'triangle', settings: { rounds: 10 } } })
    expect(created.frame!.beads).toEqual(starterDesign(starterById('triangle')))
  })

  it('creates a Canvas, with no Frame, when the form states no size', () => {
    const { deps, flow } = setup()
    flow.onCreateProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    const created = deps.addProject.mock.calls[0][0]
    expect(created.frame).toBeUndefined()
    expect(created.beads).toEqual({})
  })
})
