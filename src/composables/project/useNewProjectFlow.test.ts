import { describe, expect, it, vi } from 'vitest'
import type { CreateProjectInput } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { starterById, starterDesign } from '../../domain/starters'
import { useNewProjectFlow } from './useNewProjectFlow'
import { beadsOfLayer, frameOf } from '../../domain/layerRecord'
import { layersView } from '../../testUtils/layerFields'

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
    expect(layersView(deps.addProject.mock.calls[0][0])).toMatchObject({ frame: { columns: 3, rows: 2 } })
  })

  it('creates a Project from a Starter, its design in the Frame (ticket 0596)', () => {
    const { deps, flow } = setup()
    flow.onCreateFromStarter(starterById('triangle'), { name: 'Sun', beadId: 'miyuki/delica/11-0', background: 0, sizes: { rounds: 10 }, useDesign: true })
    const created = deps.addProject.mock.calls[0][0]
    expect(layersView(created)).toMatchObject({ name: 'Sun', frame: { shape: 'triangle', settings: { rounds: 10 } } })
    expect(frameOf(created)!.beads).toEqual(starterDesign(starterById('triangle')))
  })

  it('creates a Canvas, with no Frame, when the form states no size', () => {
    const { deps, flow } = setup()
    flow.onCreateProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    const created = deps.addProject.mock.calls[0][0]
    expect(frameOf(created)).toBeUndefined()
    expect(beadsOfLayer(created, 'canvas')).toEqual({})
  })
})
