import type { PluralForms } from '../plural'

/** A row of What's inside (ticket 0797) or a promise of the coffee screen (ticket 0823): its name and its line. */
interface InsideCopy {
  name: string
  text: string
}

/** What's inside's 14 rows, in the order the tour plays them (homepage/inside/insideCopy.ts). */
export type InsideRowId =
  | 'canvas'
  | 'techniques'
  | 'editing'
  | 'toolsAtPointer'
  | 'mirror'
  | 'starters'
  | 'reference'
  | 'convert'
  | 'colors'
  | 'letters'
  | 'rowProgress'
  | 'beadsNeeded'
  | 'exports'
  | 'savedProjects'

/** What's inside's four chapters, each a run of the tour's rows (ticket 0830; homepage/inside/insideCopy.ts). */
export type InsideChapterId = 'draw' | 'startFrom' | 'beadColors' | 'weaveKeep'

/** One Homepage plan tile's words (ticket 220): its name, its price, its one line and its button. */
interface PlanCopy {
  name: string
  price: string
  text: string
  button: string
}

/** The Homepage's free list, a row each (ticket 0742; `copy/homepage.md`, the free list). The blanks are the app's own counts
 * and names, never typed in: `{names}` the Techniques', `{brands}` and `{codes}` the Color catalogs', `{categories}` the
 * Starters'. */
interface FreeRows {
  browser: string
  canvas: string
  techniques: PluralForms
  projects: string
  picture: string
  frame: string
  schemas: string
  rowProgress: string
  editor: string
  pdf: string
  png: string
  beadsNeeded: string
  colors: string
  file: string
  wordChart: string
  mirror: string
  starters: PluralForms
}

/** The Homepage and What's new. */
export interface HomepageTranslations {
  /** The ContextBar (ticket 168; ContextBar card): what a Selection can do, floating above the Progress bar. */
  homepage: {
    /** The page's title before " · openbeads": what a search result shows, in the words people search with (ticket 1055). */
    pageTitle: string
    /** The page's description for search engines (ticket 1055): what it is, the Techniques, free. Never drawn. */
    description: string
    makeFirstProject: string
    openEditor: string
    whatsInside: string
    /** The Welcome section (ticket 0830; Homepage card): its heading and line, See how it works, the counts line's two
     * counted parts ({codes} and {brands} from the app), the piece's caption and its name as an image; its three promises
     * (ticket 0946): free and local as one, then what the app does, in the page's chapter words. */
    welcome: {
      heading: string
      line: string
      seeHow: string
      colors: PluralForms
      /** The text button beside See how it works (ticket 0953). */
      startFromStarter: string
      caption: string
      piece: string
      promises: Record<'free' | 'picture' | 'weave', InsideCopy>
    }
    /** What's inside (ticket 0797; Homepage card): the 14 rows the tour plays, the editor's region, and the demo's
     * Projects. The colors row's {brands} and Convert image's {max} come from the app. */
    inside: {
      rows: Record<InsideRowId, InsideCopy>
      editor: string
      demo: { ring: string; heart: string; bracelet: string }
      /** The playing row's place in the caption, "4 / 14" (ticket 0825). */
      place: string
      /** The four chapters, the tour's Pause and Play, Open editor from here (ticket 0879), and the demo's Expand and
       * Collapse (ticket 0830). */
      chapters: Record<InsideChapterId, string>
      pause: string
      play: string
      openFromHere: string
      expand: string
      collapse: string
      /** The demo's tag in its Canvas strip (ticket 0841). */
      demoTag: string
    }
    /** The Homepage's Progress bar (ticket 0739): the track's name, Back and Next, and why each is disabled at its end; each
     * step's name for screen readers (ticket 0744); the Welcome section's step, its heading being a sentence (ticket 0830). */
    sections: { label: string; welcome: string; back: string; next: string; firstBody: string; lastBody: string; goTo: string; moreBelow: string }
    /** The coffee tile (ticket 219; Homepage card). */
    coffee: { title: string; text: string; button: string; source: string }
    /** The coffee screen's promises (ticket 0823; Homepage card), in the order shown; the shortcuts one's {menu}, {help}
     * and {shortcuts} come from the app. */
    promises: Record<'device' | 'offline' | 'noAds' | 'tablets' | 'free' | 'shortcuts', InsideCopy>
    /** The coffee screen's Open source tile (ticket 0823); its View the source and star line are `coffee`'s. */
    openSource: { name: string; text: string }
    /** The coffee screen's Say hello tile (ticket 0823): {menu} and {feedback}, and its button, are the Menu's own labels. */
    sayHello: { name: string; text: string }
    /** The coffee screen's What's new tile (tickets 0824, 1047): its name, Every change (the link to `CHANGELOG.md`), a
     * Production release's line, {version} its Version, and the chip of what waits for Reload (ticket 1049). */
    whatsNew: { name: string; history: string; release: string; arrives: string }
    /** The plan tiles (ticket 220; Homepage card). */
    plans: {
      heading: string
      why: string
      youAreHere: string
      /** No account; Free account, its two rows listed under its button, under `free.heading`; and Pro, switched off
       * (ticket 0742), its line saying only what it builds on. */
      tiles: [PlanCopy & { meta: string }, Omit<PlanCopy, 'text'> & { rows: [string, string] }, PlanCopy]
      /** The stamp on Pro, written in capitals on it, and its image's name. */
      comingSoon: string
      /** No account's list (ticket 0742): the app's real features, in the order `homepage/freeList.ts` gives them; a
       * phone's Show all opens the rows past its first (ticket 0827). */
      free: { heading: string; rows: FreeRows; more: string; showAll: string }
      /** A new visitor's plans (ticket 0871): No account alone, its heading and the one line in place of the reason, which
       * shows in an Info button's Tooltip named by `info` (ticket 0946). */
      alone: { heading: string; why: string; info: string }
    }
    /** The phone strip's library button's name (ticket 0827): {library} is the Menu row's, "Projects library, 28". */
    library: string
    /** The page at an address with none, such as a language the app has none for (ticket 1053), and its one action. */
    notFound: string
    notFoundHomepage: string
  }
  /** A Release note's kind label (ticket 1047, spec 1043), in What's new and "Update ready". */
  releaseNoteKinds: { new: string; changed: string; fixed: string }
}
