import { afterEach, describe, expect, it, vi } from 'vitest'
import { notesFromBase } from './notesFile'

const FILE = { version: '1.1.0', releases: [{ version: '1.0.0', date: '2026-11-17' }], notes: [] }

describe('notesFromBase (ticket 1047)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the language’s notes file under the base', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(FILE)))
    vi.stubGlobal('fetch', fetch)
    expect(await notesFromBase('/bd-beads/')('ru')).toEqual(FILE)
    expect(fetch).toHaveBeenCalledWith('/bd-beads/notes/ru.json')
  })

  it('answers null for a refused answer, no network, or a file it can’t read', async () => {
    for (const answer of [async () => new Response('', { status: 404 }), async () => Promise.reject(new TypeError('offline')), async () => new Response('<html>')]) {
      vi.stubGlobal('fetch', vi.fn(answer))
      expect(await notesFromBase('/')('en')).toBeNull()
    }
  })
})
