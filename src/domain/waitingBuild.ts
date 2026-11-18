import { newerFirst, readNotesFile, RELEASE_NOTE_KINDS, type NotesFileNote, type ReleaseNoteKind } from './notesFile'

/** The Build that waits for Reload (ticket 1048, spec 1043): its Version and its notes numbered above the page's. */
export interface WaitingBuild {
  version: string
  notes: NotesFileNote[]
}

/** What waits, as the page learns it from the waiting worker: the Build, or `unknown` when it couldn't be learned. */
export type WhatWaits = WaitingBuild | 'unknown'

/** What waits, from the waiting worker's answer (its notes file, parsed JSON) and the page's own Version: `unknown`
 * for no answer or one that can't be read, and null for a Build with the page's own Version, which raises no toast.
 * The worker knows nothing of Versions; this is where they are compared. */
export function whatWaits(answer: unknown, pageVersion: string): WhatWaits | null {
  const file = readNotesFile(answer)
  if (!file) return 'unknown'
  if (file.version === pageVersion) return null
  return { version: file.version, notes: file.notes.filter((note) => newerFirst(note.version, pageVersion) < 0) }
}

/** How many notes of a kind wait. */
interface KindCount {
  kind: ReleaseNoteKind
  count: number
}

/** One waiting note as the toast draws it: its kind label and line. */
interface UpdateNote {
  kind: ReleaseNoteKind
  line: string
}

/** How many waiting notes the toast's list holds at most (ticket 1091); the rest are on the Homepage's What's new. */
const UPDATE_LIST_LENGTH = 10

/** What "Update ready" says after its name: the waiting Version, then one note's kind and line, or a count per kind in
 * the order New, Changed, Fixed with a kind that has none left out. Neither for a Version with no note above the
 * page's; nothing at all when what waits is unknown (today's plain words). */
export interface UpdateSummary {
  version?: string
  note?: UpdateNote
  counts?: KindCount[]
  /** With counts, the list What's new opens (ticket 1091): the first notes in the counts' kind order, newest first. */
  list?: UpdateNote[]
  /** How many waiting notes the list leaves out; absent when it holds them all. */
  more?: number
}

/** The toast's summary of what waits (ticket 1048). */
export function updateSummary(waits: WhatWaits): UpdateSummary {
  if (waits === 'unknown') return {}
  const { version, notes } = waits
  if (notes.length === 0) return { version }
  if (notes.length === 1) return { version, note: { kind: notes[0].kind, line: notes[0].line } }
  const counts = RELEASE_NOTE_KINDS.map((kind) => ({ kind, count: notes.filter((note) => note.kind === kind).length })).filter((entry) => entry.count > 0)
  // The notes come newest first, so each kind keeps that order.
  const byKind = RELEASE_NOTE_KINDS.flatMap((kind) => notes.filter((note) => note.kind === kind)).map(({ kind, line }) => ({ kind, line }))
  const list = byKind.slice(0, UPDATE_LIST_LENGTH)
  const more = byKind.length - list.length
  return { version, counts, list, ...(more > 0 && { more }) }
}
