import { describe, expect, it, vi } from 'vitest'
import { createDevicePreferences } from '../../services/devicePreferences'
import type { PersistentStorage } from '../../services/persistentStorage'
import { useStorageAskFlow } from './useStorageAskFlow'

function setup(persisted: boolean | undefined, kept: Record<string, string> = {}) {
  const persistentStorage: PersistentStorage = {
    persisted: vi.fn(() => Promise.resolve(persisted)),
    persist: vi.fn(() => Promise.resolve()),
  }
  const devicePreferences = createDevicePreferences({
    getItem: (key) => kept[key] ?? null,
    setItem: (key, value) => void (kept[key] = value),
    removeItem: (key) => void delete kept[key],
  })
  const flow = useStorageAskFlow({ persistentStorage, devicePreferences })
  return { flow, persistentStorage, kept }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useStorageAskFlow', () => {
  it('asks nothing until a Project is saved', async () => {
    const { flow, persistentStorage } = setup(false)
    await settle()
    expect(persistentStorage.persisted).not.toHaveBeenCalled()
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    expect(flow.storageNoteOpen.value).toBe(false)
  })

  it('shows the note at the first save when the browser does not keep the library, and asks only on its button', async () => {
    const { flow, persistentStorage, kept } = setup(false)
    flow.onLibrarySaved()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(true)
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    flow.onConfirmStorageNote()
    expect(persistentStorage.persist).toHaveBeenCalledOnce()
    expect(flow.storageNoteOpen.value).toBe(false)
    expect(kept['openbeads:storage-note-seen']).toBe('yes')
  })

  it('does not repeat: not on later saves, and not on a later visit', async () => {
    const { flow, persistentStorage, kept } = setup(false)
    flow.onLibrarySaved()
    await settle()
    flow.onConfirmStorageNote()
    flow.onLibrarySaved()
    await settle()
    expect(persistentStorage.persisted).toHaveBeenCalledOnce()
    const later = setup(false, kept)
    later.flow.onLibrarySaved()
    await settle()
    expect(later.persistentStorage.persisted).not.toHaveBeenCalled()
    expect(later.flow.storageNoteOpen.value).toBe(false)
  })

  it('remembers a skip too, without asking the browser', async () => {
    const { flow, persistentStorage, kept } = setup(false)
    flow.onLibrarySaved()
    await settle()
    flow.onCancelStorageNote()
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    expect(kept['openbeads:storage-note-seen']).toBe('yes')
  })

  it('shows no note when the browser already keeps the library', async () => {
    const { flow, persistentStorage } = setup(true)
    flow.onLibrarySaved()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(false)
    expect(persistentStorage.persist).not.toHaveBeenCalled()
  })

  it('does nothing where the browser cannot say', async () => {
    const { flow } = setup(undefined)
    expect(() => flow.onLibrarySaved()).not.toThrow()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(false)
  })
})
