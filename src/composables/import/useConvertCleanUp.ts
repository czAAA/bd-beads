import { computed, ref, type Ref } from 'vue'
import { clamp } from '../../domain/clamp'
import { LEAST_COLOR_BEADS, MOST_LEAST_COLOR_BEADS, NO_LEAST_COLOR_BEADS, smallColorsJoined, type FoundColor } from '../../domain/convertColors'
import type { ReducedColors } from '../../domain/imageColors'
import type { PictureKind } from '../../domain/pictureKind'
import { cleanUpStrayBeads, DEFAULT_CLEAN_UP_STRENGTH, loneBeadCount, passesOf, recountReduced, type CleanUpStrength } from '../../domain/strayBeads'
import type { Weave } from '../../domain/weave'

/** What Clean up needs from the wizard: the picture's kind, the Frame's sampled grid and its reduction, the Weave, and
 * the wizard's own match of a reduction at a minimum (its source and the person's choices). */
export interface ConvertCleanUpDeps {
  kind: Ref<PictureKind | undefined>
  raw: Ref<readonly (readonly (string | undefined)[])[] | undefined>
  reduced: Ref<ReducedColors>
  weave: Ref<Weave>
  match: (reduced: ReducedColors, leastBeads: number) => FoundColor[]
}

/** Each sampled color's bead color, by the reduced color it joins. */
function colorLookup(found: readonly FoundColor[], at: ReducedColors) {
  const results = new Map(found.map((color) => [color.pictureHex, color.result?.hex]))
  return (hex: string) => results.get(at.byHex.get(hex) ?? hex)
}

/** Clean up (ConvertImage card DS-3, ticket 0906): Clean up stray beads with its strength and Small colors join's number,
 * between the reduction and the beads. A photo opens with it on at Medium and the number at 10, flat art (ticket 0889)
 * with both off; what the person sets is kept until a new picture (`reset`). No Undo: each control shows its state. */
export function useConvertCleanUp({ kind, raw, reduced: sampled, weave, match }: ConvertCleanUpDeps) {
  const chosenOn = ref<boolean>()
  const strength = ref<CleanUpStrength>(DEFAULT_CLEAN_UP_STRENGTH)
  const chosenLeast = ref<number>()

  const photo = computed(() => kind.value === 'photo')
  const on = computed(() => chosenOn.value ?? photo.value)
  const leastBeads = computed(() => chosenLeast.value ?? (photo.value ? LEAST_COLOR_BEADS : NO_LEAST_COLOR_BEADS))

  /** The found colors before the cleanup: what a bead's color is, for the rule and the lone beads' count. */
  const before = computed(() => match(sampled.value, leastBeads.value))
  const colorOf = computed(() => colorLookup(before.value, sampled.value))
  /** The beads that stand alone before any cleanup. */
  const lone = computed(() => (raw.value ? loneBeadCount(raw.value, colorOf.value, weave.value) : 0))

  /** A reduction matched, cleaned as set and matched again where the cleanup changed a bead: the one path for the page's
   * beads and the Colors neighbours' (ticket 0904). Read in a computed, it follows every setting it uses. */
  function cleanedOf(at: ReducedColors, matched = match(at, leastBeads.value), lookup = colorLookup(matched, at)) {
    const cleanedBeads = on.value && raw.value ? cleanUpStrayBeads(raw.value, lookup, weave.value, passesOf(strength.value)) : undefined
    const changed = cleanedBeads?.cleaned ? cleanedBeads : undefined
    const reduced = changed ? recountReduced(changed.raw, at) : at
    return { cleanedBeads, changed, raw: changed?.raw ?? raw.value ?? [], reduced, found: changed ? match(reduced, leastBeads.value) : matched }
  }
  const page = computed(() => cleanedOf(sampled.value, before.value, colorOf.value))
  const cleanedBeads = computed(() => page.value.cleanedBeads)
  const changed = computed(() => page.value.changed)
  const reduced = computed(() => page.value.reduced)
  const found = computed(() => page.value.found)
  const joined = computed(() => smallColorsJoined(found.value, match(reduced.value, NO_LEAST_COLOR_BEADS)))

  return {
    on,
    strength,
    leastBeads,
    setOn: (next: boolean) => (chosenOn.value = next),
    setStrength: (next: CleanUpStrength) => (strength.value = next),
    setLeastBeads: (next: number) => (chosenLeast.value = clamp(Math.round(next), NO_LEAST_COLOR_BEADS, MOST_LEAST_COLOR_BEADS)),
    /** A new picture opens at its own defaults. */
    reset: () => {
      chosenOn.value = undefined
      strength.value = DEFAULT_CLEAN_UP_STRENGTH
      chosenLeast.value = undefined
    },
    /** Whether the picture is flat art, so the page says why the helper is off. */
    flatArt: computed(() => kind.value === 'flat'),
    /** The Frame's grid as the beads take it, and its reduction counted again. */
    raw: computed(() => page.value.raw),
    /** The same at another reduction (the Colors neighbours, ticket 0904): its grid, reduction and found colors. */
    cleanedOf: (at: ReducedColors) => cleanedOf(at),
    reduced,
    found,
    /** The Frame's beads the cleanup changed (1 marks one, row by row), for the preview's rings; none while off. */
    changedBeads: computed(() => changed.value?.changed),
    /** How many beads it changed, and how many stand alone without it. */
    cleaned: computed(() => cleanedBeads.value?.cleaned ?? 0),
    lone,
    /** How many colors Small colors join joined, and their beads. */
    joined,
  }
}
