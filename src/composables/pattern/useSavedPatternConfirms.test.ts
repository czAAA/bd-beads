import { describe, expect, it, vi } from 'vitest'
import { createPattern, type Pattern } from '../../domain/pattern'
import { useSavedPatternConfirms } from './useSavedPatternConfirms'

function make(id: string): Pattern {
  return { ...createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), id }
}

const open = make('open')
const other = make('other')

function setup(options: { open?: boolean; saved?: boolean } = {}) {
  const deps = {
    currentPattern: () => (options.open === false ? undefined : open),
    findPattern: (id: string) => [open, other].find((pattern) => pattern.id === id),
    openPattern: vi.fn(),
    removePattern: vi.fn(),
    saveNow: vi.fn(() => options.saved ?? true),
  }
  return { deps, ...useSavedPatternConfirms(deps) }
}

describe('useSavedPatternConfirms', () => {
  it('asks before removing, and deletes only on confirm', () => {
    const { deps, pendingRemove, onRequestRemove, onCancelRemove, onConfirmRemove } = setup()
    onRequestRemove('other')
    expect(pendingRemove.value?.id).toBe('other')
    expect(deps.removePattern).not.toHaveBeenCalled()
    onCancelRemove()
    expect(pendingRemove.value).toBeUndefined()
    expect(deps.removePattern).not.toHaveBeenCalled()
    onRequestRemove('other')
    onConfirmRemove()
    expect(deps.removePattern).toHaveBeenCalledWith('other')
    expect(pendingRemove.value).toBeUndefined()
  })

  it('asks before switching, and opens only on confirm', () => {
    const { deps, pendingSwitch, onRequestSwitch, onCancelSwitch, onConfirmSwitch } = setup()
    const opened = vi.fn()
    onRequestSwitch('other', opened)
    expect(pendingSwitch.value?.id).toBe('other')
    expect(deps.openPattern).not.toHaveBeenCalled()
    onCancelSwitch()
    expect(pendingSwitch.value).toBeUndefined()
    expect(opened).not.toHaveBeenCalled()
    onRequestSwitch('other', opened)
    onConfirmSwitch()
    expect(deps.openPattern).toHaveBeenCalledWith('other')
    expect(opened).toHaveBeenCalledOnce()
  })

  it('does nothing when the picked Pattern is already open', () => {
    const { deps, pendingSwitch, onRequestSwitch } = setup()
    const opened = vi.fn()
    onRequestSwitch('open', opened)
    expect(pendingSwitch.value).toBeUndefined()
    expect(deps.openPattern).not.toHaveBeenCalled()
    expect(opened).toHaveBeenCalledOnce()
  })

  it('opens straight away with no Pattern open', () => {
    const { deps, pendingSwitch, onRequestSwitch } = setup({ open: false })
    onRequestSwitch('other')
    expect(pendingSwitch.value).toBeUndefined()
    expect(deps.openPattern).toHaveBeenCalledWith('other')
  })

  it('Save first reports a refusal, and a later confirm still switches', () => {
    const { deps, switchSaveRefused, onRequestSwitch, onSaveBeforeSwitch, onConfirmSwitch } = setup({ saved: false })
    onRequestSwitch('other')
    onSaveBeforeSwitch()
    expect(switchSaveRefused.value).toBe(true)
    onConfirmSwitch()
    expect(deps.openPattern).toHaveBeenCalledWith('other')
  })
})
