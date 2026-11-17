import type { Locale } from '../domain/locale'
import { notesFilePath, readNotesFile, type NotesFile } from '../domain/notesFile'

/** Reads a language's notes file (ticket 1047): the file, or null when it can't be fetched or read. */
export type NotesSource = (locale: Locale) => Promise<NotesFile | null>

/** The notes file of this page's own Build, `notes/<locale>.json` under the app's base: from the Offline copy when the
 * device holds one (ticket 1041), so What's new opens with no network. */
export function notesFromBase(base: string): NotesSource {
  return async (locale) => {
    try {
      const answer = await fetch(`${base}${notesFilePath(locale)}`)
      return answer.ok ? readNotesFile(await answer.json()) : null
    } catch {
      return null
    }
  }
}
