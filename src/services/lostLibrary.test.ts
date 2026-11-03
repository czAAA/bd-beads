import { describe, expect, it } from 'vitest'
import { findLostLibrary } from './lostLibrary'

const NOW = new Date('2026-11-03T10:00:00Z')

function storageWith(values: Record<string, string>) {
  return { getItem: (key: string) => values[key] ?? null }
}

describe('findLostLibrary', () => {
  it('finds nothing, and packs no file, in a browser with no copy of the library', () => {
    expect(findLostLibrary(storageWith({ 'openbeads:locale': 'en' }), 'https://dev.openbeads.com', NOW)).toEqual({ copies: [], file: undefined })
  })

  it('lists an emptied library but packs no file, as there is nothing in it to hand over', () => {
    const found = findLostLibrary(storageWith({ 'openbeads:patterns': '{"version":6,"patterns":[]}' }), 'https://dev.openbeads.com', NOW)

    expect(found).toEqual({ copies: [{ key: 'openbeads:patterns', names: [] }], file: undefined })
  })

  it('names the Projects of every copy, current format or older, and marks one it cannot read', () => {
    const found = findLostLibrary(
      storageWith({
        'openbeads:patterns': JSON.stringify({ version: 6, patterns: [{ layers: [{ name: 'Rose' }] }, { layers: [{ name: 'Fox' }] }] }),
        'openbeads:patterns:unreadable': '{"version":99,',
        'bd-beads:patterns': JSON.stringify([{ name: 'Old bracelet' }]),
      }),
      'https://dev.openbeads.com',
      NOW,
    )

    expect(found.copies).toEqual([
      { key: 'openbeads:patterns', names: ['Rose', 'Fox'] },
      { key: 'openbeads:patterns:unreadable', names: undefined },
      { key: 'bd-beads:patterns', names: ['Old bracelet'] },
    ])
  })

  it('packs every copy raw, with where and when it was found, so it can be put back by hand', () => {
    const library = JSON.stringify({ version: 6, patterns: [{ layers: [{ name: 'Rose' }] }] })
    const found = findLostLibrary(storageWith({ 'openbeads:patterns': library, 'openbeads:patterns:unreadable': 'garbled' }), 'https://dev.openbeads.com', NOW)

    expect(JSON.parse(found.file!)).toEqual({
      origin: 'https://dev.openbeads.com',
      savedAt: '2026-11-03T10:00:00.000Z',
      keys: { 'openbeads:patterns': library, 'openbeads:patterns:unreadable': 'garbled' },
    })
  })
})
