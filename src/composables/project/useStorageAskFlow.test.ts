import { describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { createDevicePreferences } from '../../services/devicePreferences'
import type { PersistentStorage } from '../../services/persistentStorage'
import { useStorageAskFlow } from './useStorageAskFlow'

function setup(persisted: boolean | undefined, options: { answer?: boolean | undefined; kept?: Record<string, string> } = {}) {
  const { kept = {} } = options
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
  const flow = useStorageAskFlow({ persistentStorage, devicePreferences, messages: () => en, showToast })
  return { flow, persistentStorage, kept, showToast }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useStorageAskFlow', () => {
  it('asks nothing until a file is saved: creating and drawing write the library, not a file', async () => {
    const { persistentStorage } = setup(false)
    await settle()
    expect(persistentStorage.persist).not.toHaveBeenCalled()
  })

  it('asks the browser at the first file, with no question first, and remembers it asked', async () => {
    const { flow, persistentStorage, kept } = setup(false)
    flow.onFileReached()
    await settle()
    expect(persistentStorage.persist).toHaveBeenCalledOnce()
    expect(kept['openbeads:storage-note-seen']).toBe('yes')
  })

  it('does not repeat: not on later files, and not on a later visit', async () => {
    const { flow, persistentStorage, kept } = setup(false)
    flow.onFileReached()
    await settle()
    flow.onFileReached()
    await settle()
    const later = setup(false, { kept })
    later.flow.onFileReached()
    await settle()
    expect(persistentStorage.persist).toHaveBeenCalledOnce()
    expect(later.persistentStorage.persist).not.toHaveBeenCalled()
  })

  it('asks nothing when the browser already keeps the library', async () => {
    const { flow, persistentStorage, showToast } = setup(true)
    flow.onFileReached()
    await settle()
    expect(flow.kept.value).toBe(true)
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('does nothing where the browser cannot say', async () => {
    const { flow, persistentStorage } = setup(undefined)
    expect(() => flow.onFileReached()).not.toThrow()
    await settle()
    expect(persistentStorage.persist).not.toHaveBeenCalled()
    expect(flow.kept.value).toBeUndefined()
  })

  it('says a yes once in a toast, and the state turns kept', async () => {
    const { flow, showToast } = setup(false, { answer: true })
    await settle()
    expect(flow.kept.value).toBe(false)
    flow.onFileReached()
    await settle()
    flow.onFileReached()
    await settle()
    expect(showToast).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith('storage-kept', 'This browser will keep your Projects.', 'success')
    expect(flow.kept.value).toBe(true)
  })

  it('says nothing on a no (ticket 0936): the Save reminder carries the advice, and the Menu row shows the answer', async () => {
    const { flow, showToast } = setup(false, { answer: false })
    flow.onFileReached()
    await settle()
    expect(showToast).not.toHaveBeenCalled()
    expect(flow.kept.value).toBe(false)
  })

  it('says nothing when the browser gives no answer', async () => {
    const { flow, showToast } = setup(false, { answer: undefined })
    flow.onFileReached()
    await settle()
    expect(showToast).not.toHaveBeenCalled()
    expect(flow.kept.value).toBe(false)
  })
})
