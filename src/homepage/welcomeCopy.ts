import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import type { Layered } from '../domain/layerRecord'
import { TECHNIQUES } from '../domain/weave'
import { formatList } from '../i18n/listFormat'
import { pluralForm } from '../i18n/plural'
import { rowProgressAnnouncement } from '../i18n/rowProgressWords'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'
import type { IconName } from '../components/ui/icons'

// The Welcome section's words (Homepage card, tickets 0830, 1157): its heading and line, counted and listed from the
// app's Techniques, never typed, so a fourth makes them say so; the cuff's name; and its four promises.

/** "A free bead pattern editor that works in three techniques": the count a word where the language has one. */
export function welcomeHeading(t: Translations, locale: Locale): string {
  const count = TECHNIQUES.length
  const { heading, countWords } = t.homepage.welcome
  return fillBlanks(pluralForm(locale, count, heading), { count: countWords[count - 1] ?? groupThousands(count, locale) })
}

/** "Loom, peyote, and brick stitch.": the Techniques by name, joined as the language joins a list, as the free list
 * names them. */
export function welcomeLine(t: Translations, locale: Locale): string {
  const names = formatList(locale, TECHNIQUES.map((technique) => techniqueName(t, technique).toLocaleLowerCase(locale)))
  return fillBlanks(t.homepage.welcome.line, { techniques: names.charAt(0).toLocaleUpperCase(locale) + names.slice(1) })
}

/** The cuff as an image: named with the counter's own words, as the announcer says them. */
export function cuffName(t: Translations, cuff: Layered): string {
  return fillBlanks(t.homepage.welcome.cuff, { counter: rowProgressAnnouncement(t.rowProgress, cuff) })
}

/** One Welcome promise as shown: its icon, its name, and its line. */
export interface WelcomePromise {
  id: keyof Translations['homepage']['welcome']['promises']
  icon: IconName
  name: string
  text: string
}

/** The promises in the tile's order, each with its icon: Start from a picture and Count and weave take their chapters'. */
const WELCOME_PROMISES = [
  { id: 'free', icon: 'check' },
  { id: 'picture', icon: 'image' },
  { id: 'weave', icon: 'turn-row-direction' },
  { id: 'export', icon: 'export' },
] as const satisfies readonly { id: WelcomePromise['id']; icon: IconName }[]

/** The four promises in a language, in the tile's order. */
export function welcomePromises(t: Translations): WelcomePromise[] {
  return WELCOME_PROMISES.map(({ id, icon }) => ({ id, icon, ...t.homepage.welcome.promises[id] }))
}
