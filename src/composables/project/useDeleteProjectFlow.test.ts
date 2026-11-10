import { describe, expect, it, vi } from 'vitest'
import { useDeleteProjectFlow } from './useDeleteProjectFlow'

function setup() {
  const deps = {
    findProject: (id: string) => [{ id: 'moth', name: 'Moth' }, { id: 'owl', name: 'Owl' }].find((entry) => entry.id === id),
    removeProject: vi.fn(),
    saveProjectFile: vi.fn(async () => true),
  }
  return { deps, ...useDeleteProjectFlow(deps) }
}

describe('useDeleteProjectFlow', () => {
  it('asks about the named Project, and removes it only on Delete', () => {
    const { deps, pendingDelete, onRequestDelete, onCancelDelete, onConfirmDelete } = setup()
    onRequestDelete('owl')
    expect(pendingDelete.value).toEqual({ id: 'owl', name: 'Owl' })
    onCancelDelete()
    expect(pendingDelete.value).toBeUndefined()
    expect(deps.removeProject).not.toHaveBeenCalled()

    onRequestDelete('owl')
    onConfirmDelete()
    expect(deps.removeProject).toHaveBeenCalledExactlyOnceWith('owl')
    expect(pendingDelete.value).toBeUndefined()
  })

  it('asks nothing about a Project the library does not hold', () => {
    const { pendingDelete, onRequestDelete } = setup()
    onRequestDelete('gone')
    expect(pendingDelete.value).toBeUndefined()
  })

  it('Save Project file saves the asked-about Project and leaves the question open', () => {
    const { deps, pendingDelete, onRequestDelete, onSaveFileBeforeDelete } = setup()
    onRequestDelete('moth')
    onSaveFileBeforeDelete()
    expect(deps.saveProjectFile).toHaveBeenCalledExactlyOnceWith('moth')
    expect(pendingDelete.value?.id).toBe('moth')
    expect(deps.removeProject).not.toHaveBeenCalled()
  })
})
