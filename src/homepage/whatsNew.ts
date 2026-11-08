import { RELEASE_NOTES, type ReleaseNote } from '../data/releaseNotes'
import type { Locale } from '../domain/locale'

/** A release note as the What's new tile shows it: its day (for `<time>`), that day written short, and its line. */
export interface ShownNote {
  date: string
  when: string
  line: string
}

const SHOWN = 3

/** The newest release notes in a language, newest first, each dated in the language's short form ("Nov 7", "7 нояб.";
 * writing.md, dates). The day is read and written in UTC, so it is the day shipped wherever the beader is. */
export function whatsNew(locale: Locale, notes: readonly ReleaseNote[] = RELEASE_NOTES): ShownNote[] {
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return notes.slice(0, SHOWN).map((note) => ({
    date: note.date,
    when: format.format(new Date(`${note.date}T00:00:00Z`)),
    line: note.line[locale],
  }))
}
