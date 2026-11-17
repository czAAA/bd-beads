import type { Locale } from '../domain/locale'
import { newerFirst, RELEASE_NOTE_KINDS, type NotesFile, type NotesFileNote, type ReleaseNoteKind } from '../domain/notesFile'

/** A day as What's new writes it: for `<time>`, and in the language's short form ("Dec 4", "4 дек."; writing.md, dates). */
export interface ShownDay {
  date: string
  when: string
}

/** One row of a block: its kind, its line, and whether it is the first of its kind after another (a gap above it). */
interface WhatsNewRow {
  name: string
  kind: ReleaseNoteKind
  line: string
  nextKind: boolean
}

/** The notes that share a first and second number (spec 1043): headed by the highest Version and the newest note's day. */
interface WhatsNewBlock {
  version: string
  day: ShownDay
  rows: WhatsNewRow[]
}

/** What the open fold draws, top to bottom: blocks newest first, each Production release's line above what it released. */
type WhatsNewItem = { block: WhatsNewBlock } | { release: { version: string; day: ShownDay } }

/** The open fold: what waits for Reload as one block (ticket 1049 draws it), then the blocks and release lines. */
export interface WhatsNewView {
  waiting: WhatsNewBlock | null
  items: WhatsNewItem[]
}

/** A day in `locale`'s short form, read and written in UTC, so it is the day shipped wherever the beader is. */
export function shownDay(date: string, locale: Locale): ShownDay {
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return { date, when: format.format(new Date(`${date}T00:00:00Z`)) }
}

/** Notes as one block: grouped New, Changed, Fixed, each kind newest first. */
function block(notes: readonly NotesFileNote[], locale: Locale): WhatsNewBlock {
  const sorted = [...notes].sort(
    (a, b) => RELEASE_NOTE_KINDS.indexOf(a.kind) - RELEASE_NOTE_KINDS.indexOf(b.kind) || newerFirst(a.version, b.version) || b.name.localeCompare(a.name),
  )
  const version = [...notes].sort((a, b) => newerFirst(a.version, b.version))[0].version
  const newest = notes.map((note) => note.date).sort().at(-1)!
  return {
    version,
    day: shownDay(newest, locale),
    rows: sorted.map((note, i) => ({ name: note.name, kind: note.kind, line: note.line, nextKind: i > 0 && sorted[i - 1].kind !== note.kind })),
  }
}

const blockOf = (version: string) => version.split('.').slice(0, 2).join('.')

/** What's new from the notes file of the language shown (ticket 1047, spec 1043) and what waits for Reload (ticket
 * 1049; none until then): a block per second number, newest first, and above the blocks each release released, its
 * line. A release line sits above every block numbered below it. */
export function whatsNewView(file: NotesFile, waiting: readonly NotesFileNote[], locale: Locale): WhatsNewView {
  const byBlock = new Map<string, NotesFileNote[]>()
  for (const note of [...file.notes].sort((a, b) => newerFirst(a.version, b.version))) {
    byBlock.set(blockOf(note.version), [...(byBlock.get(blockOf(note.version)) ?? []), note])
  }
  const releases = [...file.releases].sort((a, b) => newerFirst(a.version, b.version))
  const items: WhatsNewItem[] = []
  const releaseLine = () => {
    const release = releases.shift()!
    items.push({ release: { version: release.version, day: shownDay(release.date, locale) } })
  }
  for (const notes of byBlock.values()) {
    const shown = block(notes, locale)
    while (releases.length > 0 && newerFirst(releases[0].version, shown.version) < 0) releaseLine()
    items.push({ block: shown })
  }
  while (releases.length > 0) releaseLine()
  return { waiting: waiting.length > 0 ? block(waiting, locale) : null, items }
}
