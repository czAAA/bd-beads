import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import { pluralForm, plural } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'
import { catalogCounts, starterCount } from './appCounts'
import { coffeePromises, type CoffeePromise } from './coffeeCopy'
import { DEMO_PIECE_SIZE, DEMO_TECHNIQUE } from './inside/demoProjects'

// The Welcome section's words (Homepage card, ticket 0830): its counts, read from the app as the free list's are, the
// piece's caption, and the three promises it keeps of the coffee screen's six.

/** "3 817 TOHO and Miyuki colors · 15 Starters": the Color catalogs' codes and brands, and the Starters. */
export function welcomeCounts(t: Translations, locale: Locale): string {
  const { colors, starters } = t.homepage.welcome
  const { brands, codes } = catalogCounts(locale)
  return [fillBlanks(pluralForm(locale, codes, colors), { codes: groupThousands(codes, locale), brands }), plural(locale, starterCount(), starters)].join(' · ')
}

/** The piece's caption: its Technique and its grid's size, "Peyote · 48×23". */
export function welcomeCaption(t: Translations): string {
  return fillBlanks(t.homepage.welcome.caption, { technique: techniqueName(t, DEMO_TECHNIQUE), size: `${DEMO_PIECE_SIZE.long}×${DEMO_PIECE_SIZE.wide}` })
}

/** The promises the Welcome tile shows, in its order. */
const WELCOME_PROMISES: readonly CoffeePromise['id'][] = ['device', 'offline', 'free']

/** The coffee screen's own three, with its icons and the lines it keeps for screen readers. */
export function welcomePromises(t: Translations): CoffeePromise[] {
  const all = coffeePromises(t)
  return WELCOME_PROMISES.map((id) => all.find((promise) => promise.id === id)!)
}
