import { describe, expect, it, vi } from 'vitest'
import { createProject, restoreSnapshot, snapshotOf, type Project } from '../../domain/project'
import type { EditFn } from './useEdit'
import { useBeadShapeFlow } from './useBeadShapeFlow'

function setup(beadShape?: 'real') {
  let current: Project = createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', ...(beadShape ? { beadShape } : {}) })
  const edit = vi.fn(((_kind, command) => {
    current = command(current) as Project
    return { kind: 'applied' }
  }) as EditFn)
  return { flow: useBeadShapeFlow({ currentProject: () => current, edit }), edit, project: () => current }
}

describe('useBeadShapeFlow (ticket 508)', () => {
  it('saves the other Bead shape on the Project as one edit', () => {
    const { flow, edit, project } = setup()
    flow.setBeadShape('real')
    expect(edit).toHaveBeenCalledOnce()
    expect(project().beadShape).toBe('real')
    flow.setBeadShape('symmetric')
    expect(project().beadShape).toBeUndefined()
  })

  it('does nothing for the shape the Project already has', () => {
    const { flow, edit } = setup('real')
    flow.setBeadShape('real')
    expect(edit).not.toHaveBeenCalled()
  })

  it('is taken back by Undo and redone by Redo', () => {
    const { flow, project } = setup()
    const before = snapshotOf(project(), { columns: 0, rows: 0 } as never)
    flow.setBeadShape('real')
    const after = snapshotOf(project(), { columns: 0, rows: 0 } as never)
    expect(restoreSnapshot(project(), before).beadShape).toBeUndefined()
    expect(restoreSnapshot(project(), after).beadShape).toBe('real')
  })
})
