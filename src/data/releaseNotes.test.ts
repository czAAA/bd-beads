import { describe, expect, it } from 'vitest'
import { LOCALES, type Locale } from '../domain/locale'
import type { ReleaseNoteKind } from '../domain/notesFile'
import RELEASE_RECORD from './releases.json'

/** One note's file (docs/agents/pull-requests.md, Release notes): the day it shipped, its kind (none before 1.0.0) and its
 * line in every shipped language. The app reads none: the build writes them into the notes files (ticket 1047). */
interface ReleaseNote {
  date: string
  kind?: ReleaseNoteKind
  line: Record<Locale, string>
}

// One file per note, `releaseNotes/YYYY-MM-DD-NNNN.json` (day shipped, ticket), so PRs that each add one never conflict
// (ticket 0917); the notes from before 1.0.0 sit apart in `releaseNotes/before-1.0.0/` (ticket 1045).
const NOTES = import.meta.glob<ReleaseNote>('./releaseNotes/*.json', { eager: true, import: 'default' })
const BEFORE_1_0_0 = import.meta.glob<ReleaseNote>('./releaseNotes/before-1.0.0/*.json', { eager: true, import: 'default' })
const RELEASE_NOTES = Object.values({ ...NOTES, ...BEFORE_1_0_0 })
const KINDS = ['new', 'changed', 'fixed']

interface RecordedRelease {
  version: string
  date: string
  notes: { name: string; version: string; kind: string }[]
}

const RELEASES = RELEASE_RECORD as RecordedRelease[]

const byName = (files: Record<string, ReleaseNote>): Map<string, ReleaseNote> =>
  new Map(Object.entries(files).map(([path, note]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), note]))

/** What is wrong with the notes since 1.0.0 against the release record (ticket 1045): a note with no kind, or a released
 * note that is gone or has another kind than the record's. */
function problems(notes: Map<string, ReleaseNote>, record: readonly RecordedRelease[]): string[] {
  const found: string[] = []
  for (const [name, note] of notes) if (!KINDS.includes(note.kind ?? '')) found.push(`${name} has no kind`)
  for (const released of record.flatMap((release) => release.notes)) {
    const note = notes.get(released.name)
    if (!note) found.push(`${released.name} is released but gone`)
    else if (note.kind !== released.kind) found.push(`${released.name} is ${note.kind}, released as ${released.kind}`)
  }
  return found
}

describe('the Release notes (tickets 0824, 0917, 1045)', () => {
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
    for (const [path, note] of Object.entries({ ...NOTES, ...BEFORE_1_0_0 })) {
      const name = path.slice(path.lastIndexOf('/') + 1)
      expect(name, path).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
      const day = name.slice(0, 10)
      expect(new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10), path).toBe(day)
      expect(note.date, path).toBe(day)
    }
  })

  it('gives every note since 1.0.0 a kind, and keeps every released note with the kind the release record holds', () => {
    expect(problems(byName(NOTES), RELEASES)).toEqual([])
  })

  it('needs no kind on the notes from before 1.0.0, which no release lists', () => {
    const released = new Set(RELEASES.flatMap((release) => release.notes.map((note) => note.name)))
    for (const [name, note] of byName(BEFORE_1_0_0)) {
      expect(note.kind, name).toBeUndefined()
      expect(released.has(name), name).toBe(false)
    }
  })

  it('starts the release record at 1.0.0', () => {
    expect(RELEASES[0]).toMatchObject({ version: '1.0.0', notes: [] })
  })
})

describe('the check over the notes and the release record (ticket 1045)', () => {
  const line = Object.fromEntries(LOCALES.map((locale) => [locale, 'A line'])) as ReleaseNote['line']
  const note = (kind?: ReleaseNote['kind']): ReleaseNote => ({ date: '2026-11-18', kind, line })
  const record: RecordedRelease[] = [{ version: '2.0.0', date: '2026-11-20', notes: [{ name: '2026-11-18-0001', version: '1.1.0', kind: 'new' }] }]

  it('refuses a note with no kind', () => {
    expect(problems(new Map([['2026-11-18-0002', note()]]), [])).toEqual(['2026-11-18-0002 has no kind'])
  })

  it('refuses a released note that is gone, or there with another kind', () => {
    expect(problems(new Map(), record)).toEqual(['2026-11-18-0001 is released but gone'])
    expect(problems(new Map([['2026-11-18-0001', note('changed')]]), record)).toEqual(['2026-11-18-0001 is changed, released as new'])
    expect(problems(new Map([['2026-11-18-0001', note('new')]]), record)).toEqual([])
  })
})
