import { describe, expect, it } from 'vitest'
import { createDevicePreferences, PREFERENCES, type PreferenceName, type PreferenceStorage } from './devicePreferences'

function memory(initial: Record<string, string> = {}): PreferenceStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const blocked: PreferenceStorage = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
  removeItem: () => { throw new Error('blocked') },
}

/** Each preference: its long-standing key, a saved value that must still read, one that is not valid, and what it is by default. */
const CASES = [
  { name: 'rulers', key: 'bd-beads:rulers', saved: 'off', read: false, other: false, stored: 'off', invalid: null, fallback: true },
  { name: 'zoomPillPlacement', key: 'bd-beads:zoom-pill', saved: 'top-left', read: { x: 0, y: 0 }, other: { x: 0.25, y: 0.5 }, stored: '0.25,0.5', invalid: 'middle', fallback: { x: 1, y: 1 } },
  { name: 'canvasBackground', key: 'bd-beads:canvas-background', saved: '6', read: 6, other: 3, stored: '3', invalid: '7', fallback: 1 },
  { name: 'inputMode', key: 'bd-beads:input-mode', saved: 'pen', read: 'pen', other: 'mouse', stored: 'mouse', invalid: 'finger', fallback: undefined },
  { name: 'penSeen', key: 'bd-beads:pen-seen', saved: 'yes', read: true, other: true, stored: 'yes', invalid: 'no', fallback: false },
  { name: 'theme', key: 'bd-beads:theme', saved: 'contrast', read: 'contrast', other: 'dark', stored: 'dark', invalid: 'sepia', fallback: 'device' },
  { name: 'locale', key: 'bd-beads:locale', saved: 'ru', read: 'ru', other: 'en', stored: 'en', invalid: 'fr', fallback: 'en' },
] as const satisfies readonly { name: PreferenceName; [k: string]: unknown }[]

describe.each(CASES)('the $name preference', ({ name, key, saved, read, other, stored, invalid, fallback }) => {
  it('keeps its long-standing storage key', () => {
    expect(PREFERENCES[name].key).toBe(key)
  })

  it('is its default when nothing is saved', () => {
    expect(createDevicePreferences(memory()).get(name).value).toEqual(fallback)
  })

  it('reads what an earlier visit saved under the old key', () => {
    expect(createDevicePreferences(memory({ [key]: saved })).get(name).value).toEqual(read)
  })

  it('is its default when the saved value is not valid', () => {
    if (invalid === null) return // anything but "off" means on, so there is no invalid value
    expect(createDevicePreferences(memory({ [key]: invalid })).get(name).value).toEqual(fallback)
  })

  it('is its default, without crashing, when storage throws', () => {
    const preferences = createDevicePreferences(blocked)
    expect(preferences.get(name).value).toEqual(fallback)
    expect(() => {
      // @ts-expect-error the table holds a valid value for each name; the union is too wide for the setter
      preferences.get(name).value = other
    }).not.toThrow()
    expect(preferences.get(name).value).toEqual(other)
  })

  it('saves on change, in the stored format', () => {
    const storage = memory()
    const preference = createDevicePreferences(storage).get(name)
    // @ts-expect-error see above
    preference.value = other
    expect(storage.data.get(key)).toBe(stored)
    expect(createDevicePreferences(storage).get(name).value).toEqual(other)
  })
})

describe('the device preferences', () => {
  it('hands every reader of a preference the same value', () => {
    const preferences = createDevicePreferences(memory())
    preferences.get('rulers').value = false
    expect(preferences.get('rulers').value).toBe(false)
  })

  it('forgets the saved theme for Match device', () => {
    const storage = memory({ 'bd-beads:theme': 'dark' })
    createDevicePreferences(storage).get('theme').value = 'device'
    expect(storage.data.has('bd-beads:theme')).toBe(false)
  })
})
