import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDeleteProjectFlow } from './useDeleteProjectFlow'

function setup(open?: string) {
  const openId = ref(open)
  const deps = {
    findProject: (id: string) => [{ id: 'moth', name: 'Moth' }, { id: 'owl', name: 'Owl' }].find((entry) => entry.id === id),
    removeProject: vi.fn((id: string) => {
      if (openId.value === id) openId.value = undefined
    }),
    saveProjectFile: vi.fn(async () => true),
    openProjectId: () => openId.value,
  }
  return { deps, openId, ...useDeleteProjectFlow(deps) }
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

  it('names the deleted Project once its delete leaves no Project open, until one opens', async () => {
    const { openId, deletedName, onRequestDelete, onConfirmDelete } = setup('owl')
    expect(deletedName.value).toBeUndefined()
    onRequestDelete('owl')
    onConfirmDelete()
    expect(deletedName.value).toBe('Owl')

    openId.value = 'moth'
    await nextTick()
    expect(deletedName.value).toBeUndefined()
  })

  it('names no Project when another one stays open after the delete', () => {
    const { deletedName, onRequestDelete, onConfirmDelete } = setup('moth')
    onRequestDelete('owl')
    onConfirmDelete()
    expect(deletedName.value).toBeUndefined()
  })
})
