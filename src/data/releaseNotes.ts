import type { Locale } from '../domain/locale'

/** One release note: the day a user-facing change shipped and its line in every shipped language. */
export interface ReleaseNote {
  /** The day it shipped, `YYYY-MM-DD`. */
  date: string
  line: Record<Locale, string>
}

// One file per note, `releaseNotes/YYYY-MM-DD-NNNN.json` (day shipped, ticket), so PRs that each add one never conflict
// (ticket 0917). Add a file when a user-facing change ships: its date and one short line in every language, the product's
// voice (writing.md), no full stop; releaseNotes.test.ts fails on a missing language or a name that isn't its date.
const FILES = import.meta.glob<ReleaseNote>('./releaseNotes/*.json', { eager: true, import: 'default' })

/** The app's release notes, newest first (by file name: day, then ticket); the Homepage's What's new tile shows the first three (ticket 0824). */
export const RELEASE_NOTES: readonly ReleaseNote[] = Object.keys(FILES)
  .sort()
  .reverse()
  .map((path) => FILES[path])
