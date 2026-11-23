import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OpenPing } from '../domain/appOpened'
import { countThisOpen, postPing, switchOpenCount, type OpenCountDeps, type OpenCountPlace } from './appOpened'
import { createDevicePreferences, type PreferenceStorage } from './devicePreferences'

function memoryStorage(seed: Record<string, string> = {}): PreferenceStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(seed))
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

const DAY_KEY = 'openbeads:opened-day'

/** One device: its storage, the pings it posted, and a start on a given day. */
function device(seed: Record<string, string> = {}, place: Partial<OpenCountPlace> = {}) {
  const storage = memoryStorage(seed)
  const preferences = createDevicePreferences(storage)
  const posted: OpenPing[] = []
  let answered = true
  const deps = (day: string): OpenCountDeps => ({
    preferences,
    place: { host: 'openbeads.com', privacyControl: false, automated: false, installed: false, ...place },
    version: '1.14.22',
    now: () => new Date(`${day}T15:00:00Z`),
    post: async (ping) => {
      posted.push(ping)
      return answered
    },
  })
  return {
    storage,
    preferences,
    posted,
    noAnswer: () => (answered = false),
    answer: () => (answered = true),
    start: (day: string) => countThisOpen(deps(day)),
  }
}

describe('countThisOpen', () => {
  it('sends a first open once, then nothing more that day', async () => {
    const phone = device()
    await phone.start('2026-11-23')
    await phone.start('2026-11-23')
    expect(phone.posted).toEqual([{ first: true, installed: false, version: '1.14.22' }])
    expect(phone.storage.items.get(DAY_KEY)).toBe('2026-11-23')
  })

  it.each([
    ['2026-11-22', '1'],
    ['2026-11-18', '2-7'],
    ['2026-11-01', '8-30'],
    ['2026-09-01', '31+'],
  ])('a device last counted on %s sends since %s', async (last, since) => {
    const tablet = device({ [DAY_KEY]: last }, { installed: true })
    await tablet.start('2026-11-23')
    expect(tablet.posted).toEqual([{ first: false, since, installed: true, version: '1.14.22' }])
  })

  it('reads a stored day that is no day as none, so the device counts as new', async () => {
    const odd = device({ [DAY_KEY]: 'garbage' })
    await odd.start('2026-11-23')
    expect(odd.posted[0]).toMatchObject({ first: true })
  })

  it('settles the day on any answer, and tries again at the next start when there was none', async () => {
    const laptop = device()
    laptop.noAnswer()
    await laptop.start('2026-11-23')
    expect(laptop.storage.items.has(DAY_KEY)).toBe(false)
    laptop.answer()
    await laptop.start('2026-11-23')
    await laptop.start('2026-11-23')
    expect(laptop.posted).toHaveLength(2)
    expect(laptop.posted[1]).toMatchObject({ first: true })
  })

  it.each([
    ['on localhost', { host: 'localhost' }],
    ['on a tailnet preview', { host: 'mac.tailnet.ts.net' }],
    ['when the browser sends Global Privacy Control', { privacyControl: true }],
    ['when automation drives the browser', { automated: true }],
  ])('sends nothing %s', async (_, place) => {
    const elsewhere = device({}, place)
    await elsewhere.start('2026-11-23')
    expect(elsewhere.posted).toEqual([])
    expect(elsewhere.storage.items.has(DAY_KEY)).toBe(false)
  })

  it('removes the day kept from before when the browser sends Global Privacy Control', async () => {
    const tablet = device({ [DAY_KEY]: '2026-11-20' }, { privacyControl: true })
    await tablet.start('2026-11-23')
    expect(tablet.posted).toEqual([])
    expect(tablet.storage.items.has(DAY_KEY)).toBe(false)
  })

  it('counts on dev.openbeads.com too', async () => {
    const dev = device({}, { host: 'dev.openbeads.com' })
    await dev.start('2026-11-23')
    expect(dev.posted).toHaveLength(1)
  })
})

describe('switchOpenCount', () => {
  it('off sends nothing, at this start or later, and removes the day kept', async () => {
    const tablet = device({ [DAY_KEY]: '2026-11-20' })
    switchOpenCount(tablet.preferences, false)
    expect(tablet.storage.items.has(DAY_KEY)).toBe(false)
    expect(tablet.storage.items.get('openbeads:count-opens')).toBe('off')
    await tablet.start('2026-11-23')
    await tablet.start('2026-11-24')
    expect(tablet.posted).toEqual([])
  })

  it('on again counts the device as new', async () => {
    const tablet = device({ [DAY_KEY]: '2026-11-20' })
    switchOpenCount(tablet.preferences, false)
    switchOpenCount(tablet.preferences, true)
    await tablet.start('2026-11-23')
    expect(tablet.posted).toEqual([{ first: true, installed: false, version: '1.14.22' }])
  })

  it('keeps no day for a ping that was out when the count was switched off', async () => {
    const storage = memoryStorage()
    const preferences = createDevicePreferences(storage)
    await countThisOpen({
      preferences,
      place: { host: 'openbeads.com', privacyControl: false, automated: false, installed: false },
      version: '1.14.22',
      now: () => new Date('2026-11-23T10:00:00Z'),
      post: async () => {
        switchOpenCount(preferences, false)
        return true
      },
    })
    expect(storage.items.has(DAY_KEY)).toBe(false)
  })
})

describe('postPing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the ping without credentials, and any answer counts as one', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const ping = { first: true, installed: false, version: '1.14.22' }
    expect(await postPing(ping, 'openbeads.com')).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/opened', expect.objectContaining({ method: 'POST', credentials: 'omit', body: JSON.stringify(ping) }))
  })

  it("sends dev's Access cookie, or Access answers the ping with its login page", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await postPing({ first: true, installed: false, version: '1.14.22' }, 'dev.openbeads.com')
    expect(fetch).toHaveBeenCalledWith('/api/opened', expect.objectContaining({ credentials: 'same-origin' }))
  })

  it('is no answer when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))))
    expect(await postPing({ first: true, installed: false, version: '1.14.22' }, 'openbeads.com')).toBe(false)
  })
})
