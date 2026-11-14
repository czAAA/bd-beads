import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import { createDevicePreferences, type PreferenceStorage } from './devicePreferences'
import { memoryServices } from './memoryServices'

/** A page's storage, as a map, and its preferences over it. */
function page(seed: Record<string, string> = {}) {
  const kept = new Map(Object.entries(seed))
  const storage: PreferenceStorage = {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => void kept.set(key, value),
    removeItem: (key) => void kept.delete(key),
  }
  return { kept, storage, preferences: createDevicePreferences(storage) }
}

const project = () => createProject({ name: 'Kaleidoscope', technique: 'loom', beadId: 'miyuki/delica/11-0' })

describe("memoryServices: the Homepage demo's own (ticket 0797)", () => {
  it('keeps its library in memory, starting from the Projects given', () => {
    const { kept, storage, preferences } = page()
    const start = project()
    const services = memoryServices([start], { page: preferences, pageStorage: () => storage })
    expect(services.libraryStore.load().map((each) => each.id)).toEqual([start.id])

    const another = project()
    services.libraryStore.save([start, another])
    expect(services.libraryStore.open(() => false).projects.map((each) => each.id)).toEqual([start.id, another.id])
    expect(kept.size).toBe(0)
  })

  it("shows the page's language and theme as they change, and keeps every choice made in it to itself", () => {
    const { kept, storage, preferences } = page({ 'openbeads:locale': 'ru' })
    const services = memoryServices([], { page: preferences, pageStorage: () => storage })
    expect(services.devicePreferences.get('locale').value).toBe('ru')
    preferences.get('locale').value = 'pl'
    expect(services.devicePreferences.get('locale').value).toBe('pl')

    const before = new Map(kept)
    services.devicePreferences.get('exportQuality').value = 'high'
    services.devicePreferences.get('rulers').value = true
    services.devicePreferences.get('recentColors').value = ['#ffffff']
    expect(kept).toEqual(before)
    expect(preferences.get('exportQuality').value).not.toBe('high')
  })

  it("starts from the device's ways of drawing and the preferences it is given, without changing the page's", () => {
    const { kept, storage, preferences } = page({ 'openbeads:handedness': 'left' })
    const services = memoryServices([], { page: preferences, pageStorage: () => storage, start: { toolPillPosition: 'top' } })
    expect(services.devicePreferences.get('handedness').value).toBe('left')
    expect(services.devicePreferences.get('toolPillPosition').value).toBe('top')
    services.devicePreferences.get('handedness').value = 'right'
    expect(kept.get('openbeads:handedness')).toBe('left')
  })

  it('keeps reference pictures in memory', async () => {
    const services = memoryServices([])
    const picture = new Blob(['x'], { type: 'image/png' })
    expect(await services.pictureStore.put('a', picture)).toBe(true)
    expect(await services.pictureStore.get('a')).toBe(picture)
    await services.pictureStore.keepOnly(new Set())
    expect(await services.pictureStore.get('a')).toBeUndefined()
  })
})
