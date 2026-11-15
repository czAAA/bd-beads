import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { en } from '../../i18n/en'
import { useDeleteProjectFlow } from './useDeleteProjectFlow'
import { useToasts } from '../ui/useToasts'

const DELETED_TOAST = 'project-deleted'
const NAMES: Record<string, string> = { moth: 'Moth', owl: 'Owl' }

function setup(open?: string) {
  const openId = ref(open)
  const { toasts, show, dismiss } = useToasts()
  const deps = {
    findProject: (id: string) => (NAMES[id] ? { id, name: NAMES[id] } : undefined),
    removeProject: vi.fn((id: string) => {
      if (openId.value === id) openId.value = id === 'owl' ? 'moth' : undefined
    }),
    restoreRemoved: vi.fn(),
    forgetRemoved: vi.fn(),
    saveProjectFile: vi.fn(async () => true),
    openProjectId: () => openId.value,
    openProjectName: () => (openId.value ? NAMES[openId.value] : undefined),
    showToast: show,
    toastShowing: (id: string) => toasts.value.some((toast) => toast.id === id),
    messages: () => en,
  }
  const toast = () => toasts.value.find((each) => each.id === DELETED_TOAST)
  return { deps, openId, toast, dismiss, ...useDeleteProjectFlow(deps) }
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
    const { openId, deletedName, onRequestDelete, onConfirmDelete } = setup('moth')
    expect(deletedName.value).toBeUndefined()
    onRequestDelete('moth')
    onConfirmDelete()
    expect(deletedName.value).toBe('Moth')

    openId.value = 'owl'
    await nextTick()
    expect(deletedName.value).toBeUndefined()
  })

  it('names no Project when another one stays open after the delete', () => {
    const { deletedName, onRequestDelete, onConfirmDelete } = setup('moth')
    onRequestDelete('owl')
    onConfirmDelete()
    expect(deletedName.value).toBeUndefined()
  })

  it('says which Project was deleted and which is open now, with Undo (ticket 0983)', () => {
    const { deps, toast, onRequestDelete, onConfirmDelete } = setup('owl')
    onRequestDelete('owl')
    onConfirmDelete()
    expect(toast()).toMatchObject({ text: '“Owl” was deleted. Now in “Moth”.', tone: 'success', action: { label: 'Undo' } })

    toast()!.action!.run()
    expect(deps.restoreRemoved).toHaveBeenCalledOnce()
  })

  it('says only which was deleted when the open Project stays open, or none is left', () => {
    const kept = setup('moth')
    kept.onRequestDelete('owl')
    kept.onConfirmDelete()
    expect(kept.toast()?.text).toBe('“Owl” was deleted.')

    const none = setup('moth')
    none.onRequestDelete('moth')
    none.onConfirmDelete()
    expect(none.toast()?.text).toBe('“Moth” was deleted.')
  })

  it('holds the deleted Project while its toast shows, and lets it go once the toast goes', async () => {
    const { deps, dismiss, onRequestDelete, onConfirmDelete } = setup('moth')
    onRequestDelete('owl')
    onConfirmDelete()
    await nextTick()
    expect(deps.forgetRemoved).not.toHaveBeenCalled()

    dismiss(DELETED_TOAST)
    await nextTick()
    expect(deps.forgetRemoved).toHaveBeenCalledOnce()
  })
})
