import { describe, expect, it } from 'vitest'
import { LOCALES } from '../domain/locale'
import { RELEASE_NOTES } from './releaseNotes'

describe('RELEASE_NOTES (ticket 0824)', () => {
  it('holds at least the three the What\'s new tile shows', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThanOrEqual(3)
  })

  it('has every note in every shipped language, one short line with no full stop', () => {
    for (const note of RELEASE_NOTES) {
      for (const locale of LOCALES) {
        const line = note.line[locale]
        expect(line.trim(), `${note.date} in ${locale}`).toBe(line)
        expect(line.length, `${note.date} in ${locale}`).toBeGreaterThan(0)
        expect(line, `${note.date} in ${locale}`).not.toMatch(/[.。]$|\n|—/)
      }
    }
  })

  it('dates each note with a real day, newest first', () => {
    const days = RELEASE_NOTES.map((note) => note.date)
    for (const day of days) expect(new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10), day).toBe(day)
    expect(days).toEqual([...days].sort().reverse())
  })
})
