import { plural } from './plural'
import type { Locale, Translations } from './translations'
import type { Starter } from '../domain/starters'

/** The size a Starter is set to in words, as a card's caption and the setup's note name it ("10 rounds", "part size
 * 5"; ticket 0596). */
export function starterSizeWords(t: Translations, locale: Locale, starter: Starter, size: number): string {
  return plural(locale, size, t.starters.sizes[starter.setting])
}

/** The crumb at a gallery level's right: "starter", then "starter · shapes" under a category. */
export function starterCrumb(t: Translations, locale: Locale, category?: string): string {
  return [t.starters.title, category].filter(Boolean).map((word) => word!.toLocaleLowerCase(locale)).join(' · ')
}
