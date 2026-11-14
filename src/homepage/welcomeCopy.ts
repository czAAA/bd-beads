import { fillBlanks } from '../domain/fillBlanks'
import { groupThousands } from '../domain/formatNumber'
import { pluralForm, plural } from '../i18n/plural'
import { techniqueName } from '../i18n/techniqueName'
import type { Locale, Translations } from '../i18n/translations'
import { catalogCounts, starterCount } from './appCounts'
import type { IconName } from '../components/ui/icons'
import { DEMO_PIECE_SIZE, DEMO_TECHNIQUE } from './inside/demoProjects'

// The Welcome section's words (Homepage card, ticket 0830): its counts, read from the app as the free list's are, the
// piece's caption, and its three promises: free and local as one, then what the app does (ticket 0946).

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
] as const satisfies readonly { id: WelcomePromise['id']; icon: IconName }[]

/** The three promises in a language, in the tile's order. */
export function welcomePromises(t: Translations): WelcomePromise[] {
  return WELCOME_PROMISES.map(({ id, icon }) => ({ id, icon, ...t.homepage.welcome.promises[id] }))
}
