import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import { restoreSnapshot, snapshotOf } from '../../domain/undoSnapshot'
import type { Project } from '../../domain/project'
import type { EditFn } from './useEdit'
import { useBeadShapeFlow } from './useBeadShapeFlow'
import { canvasOf, frameOf } from '../../domain/layerRecord'

function setup(beadShape?: 'real') {
  let current: Project = createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 3, height: 3, unit: 'beads' }, ...(beadShape ? { beadShape } : {}) })
  const edit = vi.fn(((_kind, command) => {
    current = command(current) as Project
    return { kind: 'applied' }
  }) as EditFn)
  return { flow: useBeadShapeFlow({ currentProject: () => current, edit }), edit, project: () => current }
}

describe('useBeadShapeFlow (ticket 508)', () => {
  it('saves the other Bead shape on the Project as one edit', () => {
    const { flow, edit, project } = setup()
    flow.setBeadShape('canvas', 'real')
    expect(edit).toHaveBeenCalledOnce()
    expect(canvasOf(project()).beadShape).toBe('real')
    flow.setBeadShape('canvas', 'symmetric')
    expect(canvasOf(project()).beadShape).toBeUndefined()
  })

  it("sets the shape of the layer whose panel asked, the other's staying (ticket 0687)", () => {
    const { flow, project } = setup()
    flow.setBeadShape('frame', 'real')
    expect(frameOf(project())!.beadShape).toBe('real')
    expect(canvasOf(project()).beadShape).toBeUndefined()
  })

  it('does nothing for the shape the layer already has', () => {
    const { flow, edit } = setup('real')
    flow.setBeadShape('canvas', 'real')
    expect(edit).not.toHaveBeenCalled()
  })

  it('is taken back by Undo and redone by Redo', () => {
    const { flow, project } = setup()
    const before = snapshotOf(project())
    flow.setBeadShape('canvas', 'real')
    const after = snapshotOf(project())
    expect(canvasOf(restoreSnapshot(project(), before)).beadShape).toBeUndefined()
    expect(canvasOf(restoreSnapshot(project(), after)).beadShape).toBe('real')
  })
})
