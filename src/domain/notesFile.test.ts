import { describe, expect, it } from 'vitest'
import { newerFirst, readNotesFile, type NotesFile } from './notesFile'

const FILE: NotesFile = {
  version: '1.1.0',
  releases: [{ version: '1.0.0', date: '2026-11-17' }],
  notes: [{ name: '2026-11-17-1047', version: '1.1.0', date: '2026-11-17', kind: 'new', line: 'What’s new lists every change' }],
}

describe('readNotesFile (ticket 1047)', () => {
  it('reads a notes file as written', () => {
    expect(readNotesFile(JSON.parse(JSON.stringify(FILE)))).toEqual(FILE)
  })

  it('refuses what isn’t one, so What’s new shows only Every change', () => {
    for (const broken of [null, 'text', [], { ...FILE, version: 'v1' }, { ...FILE, releases: {} }, { ...FILE, notes: [{ ...FILE.notes[0], kind: 'big' }] }, { ...FILE, notes: [{ ...FILE.notes[0], date: 'today' }] }]) {
      expect(readNotesFile(broken), JSON.stringify(broken)).toBeNull()
    }
  })
})

describe('newerFirst', () => {
  it('orders Versions by number, not by text', () => {
    expect(['1.1.9', '1.10.0', '2.0.0', '1.1.10'].sort(newerFirst)).toEqual(['2.0.0', '1.10.0', '1.1.10', '1.1.9'])
  })
})
