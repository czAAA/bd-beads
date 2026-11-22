import { lastFileAgo, type SinceFile } from '../domain/beadsSinceFile'
import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import type { Locale, Translations } from './translations'

/** The quiet lines under the save ring's Tooltip and the Project panel's file state (tickets 0796, 1192): the beads
 * since the last Project file, then when that file was saved, or that there is none yet. */
export function saveReminderMeta(words: Translations['saveReminder'], locale: Locale, since: SinceFile, now: number): [string, string] {
  const count = fillBlanks(words.count, { count: groupThousands(since.beads, locale) })
  if (since.lastFileAt === undefined) return [count, words.noFile]
  const { value, unit } = lastFileAgo(since.lastFileAt, now)
  return [count, fillBlanks(words.lastFile, { when: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit) })]
}
