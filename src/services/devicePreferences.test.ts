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
  { name: 'rulers', key: 'openbeads:rulers', saved: 'off', read: false, other: false, stored: 'off', invalid: null, fallback: true },
  { name: 'rowHighlight', key: 'openbeads:row-highlight', saved: 'off', read: false, other: true, stored: 'on', invalid: null, fallback: true },
  { name: 'canvasBackground', key: 'openbeads:canvas-background-2', saved: '5', read: 5, other: 3, stored: '3', invalid: '6', fallback: 1 },
  { name: 'canvasBackground', key: 'openbeads:canvas-background-2', saved: 'custom', read: 'custom', other: 'custom', stored: 'custom', invalid: 'mine', fallback: 1 },
  { name: 'canvasCustomColor', key: 'openbeads:canvas-custom-color', saved: '#7A2E8C', read: '#7a2e8c', other: '#14213d', stored: '#14213d', invalid: 'purple', fallback: undefined },
  { name: 'inputMode', key: 'openbeads:input-mode', saved: 'pen', read: 'pen', other: 'mouse', stored: 'mouse', invalid: 'finger', fallback: undefined },
  { name: 'handedness', key: 'openbeads:handedness', saved: 'left', read: 'left', other: 'left', stored: 'left', invalid: 'both', fallback: 'right' },
  { name: 'penSeen', key: 'openbeads:pen-seen', saved: 'yes', read: true, other: true, stored: 'yes', invalid: 'no', fallback: false },
  { name: 'theme', key: 'openbeads:theme', saved: 'contrast', read: 'contrast', other: 'dark', stored: 'dark', invalid: 'sepia', fallback: 'device' },
  { name: 'toolPillPosition', key: 'openbeads:tool-pill-position', saved: 'left', read: 'left', other: 'right', stored: 'right', invalid: 'middle', fallback: 'bottom' },
  { name: 'locale', key: 'openbeads:locale', saved: 'ru', read: 'ru', other: 'en', stored: 'en', invalid: 'fr', fallback: 'en' },
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

describe('the recent colors preference (ticket 439)', () => {
  it('reads only valid colours, newest first, at most eight', () => {
    const saved = '#111111,red,#222222,#333333,#444444,#555555,#666666,#777777,#888888,#999999'
    expect(createDevicePreferences(memory({ 'openbeads:recent-colors': saved })).get('recentColors').value).toEqual([
      '#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777', '#888888',
    ])
  })

  it('is forgotten when emptied, and saved as a comma list otherwise', () => {
    const storage = memory()
    const recents = createDevicePreferences(storage).get('recentColors')
    recents.value = ['#111111', '#222222']
    expect(storage.data.get('openbeads:recent-colors')).toBe('#111111,#222222')
    recents.value = []
    expect(storage.data.has('openbeads:recent-colors')).toBe(false)
  })
})

describe('the device preferences', () => {
  it('hands every reader of a preference the same value', () => {
    const preferences = createDevicePreferences(memory())
    preferences.get('rulers').value = false
    expect(preferences.get('rulers').value).toBe(false)
  })

  it('forgets the saved theme for Match device', () => {
    const storage = memory({ 'openbeads:theme': 'dark' })
    createDevicePreferences(storage).get('theme').value = 'device'
    expect(storage.data.has('openbeads:theme')).toBe(false)
  })

  it('forgets the saved Tool pill edge when it is moved back to the bottom', () => {
    const storage = memory({ 'openbeads:tool-pill-position': 'right' })
    createDevicePreferences(storage).get('toolPillPosition').value = 'bottom'
    expect(storage.data.has('openbeads:tool-pill-position')).toBe(false)
  })
})

describe('the canvas background preference, from the first list (ticket 554)', () => {
  const earlier = 'openbeads:canvas-background'

  it.each([
    ['dark', '6', 4],
    ['dark', '4', 1],
    ['dark', '3', 3],
    ['light', '4', 4],
    ['light', '3', 1],
  ] as const)('reads a %s choice %s as %i, moved by name, and keeps it under the new key', (theme, saved, moved) => {
    const storage = memory({ 'openbeads:theme': theme, [earlier]: saved })
    expect(createDevicePreferences(storage).get('canvasBackground').value).toBe(moved)
    expect(storage.data.get('openbeads:canvas-background-2')).toBe(String(moved))
    expect(storage.data.get(earlier)).toBe(saved)
  })

  it('prefers the new key once there is one', () => {
    const storage = memory({ [earlier]: '6', 'openbeads:canvas-background-2': '2', 'openbeads:theme': 'dark' })
    expect(createDevicePreferences(storage).get('canvasBackground').value).toBe(2)
  })
})
