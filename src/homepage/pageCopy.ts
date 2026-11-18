import type { Locale, Translations } from '../i18n/translations'
import { freeListGroups } from './freeList'
import { insideChapters } from './inside/insideCopy'
import { welcomePromises } from './welcomeCopy'

// The Homepage's words as the page itself carries them (ticket 1055): its title and description, and the copy the
// drawn page shows, taken from the same functions its sections draw from, so the two can't drift. The build writes
// them into index.html for crawlers that never run the app (vite.crawler.ts); the app replaces the copy as it starts.

/** A name and its line, as a promise or a row of What's inside shows them. */
interface NamedLine {
  name: string
  text: string
}

/** A run of the page's copy under its heading (vite.crawler.ts says the same shape for the build): a line, named lines, and plain rows, each drawn by its section. */
interface CopyGroup {
  heading: string
  named?: NamedLine[]
  rows?: string[]
}

/** One section of the page's copy, in the page's order: its heading, its line, and its groups. */
interface CopySection {
  heading: string
  line?: string
  named?: NamedLine[]
  groups?: CopyGroup[]
}

/** The Homepage's words in one language: what its head says and what its sections show a new visitor. */
interface HomepageCopy {
  locale: Locale
  /** The app's name, as the page's data names it. */
  name: string
  title: string
  description: string
  sections: CopySection[]
}

/** The page's title, as the tab and a search result show it: ending on the app's name. */
export function homepageTitle(t: Translations): string {
  return `${t.homepage.pageTitle} · ${t.app.title}`
}

/** The Homepage's words in a language: Welcome's heading, line and promises, What's inside's chapters and rows, and
 * the free list a new visitor sees, in What's inside's chapters (ticket 0947). Nothing the drawn page doesn't show. */
export function homepageCopy(t: Translations, locale: Locale): HomepageCopy {
  const { welcome, plans } = t.homepage
  return {
    locale,
    name: t.app.title,
    title: homepageTitle(t),
    description: t.homepage.description,
    sections: [
      { heading: welcome.heading, line: welcome.line, named: welcomePromises(t).map(({ name, text }) => ({ name, text })) },
      {
        heading: t.homepage.whatsInside,
        groups: insideChapters(t, locale).map((chapter) => ({ heading: chapter.name, named: chapter.rows.map(({ name, text }) => ({ name, text })) })),
      },
      {
        heading: plans.alone.heading,
        line: plans.free.heading,
        groups: freeListGroups(t, locale).map((group) => ({ heading: group.name, rows: group.rows })),
      },
    ],
  }
}

