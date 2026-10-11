import { describe, expect, it, vi } from 'vitest'
import { createProject, type Project } from '../../domain/project'
import { useSavedProjectConfirms } from './useSavedProjectConfirms'

function make(id: string): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), id }
}

const open = make('open')
const other = make('other')

function setup(options: { open?: boolean; saved?: boolean } = {}) {
  const deps = {
    currentProject: () => (options.open === false ? undefined : open),
    findProject: (id: string) => [open, other].find((project) => project.id === id),
    openProject: vi.fn(),
    removeProject: vi.fn(),
    saveNow: vi.fn(() => options.saved ?? true),
  }
  return { deps, ...useSavedProjectConfirms(deps) }
}

describe('useSavedProjectConfirms', () => {
  it('asks before removing, and deletes only on confirm', () => {
    const { deps, pendingRemove, onRequestRemove, onCancelRemove, onConfirmRemove } = setup()
    onRequestRemove('other')
    expect(pendingRemove.value?.id).toBe('other')
    expect(deps.removeProject).not.toHaveBeenCalled()
    onCancelRemove()
    expect(pendingRemove.value).toBeUndefined()
    expect(deps.removeProject).not.toHaveBeenCalled()
    onRequestRemove('other')
    onConfirmRemove()
    expect(deps.removeProject).toHaveBeenCalledWith('other')
    expect(pendingRemove.value).toBeUndefined()
  })

  it('asks before switching, and opens only on confirm', () => {
    const { deps, pendingSwitch, onRequestSwitch, onCancelSwitch, onConfirmSwitch } = setup()
    const opened = vi.fn()
    onRequestSwitch('other', opened)
    expect(pendingSwitch.value?.id).toBe('other')
    expect(deps.openProject).not.toHaveBeenCalled()
    onCancelSwitch()
    expect(pendingSwitch.value).toBeUndefined()
    expect(opened).not.toHaveBeenCalled()
    onRequestSwitch('other', opened)
    onConfirmSwitch()
    expect(deps.openProject).toHaveBeenCalledWith('other')
    expect(opened).toHaveBeenCalledOnce()
  })

  it('does nothing when the picked Project is already open', () => {
    const { deps, pendingSwitch, onRequestSwitch } = setup()
    const opened = vi.fn()
    onRequestSwitch('open', opened)
    expect(pendingSwitch.value).toBeUndefined()
    expect(deps.openProject).not.toHaveBeenCalled()
    expect(opened).toHaveBeenCalledOnce()
  })

  it('opens straight away with no Project open', () => {
    const { deps, pendingSwitch, onRequestSwitch } = setup({ open: false })
    onRequestSwitch('other')
    expect(pendingSwitch.value).toBeUndefined()
    expect(deps.openProject).toHaveBeenCalledWith('other')
  })

  it('Save first reports a refusal, and a later confirm still switches', () => {
    const { deps, switchSaveRefused, onRequestSwitch, onSaveBeforeSwitch, onConfirmSwitch } = setup({ saved: false })
    onRequestSwitch('other')
    onSaveBeforeSwitch()
    expect(switchSaveRefused.value).toBe(true)
    onConfirmSwitch()
    expect(deps.openProject).toHaveBeenCalledWith('other')
  })
})
