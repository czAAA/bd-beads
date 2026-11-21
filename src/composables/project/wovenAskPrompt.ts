import { fillBlanks } from '../../domain/fillBlanks'
import type { WovenLines } from '../../domain/wovenLines'
import { pluralForm } from '../../i18n/plural'
import { seenWayWords } from '../../i18n/rowProgressWords'
import type { Locale, Translations } from '../../i18n/translations'

/** What the question about the rows woven says (ticket 1184; ConfirmDialogs card): its title, its message, and its two
 * answers, start over and keep the rows. */
export interface WovenAskPrompt {
  title: string
  message: string
  startOver: string
  keep: string
}

/** The words of the question Rotate Frame or a Technique change asks once a pass is done: the lines named as the way
 * runs as seen (columns left to right and right to left, rows otherwise), the way's name in the sentence, and the
 * title and start-over answer the asking change gives. `startOver` may hold the way's `{way}` blank. */
export function wovenAskPrompt(t: Translations, locale: Locale, asked: WovenLines, title: string, startOver: string): WovenAskPrompt {
  const words = t.frame.wovenAsk
  const columns = asked.way === 'left' || asked.way === 'right'
  const name = seenWayWords(t.rowProgress, asked.way).name
  const way = name.charAt(0).toLocaleLowerCase(locale) + name.slice(1)
  const counted = (forms: typeof words.rowsDone, values: Record<string, string>) => fillBlanks(pluralForm(locale, asked.lines, forms), values, { count: String(asked.lines) })
  return {
    title,
    message: counted(columns ? words.columnsDone : words.rowsDone, { way }),
    startOver: fillBlanks(startOver, {}, { way }),
    keep: counted(columns ? words.keepColumns : words.keepRows, {}),
  }
}
