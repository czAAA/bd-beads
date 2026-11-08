import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReleaseNote } from '../data/releaseNotes'
import { whatsNew } from './whatsNew'

const note = (date: string, en: string): ReleaseNote => ({
  date,
  line: { en, ru: `ru ${en}`, uk: `uk ${en}`, be: `be ${en}`, zh: `zh ${en}`, es: `es ${en}`, pl: `pl ${en}` },
})
const NOTES = [note('2026-11-07', 'Newest'), note('2026-11-06', 'Second'), note('2026-11-05', 'Third'), note('2026-10-01', 'Older')]

describe('whatsNew (ticket 0824)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('gives the three newest notes, newest first, in the language shown', () => {
    expect(whatsNew('en', NOTES).map((shown) => shown.line)).toEqual(['Newest', 'Second', 'Third'])
    expect(whatsNew('ru', NOTES)[0].line).toBe('ru Newest')
  })

  it("dates each in the language's short form, the same day wherever the beader is", () => {
    expect(whatsNew('en', NOTES).map((shown) => shown.when)).toEqual(['Nov 7', 'Nov 6', 'Nov 5'])
    expect(whatsNew('ru', NOTES)[0].when).toBe('7 нояб.')
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(whatsNew('en', NOTES)[0].when, 'west of UTC').toBe('Nov 7')
  })

  it('gives every note when there are fewer than three', () => {
    expect(whatsNew('en', NOTES.slice(0, 2))).toHaveLength(2)
  })
})
