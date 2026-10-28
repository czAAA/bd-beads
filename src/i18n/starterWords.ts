import { plural } from './plural'
import type { Locale, Translations } from './translations'
import type { Bead } from '../domain/beads'
import { designPicks, designSizes, starterBeadCount, type Starter, type StarterChoice, type StarterPick, type StarterSize, type StarterSizes } from '../domain/starters'

/** A Starter's name: a Shape's, whose id is its kind's, its kind's name; an Earring's, Ring's or Band's its own (tickets
 * 0596, 0597, 0633). */
export function starterName(t: Translations, starter: Starter): string {
  if (starter.id === starter.kind) return t.frame.customKinds[starter.kind as keyof Translations['frame']['customKinds']]
  return t.starters.options[starter.id] ?? starter.id
}

/** One size in words, as a caption or the note names it ("10 rounds", "7 wide", "eu 54"): a Ring size in whole EU. */
function sizeWords(t: Translations, locale: Locale, { id }: StarterSize, value: number): string {
  return plural(locale, Math.round(value), t.starters.sizes[id])
}

/** One choice in words, its option's name ("V fringe", "Comfortable"). */
function pickWords(t: Translations, { id }: StarterPick, value: string): string {
  return (t.starters.picks[id].options as Record<string, string>)[value] ?? value
}

/** The sizes a Starter is set to in words, as a card's caption names them ("10 rounds", "7 wide · eu 54"; tickets 0596,
 * 0597): the design's own unless others are given. */
export function starterSizeWords(t: Translations, locale: Locale, starter: Starter, sizes: StarterSizes = designSizes(starter)): string {
  return starter.sizes
    .filter((size) => size.caption !== false)
    .map((size) => sizeWords(t, locale, size, sizes[size.id] ?? size.default))
    .join(' · ')
}

/** The design's sizes and choices a setup has moved away from, as the note names them ("fringe 12", "V fringe"). */
export function designWords(t: Translations, locale: Locale, starter: Starter, differences: readonly ({ size: StarterSize } | { pick: StarterPick })[]): string {
  const picks = designPicks(starter)
  return differences.map((each) => ('size' in each ? sizeWords(t, locale, each.size, each.size.default) : pickWords(t, each.pick, picks[each.pick.id]!))).join(', ')
}

/** A Starter's bead count for a choice on a Bead: "165 beads", one of a pair's "87 beads each", and "≈ 252 beads" for a
 * Ring or Band, whose length is worked out from the Bead, so its count is an estimate (StarterGallery card). */
export function starterCountWords(t: Translations, locale: Locale, starter: Starter, choice: StarterChoice, bead: Bead): string {
  const count = starterBeadCount(starter, choice, bead)
  if (starter.pair) return plural(locale, count, t.starters.beadsEach)
  const beads = plural(locale, count, t.starters.beads)
  return starter.measure === 'frame' ? beads : `≈ ${beads}`
}

/** The crumb at a gallery level's right: "starter", then "starter · shapes" under a category. */
export function starterCrumb(t: Translations, locale: Locale, category?: string): string {
  return [t.starters.title, category].filter(Boolean).map((word) => word!.toLocaleLowerCase(locale)).join(' · ')
}
