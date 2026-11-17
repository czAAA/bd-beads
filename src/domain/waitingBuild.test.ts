import { describe, expect, it } from 'vitest'
import type { NotesFileNote, ReleaseNoteKind } from './notesFile'
import { updateSummary, whatWaits } from './waitingBuild'

const note = (version: string, kind: ReleaseNoteKind, line = `line ${version}`): NotesFileNote => ({
  name: `2026-12-01-${version.replaceAll('.', '')}`,
  version,
  date: '2026-12-01',
  kind,
  line,
})
const fileOf = (version: string, notes: NotesFileNote[]) => ({ version, releases: [{ version: '2.0.0', date: '2026-11-30' }], notes })

describe('whatWaits', () => {
  it('is the waiting Version and its notes above the page\'s', () => {
    const answer = fileOf('2.2.0', [note('2.2.0', 'new'), note('2.1.4', 'fixed'), note('2.1.3', 'changed')])
    expect(whatWaits(answer, '2.1.3')).toEqual({ version: '2.2.0', notes: [note('2.2.0', 'new'), note('2.1.4', 'fixed')] })
  })

  it('raises nothing for a Build with the page\'s own Version', () => {
    expect(whatWaits(fileOf('2.1.3', [note('2.1.3', 'changed')]), '2.1.3')).toBeNull()
  })

  it('is a Version alone when no note is above the page\'s (a release commit on dev)', () => {
    expect(whatWaits(fileOf('3.0.0', [note('2.1.3', 'changed')]), '2.1.3')).toEqual({ version: '3.0.0', notes: [] })
  })

  it('is unknown with no answer, or one that is not a notes file', () => {
    expect(whatWaits(null, '2.1.3')).toBe('unknown')
    expect(whatWaits({ version: 'soon' }, '2.1.3')).toBe('unknown')
  })
})

describe('updateSummary', () => {
  it.each<ReleaseNoteKind>(['new', 'changed', 'fixed'])('names one waiting %s note by its kind and line', (kind) => {
    expect(updateSummary({ version: '2.2.0', notes: [note('2.2.0', kind, 'A line')] })).toEqual({ version: '2.2.0', note: { kind, line: 'A line' } })
  })

  it('counts several by kind, New, Changed, Fixed, leaving out a kind with none', () => {
    const notes = [note('2.1.7', 'fixed'), note('2.1.6', 'changed'), note('2.1.5', 'fixed'), note('2.1.4', 'fixed')]
    expect(updateSummary({ version: '2.1.7', notes })).toEqual({ version: '2.1.7', counts: [{ kind: 'changed', count: 1 }, { kind: 'fixed', count: 3 }] })
    const all = [note('2.3.1', 'fixed'), note('2.3.0', 'new'), note('2.2.1', 'changed')]
    expect(updateSummary({ version: '2.3.1', notes: all }).counts?.map((entry) => entry.kind)).toEqual(['new', 'changed', 'fixed'])
  })

  it('is the Version alone with no note, and nothing when what waits is unknown', () => {
    expect(updateSummary({ version: '3.0.0', notes: [] })).toEqual({ version: '3.0.0' })
    expect(updateSummary('unknown')).toEqual({})
  })
})
