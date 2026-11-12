import { describe, expect, it } from 'vitest'
import { LOCALES } from '../domain/locale'
import { RELEASE_NOTES, type ReleaseNote } from './releaseNotes'

const FILES = import.meta.glob<ReleaseNote>('./releaseNotes/*.json', { eager: true, import: 'default' })

describe('RELEASE_NOTES (tickets 0824, 0917)', () => {
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

  it('names each file for a real day, its note\'s date, and a four-digit ticket', () => {
    for (const [path, note] of Object.entries(FILES)) {
      const name = path.slice(path.lastIndexOf('/') + 1)
      expect(name, path).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
      const day = name.slice(0, 10)
      expect(new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10), path).toBe(day)
      expect(note.date, path).toBe(day)
    }
  })

  it('lists the notes newest first', () => {
    const days = RELEASE_NOTES.map((note) => note.date)
    expect(days).toEqual([...days].sort().reverse())
  })
})
