import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NotesFile, NotesFileNote, ReleaseNoteKind } from '../domain/notesFile'
import { shownDay, whatsNewView, type WhatsNewView } from './whatsNew'

type WhatsNewItem = WhatsNewView['items'][number]
type WhatsNewBlock = NonNullable<WhatsNewView['waiting']>

let ticket = 0
const note = (version: string, kind: ReleaseNoteKind, date: string): NotesFileNote => {
  ticket += 1
  return { name: `${date}-${String(ticket).padStart(4, '0')}`, version, date, kind, line: `${kind} ${version}` }
}
const file = (notes: NotesFileNote[], releases = [{ version: '1.0.0', date: '2026-11-17' }]): NotesFile => ({ version: notes[0]?.version ?? '1.0.0', releases, notes })

/** An item as a line a reader can compare: a block's heading, or a release line. */
const heading = (item: WhatsNewItem) => ('block' in item ? `${item.block.version} · ${item.block.day.when}` : `Release ${item.release.version} · ${item.release.day.when}`)
const rows = (block: WhatsNewBlock) => block.rows.map((row) => `${row.nextKind ? '| ' : ''}${row.kind} ${row.line.split(' ')[1]}`)
const blocks = (items: WhatsNewItem[]) => items.flatMap((item) => ('block' in item ? [item.block] : []))

describe('whatsNewView (ticket 1047, spec 1043)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('makes a block per second number, newest first, headed by its highest Version and its newest note’s day', () => {
    const view = whatsNewView(file([note('1.2.1', 'fixed', '2026-11-20'), note('1.2.0', 'new', '2026-11-21'), note('1.1.0', 'new', '2026-11-18')]), [], 'en')
    expect(view.items.map(heading)).toEqual(['1.2.1 · Nov 21', '1.1.0 · Nov 18', 'Release 1.0.0 · Nov 17'])
  })

  it('groups a block’s rows New, Changed, Fixed, newest first in each kind, with a gap where the kind changes', () => {
    const notes = [note('1.1.4', 'fixed', '2026-11-20'), note('1.1.3', 'changed', '2026-11-20'), note('1.1.2', 'fixed', '2026-11-19'), note('1.1.1', 'changed', '2026-11-19'), note('1.1.0', 'new', '2026-11-18')]
    const [first] = blocks(whatsNewView(file(notes), [], 'en').items)
    expect(rows(first)).toEqual(['new 1.1.0', '| changed 1.1.3', 'changed 1.1.1', '| fixed 1.1.4', 'fixed 1.1.2'])
  })

  it('draws a block of one New row as one row with no gap', () => {
    const [only] = blocks(whatsNewView(file([note('1.1.0', 'new', '2026-11-18')]), [], 'en').items)
    expect(rows(only)).toEqual(['new 1.1.0'])
  })

  it('puts each release’s line above the blocks it released, and the older release’s line last', () => {
    const notes = [note('2.1.3', 'fixed', '2026-12-04'), note('2.1.0', 'new', '2026-12-03'), note('1.2.0', 'new', '2026-11-28'), note('1.1.13', 'fixed', '2026-11-27')]
    const releases = [{ version: '1.0.0', date: '2026-11-20' }, { version: '2.0.0', date: '2026-12-01' }]
    expect(whatsNewView(file(notes, releases), [], 'en').items.map(heading)).toEqual([
      '2.1.3 · Dec 4',
      'Release 2.0.0 · Dec 1',
      '1.2.0 · Nov 28',
      '1.1.13 · Nov 27',
      'Release 1.0.0 · Nov 20',
    ])
  })

  it('shows only the release lines when no note followed them', () => {
    expect(whatsNewView(file([]), [], 'en').items.map(heading)).toEqual(['Release 1.0.0 · Nov 17'])
  })

  it('makes what waits one block of its own, whatever its numbers, and none when nothing waits', () => {
    const page = file([note('1.1.0', 'new', '2026-11-18')])
    expect(whatsNewView(page, [], 'en').waiting).toBeNull()
    const waiting = whatsNewView(page, [note('1.2.1', 'fixed', '2026-11-20'), note('1.2.0', 'new', '2026-11-19'), note('1.1.1', 'changed', '2026-11-19')], 'en').waiting!
    expect(`${waiting.version} · ${waiting.day.when}`).toBe('1.2.1 · Nov 20')
    expect(rows(waiting)).toEqual(['new 1.2.0', '| changed 1.1.1', '| fixed 1.2.1'])
  })

  it("writes each day in the language's short form, the same day wherever the beader is", () => {
    expect(shownDay('2026-12-04', 'en').when).toBe('Dec 4')
    expect(shownDay('2026-12-04', 'ru').when).toBe('4 дек.')
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(shownDay('2026-12-04', 'en').when, 'west of UTC').toBe('Dec 4')
  })
})
