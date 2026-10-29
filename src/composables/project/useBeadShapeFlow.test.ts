import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import { beadOfLayer } from '../../domain/layerRecord'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'
import { useBeadShapeFlow } from './useBeadShapeFlow'

const framed = (): Project => createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 4, height: 4, unit: 'beads' } })

function setup(project: Project | undefined) {
  const harness = editHarness(project)
  return { harness, ...useBeadShapeFlow({ currentProject: harness.currentProject, replaceProject: harness.replaceProject }) }
}

describe('useBeadShapeFlow (tickets 508, 0670)', () => {
  it('sets each layer\'s Bead shape on its own, saved with the Project and no Undo step', () => {
    const { harness, setBeadShape } = setup(framed())
    setBeadShape('frame', 'real')
    expect([beadOfLayer(harness.project, 'canvas').beadShape, beadOfLayer(harness.project, 'frame').beadShape]).toEqual(['symmetric', 'real'])
    setBeadShape('canvas', 'real')
    expect(beadOfLayer(harness.project, 'canvas').beadShape).toBe('real')
    expect(harness.replaceProject).toHaveBeenCalledTimes(2)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('still sets the Frame\'s once a Row progress pass is done', () => {
    const { harness, setBeadShape } = setup(moveToRow(framed(), 2))
    setBeadShape('frame', 'real')
    expect(beadOfLayer(harness.project, 'frame').beadShape).toBe('real')
  })

  it('writes nothing for the shape a layer already has, for a Frame the Project lacks, or with no Project open', () => {
    const { harness, setBeadShape } = setup(createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0' }))
    setBeadShape('canvas', 'symmetric')
    setBeadShape('frame', 'real')
    expect(harness.replaceProject).not.toHaveBeenCalled()
    expect(() => setup(undefined).setBeadShape('canvas', 'real')).not.toThrow()
  })
})
