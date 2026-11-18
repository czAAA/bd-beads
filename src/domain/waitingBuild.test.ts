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
    const summary = updateSummary({ version: '2.1.7', notes })
    expect(summary.version).toBe('2.1.7')
    expect(summary.counts).toEqual([{ kind: 'changed', count: 1 }, { kind: 'fixed', count: 3 }])
    expect(summary.note).toBeUndefined()
    const all = [note('2.3.1', 'fixed'), note('2.3.0', 'new'), note('2.2.1', 'changed')]
    expect(updateSummary({ version: '2.3.1', notes: all }).counts?.map((entry) => entry.kind)).toEqual(['new', 'changed', 'fixed'])
  })

  it('is the Version alone with no note, and nothing when what waits is unknown', () => {
    expect(updateSummary({ version: '3.0.0', notes: [] })).toEqual({ version: '3.0.0' })
    expect(updateSummary('unknown')).toEqual({})
  })

  it('lists several New, then Changed, then Fixed, newest first inside a kind, with nothing more to see (ticket 1091)', () => {
    const notes = [note('2.1.7', 'fixed', 'f7'), note('2.1.6', 'changed', 'c6'), note('2.1.5', 'new', 'n5'), note('2.1.4', 'fixed', 'f4'), note('2.1.3', 'new', 'n3')]
    const summary = updateSummary({ version: '2.1.7', notes })
    expect(summary.list?.map((entry) => `${entry.kind} ${entry.line}`)).toEqual(['new n5', 'new n3', 'changed c6', 'fixed f7', 'fixed f4'])
    expect(summary.more).toBeUndefined()
  })

  it('lists the first 10 and counts the rest, while the counts keep counting every note (ticket 1091)', () => {
    const versions = Array.from({ length: 27 }, (_, index) => `2.0.${30 - index}`)
    const kinds: ReleaseNoteKind[] = ['changed', 'new', 'fixed']
    const notes = versions.map((version, index) => note(version, kinds[index % 3], version))
    const summary = updateSummary({ version: '2.0.30', notes })
    expect(summary.list).toHaveLength(10)
    expect(summary.list?.map((entry) => entry.kind)).toEqual([...Array(9).fill('new'), 'changed'])
    expect(summary.list?.[0].line).toBe('2.0.29')
    expect(summary.list?.[9].line).toBe('2.0.30')
    expect(summary.more).toBe(17)
    expect(summary.counts?.reduce((sum, entry) => sum + entry.count, 0)).toBe(27)
  })

  it('has no list with one note, no note, or what waits unknown (ticket 1091)', () => {
    expect(updateSummary({ version: '2.2.0', notes: [note('2.2.0', 'new')] }).list).toBeUndefined()
    expect(updateSummary({ version: '3.0.0', notes: [] }).list).toBeUndefined()
    expect(updateSummary('unknown').list).toBeUndefined()
  })

  it('has nothing more to see with exactly 10 waiting (ticket 1091)', () => {
    const notes = Array.from({ length: 10 }, (_, index) => note(`2.0.${index}`, 'fixed'))
    const summary = updateSummary({ version: '2.0.9', notes })
    expect(summary.list).toHaveLength(10)
    expect(summary.more).toBeUndefined()
  })
})
