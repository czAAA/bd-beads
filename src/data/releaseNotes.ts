import type { Locale } from '../domain/locale'

/** What a Release note says happened (ticket 1045, ADR 0096): the maker can do something they couldn't, something works
 * differently on purpose, or something wrong now works as meant. The rules are in docs/agents/pull-requests.md. */
type ReleaseNoteKind = 'new' | 'changed' | 'fixed'

/** One release note: the day a user-facing change shipped, its kind, and its line in every shipped language. */
export interface ReleaseNote {
  /** The day it shipped, `YYYY-MM-DD`. */
  date: string
  /** Every note after 1.0.0 has one; the notes from before 1.0.0 have none. */
  kind?: ReleaseNoteKind
  line: Record<Locale, string>
}

// One file per note, `releaseNotes/YYYY-MM-DD-NNNN.json` (day shipped, ticket), so PRs that each add one never conflict
// (ticket 0917); the notes from before 1.0.0 sit apart in `releaseNotes/before-1.0.0/`, with no kind and no number
// (ticket 1045). The rules for a note are in docs/agents/pull-requests.md, Release notes; releaseNotes.test.ts checks them.
const FILES = import.meta.glob<ReleaseNote>(['./releaseNotes/*.json', './releaseNotes/before-1.0.0/*.json'], { eager: true, import: 'default' })

const fileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** The app's release notes, old and new alike, newest first (by file name: day, then ticket); the Homepage's What's new
 * tile shows the first three (ticket 0824) until it shows the notes by Version (ticket 1047). */
export const RELEASE_NOTES: readonly ReleaseNote[] = Object.keys(FILES)
  .sort((a, b) => fileName(a).localeCompare(fileName(b)))
  .reverse()
  .map((path) => FILES[path])
