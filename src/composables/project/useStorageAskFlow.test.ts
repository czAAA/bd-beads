import { describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { createDevicePreferences } from '../../services/devicePreferences'
import type { PersistentStorage } from '../../services/persistentStorage'
import { useStorageAskFlow } from './useStorageAskFlow'

function setup(persisted: boolean | undefined, options: { answer?: boolean | undefined; kept?: Record<string, string>; openId?: string } = {}) {
  const { kept = {}, openId = 'p1' } = options
  const answer = 'answer' in options ? options.answer : true
  const persistentStorage: PersistentStorage = {
    persisted: vi.fn(() => Promise.resolve(persisted)),
    persist: vi.fn(() => Promise.resolve(answer)),
  }
  const devicePreferences = createDevicePreferences({
    getItem: (key) => kept[key] ?? null,
    setItem: (key, value) => void (kept[key] = value),
    removeItem: (key) => void delete kept[key],
  })
  const showToast = vi.fn()
  const saveFileOf = vi.fn(() => Promise.resolve(true))
  const flow = useStorageAskFlow({ persistentStorage, devicePreferences, messages: () => en, showToast, openProjectId: () => openId, saveFileOf })
  return { flow, persistentStorage, kept, showToast, saveFileOf }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useStorageAskFlow', () => {
  it('asks nothing until a file is saved: creating and drawing write the library, not a file', async () => {
    const { flow, persistentStorage } = setup(false)
    await settle()
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    expect(flow.storageNoteOpen.value).toBe(false)
  })

  it('shows the note at the first file when the browser does not keep the library, and asks only on its button', async () => {
    const { flow, persistentStorage, kept } = setup(false)
    flow.onFileReached()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(true)
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    flow.onConfirmStorageNote()
    expect(persistentStorage.persist).toHaveBeenCalledOnce()
    expect(flow.storageNoteOpen.value).toBe(false)
    expect(kept['openbeads:storage-note-seen']).toBe('yes')
  })

  it('does not repeat: not on later files, and not on a later visit', async () => {
    const { flow, persistentStorage, kept } = setup(false)
    flow.onFileReached()
    await settle()
    flow.onConfirmStorageNote()
    flow.onFileReached()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(false)
    const later = setup(false, { kept })
    later.flow.onFileReached()
    await settle()
    expect(later.flow.storageNoteOpen.value).toBe(false)
    expect(persistentStorage.persist).toHaveBeenCalledOnce()
  })

  it('remembers Not now too, without asking the browser or saying anything', async () => {
    const { flow, persistentStorage, kept, showToast } = setup(false)
    flow.onFileReached()
    await settle()
    flow.onCancelStorageNote()
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
    expect(kept['openbeads:storage-note-seen']).toBe('yes')
  })

  it('shows no note when the browser already keeps the library', async () => {
    const { flow, persistentStorage } = setup(true)
    flow.onFileReached()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(false)
    expect(flow.kept.value).toBe(true)
    expect(persistentStorage.persist).not.toHaveBeenCalled()
  })

  it('does nothing where the browser cannot say', async () => {
    const { flow } = setup(undefined)
    expect(() => flow.onFileReached()).not.toThrow()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(false)
    expect(flow.kept.value).toBeUndefined()
  })

  it('says a yes in a toast, and the state turns kept', async () => {
    const { flow, showToast } = setup(false, { answer: true })
    await settle()
    expect(flow.kept.value).toBe(false)
    flow.onFileReached()
    await settle()
    flow.onConfirmStorageNote()
    await settle()
    expect(showToast).toHaveBeenCalledWith('storage-kept', 'This browser will keep your Projects.', 'success')
    expect(flow.kept.value).toBe(true)
  })

  it('says a no in a Message that stays, whose button saves the open Project file', async () => {
    const { flow, showToast, saveFileOf } = setup(false, { answer: false })
    flow.onFileReached()
    await settle()
    flow.onConfirmStorageNote()
    await settle()
    expect(showToast).toHaveBeenCalledWith(
      'storage-kept',
      "The browser didn't agree to keep Projects. Save a Project file of each one you care about.",
      'warning',
      { label: 'Save Project file', run: expect.any(Function) },
      { persistent: true },
    )
    showToast.mock.calls[0]![3].run()
    expect(saveFileOf).toHaveBeenCalledWith('p1')
    expect(flow.kept.value).toBe(false)
  })

  it('offers no button on a no with no Project open', async () => {
    const { flow, showToast } = setup(false, { answer: false, openId: '' })
    flow.onAskToKeep()
    await settle()
    expect(showToast.mock.calls[0]![3]).toBeUndefined()
  })

  it('asks again from the Menu row, which counts as asked, and says the answer', async () => {
    const { flow, persistentStorage, showToast, kept } = setup(false, { answer: true })
    flow.onAskToKeep()
    await settle()
    expect(persistentStorage.persist).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith('storage-kept', 'This browser will keep your Projects.', 'success')
    expect(kept['openbeads:storage-note-seen']).toBe('yes')
    flow.onFileReached()
    await settle()
    expect(flow.storageNoteOpen.value).toBe(false)
  })

  it('says nothing when the browser gives no answer', async () => {
    const { flow, showToast } = setup(false, { answer: undefined })
    flow.onAskToKeep()
    await settle()
    expect(showToast).not.toHaveBeenCalled()
    expect(flow.kept.value).toBe(false)
  })
})
