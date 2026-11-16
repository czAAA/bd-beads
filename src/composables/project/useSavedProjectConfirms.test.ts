import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { useSavedProjectConfirms } from './useSavedProjectConfirms'

function make(id: string): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), id }
}

const open = make('open')

function setup(options: { open?: boolean; saved?: boolean; saveFailed?: boolean; nameHidden?: boolean } = {}) {
  const deps = {
    currentProject: () => (options.open === false ? undefined : open),
    findProject: (id: string) => [{ id: 'open', name: 'Open' }, { id: 'other', name: 'Other' }, { id: 'huge', name: 'Huge', gatedBeads: 31_000_000 }].find((entry) => entry.id === id),
    openProject: vi.fn(),
    saveFailed: () => options.saveFailed ?? false,
    saveNow: vi.fn(async () => options.saved ?? true),
    nameHidden: () => options.nameHidden ?? false,
    showToast: vi.fn(),
    messages: () => en,
  }
  return { deps, ...useSavedProjectConfirms(deps) }
}

describe('useSavedProjectConfirms', () => {
  it('opens a picked Project at once, as nothing can be lost (ticket 0860)', () => {
    const { deps, pendingSwitch, onRequestSwitch } = setup()
    const opened = vi.fn()
    onRequestSwitch('other', opened)
    expect(pendingSwitch.value).toBeUndefined()
    expect(deps.openProject).toHaveBeenCalledWith('other')
    expect(opened).toHaveBeenCalledOnce()
  })

  it('asks first while the last save failed, and opens only on confirm', () => {
    const { deps, pendingSwitch, onRequestSwitch, onCancelSwitch, onConfirmSwitch } = setup({ saveFailed: true })
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

  it('Save first switches once the save gets through', async () => {
    const { deps, pendingSwitch, switchSaveRefused, onRequestSwitch, onSaveBeforeSwitch } = setup({ saveFailed: true })
    onRequestSwitch('other')
    await onSaveBeforeSwitch()
    expect(switchSaveRefused.value).toBe(false)
    expect(pendingSwitch.value).toBeUndefined()
    expect(deps.openProject).toHaveBeenCalledWith('other')
  })

  it('Save first reports a refusal, and a later confirm still switches', async () => {
    const { deps, switchSaveRefused, onRequestSwitch, onSaveBeforeSwitch, onConfirmSwitch } = setup({ saved: false, saveFailed: true })
    onRequestSwitch('other')
    await onSaveBeforeSwitch()
    expect(switchSaveRefused.value).toBe(true)
    expect(deps.openProject).not.toHaveBeenCalled()
    onConfirmSwitch()
    expect(deps.openProject).toHaveBeenCalledWith('other')
  })

  it('asks before opening a Project over the size gate, with or without one open, and opens it only on Open anyway (ticket 0716)', () => {
    for (const isOpen of [true, false]) {
      const { deps, pendingLargeOpen, pendingSwitch, onRequestSwitch, onCancelLargeOpen, onConfirmLargeOpen } = setup({ open: isOpen })
      const opened = vi.fn()
      onRequestSwitch('huge', opened)
      expect(pendingLargeOpen.value).toMatchObject({ id: 'huge', gatedBeads: 31_000_000 })
      expect(pendingSwitch.value).toBeUndefined()
      onCancelLargeOpen()
      expect(deps.openProject).not.toHaveBeenCalled()
      onRequestSwitch('huge', opened)
      onConfirmLargeOpen()
      expect(deps.openProject).toHaveBeenCalledWith('huge')
      expect(opened).toHaveBeenCalledOnce()
    }
  })

  it('says which Project is open now where the strip shows no name, after a pick, a Switch Project? or an Open anyway (ticket 0986)', () => {
    const picked = setup({ nameHidden: true })
    picked.onRequestSwitch('other')
    expect(picked.deps.showToast).toHaveBeenCalledWith('opened', 'Now in “Other”.', 'info')
    const confirmed = setup({ nameHidden: true, saveFailed: true })
    confirmed.onRequestSwitch('other')
    expect(confirmed.deps.showToast).not.toHaveBeenCalled()
    confirmed.onConfirmSwitch()
    expect(confirmed.deps.showToast).toHaveBeenCalledWith('opened', 'Now in “Other”.', 'info')
    const large = setup({ nameHidden: true })
    large.onRequestSwitch('huge')
    large.onConfirmLargeOpen()
    expect(large.deps.showToast).toHaveBeenCalledWith('opened', 'Now in “Huge”.', 'info')
  })

  it('says nothing where the strip shows the name, or when the picked Project was open already', () => {
    const wide = setup()
    wide.onRequestSwitch('other')
    expect(wide.deps.openProject).toHaveBeenCalledWith('other')
    expect(wide.deps.showToast).not.toHaveBeenCalled()
    const same = setup({ nameHidden: true })
    same.onRequestSwitch('open')
    expect(same.deps.showToast).not.toHaveBeenCalled()
  })
})
