// The safe start's note (ticket 0716): "opening Project X", kept in localStorage, not sessionStorage, because a frozen
// tab gets closed and sessionStorage dies with it.

const OPENING_KEY = 'openbeads:opening'

/** Which Project the editor was opening. */
export interface OpeningNote {
  id: string
  name: string
}

/** Where the note is kept; a test fakes it or sets the key by hand. */
export interface OpeningNoteStore {
  read: () => OpeningNote | undefined
  write: (note: OpeningNote) => void
  clear: () => void
}

/** The note in this browser's localStorage. Blocked storage reads as no note and writes nothing: the editor still opens. */
export const browserOpeningNote: OpeningNoteStore = {
  read() {
    try {
      const raw = localStorage.getItem(OPENING_KEY)
      const note = raw === null ? undefined : (JSON.parse(raw) as Partial<OpeningNote> | null)
      return typeof note?.id === 'string' ? { id: note.id, name: typeof note.name === 'string' ? note.name : '' } : undefined
    } catch {
      return undefined
    }
  },
  write(note) {
    try {
      localStorage.setItem(OPENING_KEY, JSON.stringify(note))
    } catch {
      // No room or no storage: the guard is off for this open, nothing else changes.
    }
  },
  clear() {
    try {
      localStorage.removeItem(OPENING_KEY)
    } catch {
      // As above.
    }
  },
}
