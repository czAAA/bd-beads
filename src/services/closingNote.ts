// The closing note (ADR 0012, spec 1018): one localStorage key shared by the tabs. A write to IndexedDB started as the page
// hides may not land, a localStorage write always does, so each write not yet landed is noted here, and the next start
// writes what the note holds before the library loads.

/** @internal Tests read the note under its key. */
export const CLOSING_NOTE_KEY = 'openbeads:closing-note'

/** A Project whose write had not landed: its stored JSON and its last-save time. */
export interface NotedProject {
  stored: string
  at: number
}

/** Everything the note holds: the Projects not yet written and the removals not yet applied. */
export interface ClosingNote {
  projects: Record<string, NotedProject>
  /** The ids whose removal had not landed. */
  removed: string[]
}

type NoteStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The note as stored; an empty one when there is none or it can't be read. */
export function readNote(storage: NoteStorage): ClosingNote {
  const empty: ClosingNote = { projects: {}, removed: [] }
  try {
    const raw = storage.getItem(CLOSING_NOTE_KEY)
    if (raw === null) return empty
    const parsed = JSON.parse(raw) as Partial<ClosingNote> | null
    const projects: Record<string, NotedProject> = {}
    for (const [id, entry] of Object.entries(parsed?.projects ?? {})) {
      if (typeof entry?.stored === 'string' && typeof entry.at === 'number') projects[id] = entry
    }
    return { projects, removed: Array.isArray(parsed?.removed) ? parsed.removed.filter((id): id is string => typeof id === 'string') : [] }
  } catch {
    return empty
  }
}

function writeNote(storage: NoteStorage, note: ClosingNote): void {
  if (Object.keys(note.projects).length === 0 && note.removed.length === 0) storage.removeItem(CLOSING_NOTE_KEY)
  else storage.setItem(CLOSING_NOTE_KEY, JSON.stringify(note))
}

/** What a tab has under way. */
export interface NoteEntries {
  projects: Record<string, NotedProject>
  removed: readonly string[]
}

/** Merges this tab's entries into the note, a Project at a time, so one too large for the note (the browser refuses the
 * write) is left to the write already started and the others are still noted. The newer of two tabs' entries for a
 * Project stays, and a removal wins over a write of the same Project. Synchronous. Answers the entries that made it. */
export function mergeIntoNote(storage: NoteStorage, entries: NoteEntries): { projects: string[]; removed: string[] } {
  const note = readNote(storage)
  const noted = { projects: [] as string[], removed: [] as string[] }
  for (const id of entries.removed) {
    const next: ClosingNote = { projects: { ...note.projects }, removed: note.removed.includes(id) ? note.removed : [...note.removed, id] }
    delete next.projects[id]
    try {
      writeNote(storage, next)
      note.projects = next.projects
      note.removed = next.removed
      noted.removed.push(id)
    } catch {
      // No room for even an id: the removal is left to the write already started.
    }
  }
  for (const [id, entry] of Object.entries(entries.projects)) {
    if (note.removed.includes(id)) continue
    const there = note.projects[id]
    if (there && there.at > entry.at) continue
    try {
      writeNote(storage, { projects: { ...note.projects, [id]: entry }, removed: note.removed })
      note.projects[id] = entry
      noted.projects.push(id)
    } catch {
      // Too large for the note: left to the write already started.
    }
  }
  return noted
}

/** Takes this tab's entries out again, once their write has landed: a Project only while the note still holds this tab's
 * entry (another tab may have noted a newer one). */
export function takeOutOfNote(storage: NoteStorage, entries: NoteEntries): void {
  try {
    const note = readNote(storage)
    for (const [id, entry] of Object.entries(entries.projects)) if (note.projects[id]?.stored === entry.stored) delete note.projects[id]
    const gone = new Set(entries.removed)
    note.removed = note.removed.filter((id) => !gone.has(id))
    writeNote(storage, note)
  } catch {
    // The note stays; the next start replays it, which writes nothing newer than the record.
  }
}

/** Removes the note, once its entries have been written. */
export function clearNote(storage: NoteStorage): void {
  try {
    storage.removeItem(CLOSING_NOTE_KEY)
  } catch {
    // Left for the next start to replay again.
  }
}
