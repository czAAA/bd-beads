/** What a Release note says happened (ticket 1045, ADR 0096): the maker can do something new, something works
 * differently on purpose, or something wrong now works as meant. The rules are in docs/agents/pull-requests.md. */
export type ReleaseNoteKind = 'new' | 'changed' | 'fixed'

/** The kinds in the order What's new and "Update ready" list them (spec 1043): the biggest first. */
export const RELEASE_NOTE_KINDS: readonly ReleaseNoteKind[] = ['new', 'changed', 'fixed']

/** One Release note as a notes file holds it: its file name (day and ticket), Version, day, kind and line. */
export interface NotesFileNote {
  name: string
  version: string
  /** The day it shipped, `YYYY-MM-DD`. */
  date: string
  kind: ReleaseNoteKind
  line: string
}

/** A Production release as a notes file names it: its Version and the day it was made. */
interface NotesFileRelease {
  version: string
  date: string
}

/** One language's notes file (ticket 1047, spec 1043), which the build writes beside the app as `notes/<locale>.json`:
 * the Build's Version, the last two Production releases (oldest first) and every note of the blocks since the older,
 * newest first. The Homepage reads it when What's new opens; ticket 1048's waiting worker answers with it. */
export interface NotesFile {
  version: string
  releases: NotesFileRelease[]
  notes: NotesFileNote[]
}

/** Where a language's notes file is served, from the app's base: `notes/en.json`, the same name in every Build. */
export const notesFilePath = (locale: string): string => `notes/${locale}.json`

const VERSION = /^\d+\.\d+\.\d+$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isText = (value: unknown, pattern?: RegExp): value is string => typeof value === 'string' && (!pattern || pattern.test(value))

function isNote(value: unknown): value is NotesFileNote {
  return (
    isRecord(value) &&
    isText(value.name) &&
    isText(value.version, VERSION) &&
    isText(value.date, DAY) &&
    RELEASE_NOTE_KINDS.includes(value.kind as ReleaseNoteKind) &&
    isText(value.line)
  )
}

const isRelease = (value: unknown): value is NotesFileRelease => isRecord(value) && isText(value.version, VERSION) && isText(value.date, DAY)

/** The notes file in `data` (parsed JSON), or null when it isn't one: What's new then shows only Every change. */
export function readNotesFile(data: unknown): NotesFile | null {
  if (!isRecord(data) || !isText(data.version, VERSION)) return null
  const { releases, notes } = data
  if (!Array.isArray(releases) || !releases.every(isRelease) || !Array.isArray(notes) || !notes.every(isNote)) return null
  return { version: data.version, releases, notes }
}

/** Orders two Versions newest first: negative when `a` is the higher. */
export function newerFirst(a: string, b: string): number {
  const [x, y] = [a, b].map((version) => version.split('.').map(Number))
  return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]
}
