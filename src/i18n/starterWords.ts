import { plural } from './plural'
import type { Locale, Translations } from './translations'
import type { Bead } from '../domain/beads'
import { designPicks, designSizes, isOption, starterBeadCount, type Starter, type StarterChoice, type StarterPick, type StarterSize, type StarterSizes } from '../domain/starters'

/** A Starter's name: an Earring's, Ring's or Band's own, a Shape's its kind's (tickets 0596, 0597). */
export function starterName(t: Translations, starter: Starter): string {
  return isOption(starter) ? t.starters.options[starter.id] : t.frame.customKinds[starter.kind as keyof Translations['frame']['customKinds']]
}

/** One size in words, as a caption or the note names it ("10 rounds", "7 wide", "eu 54"): a Ring size in whole EU. */
function sizeWords(t: Translations, locale: Locale, { name }: StarterSize, value: number): string {
  return plural(locale, Math.round(value), t.starters.sizes[name])
}

/** One choice in words, its option's name ("V fringe", "Comfortable"). */
function pickWords(t: Translations, { name }: StarterPick, value: string): string {
  return (t.starters.picks[name].options as Record<string, string>)[value] ?? value
}

/** The sizes a Starter is set to in words, as a card's caption names them ("10 rounds", "7 wide · eu 54"; tickets 0596,
 * 0597): the design's own unless others are given. */
export function starterSizeWords(t: Translations, locale: Locale, starter: Starter, sizes: StarterSizes = designSizes(starter)): string {
  return starter.sizes
    .filter((size) => size.caption !== false)
    .map((size) => sizeWords(t, locale, size, sizes[size.name] ?? size.size))
    .join(' · ')
}

/** The design's sizes and choices a setup has moved away from, as the note names them ("fringe 12", "V fringe"). */
export function designWords(t: Translations, locale: Locale, starter: Starter, differences: readonly ({ size: StarterSize } | { pick: StarterPick })[]): string {
  const picks = designPicks(starter)
  return differences.map((each) => ('size' in each ? sizeWords(t, locale, each.size, each.size.size) : pickWords(t, each.pick, picks[each.pick.name]!))).join(', ')
}

/** A Starter's bead count for a choice on a Bead: "165 beads", one earring's "87 beads each", and "≈ 252 beads" for a
 * Ring or Band, whose count is an estimate (StarterGallery card). */
export function starterCountWords(t: Translations, locale: Locale, starter: Starter, choice: StarterChoice, bead: Bead): string {
  const count = starterBeadCount(starter, choice, bead)
  if (starter.category === 'earrings') return plural(locale, count, t.starters.beadsEach)
  const beads = plural(locale, count, t.starters.beads)
  return starter.kind === 'rectangular' ? `≈ ${beads}` : beads
}

/** The crumb at a gallery level's right: "starter", then "starter · shapes" under a category. */
export function starterCrumb(t: Translations, locale: Locale, category?: string): string {
  return [t.starters.title, category].filter(Boolean).map((word) => word!.toLocaleLowerCase(locale)).join(' · ')
}
