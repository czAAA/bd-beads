import { MAX_FRAMES } from '../domain/frameLimit'
import { LOCALES, type Locale } from '../domain/locale'
import { plural } from './plural'
import type { Translations } from './translations'

/** The reason every way of making a Frame gives at the most Frames (spec 1214): "A Project holds up to 4 Frames." In the
 * language `locale` names, else the page's own (`lang` on <html>, which the app keeps in step), for a control's reason
 * that is worked out with no language at hand. */
export function framesFullReason(t: Translations, locale?: Locale): string {
  const lang = (typeof document === 'undefined' ? '' : document.documentElement.lang) as Locale
  return plural(locale ?? (LOCALES.includes(lang) ? lang : 'en'), MAX_FRAMES, t.frame.framesFull)
}
