import { computed, ref, type Ref } from 'vue'
import { clamp } from '../../domain/clamp'
import { LEAST_COLOR_BEADS, NO_LEAST_COLOR_BEADS, smallColorsJoined, type FoundColor } from '../../domain/convertColors'
import type { ReducedColors } from '../../domain/imageColors'
import type { PictureKind } from '../../domain/pictureKind'
import { cleanUpStrayBeads, loneBeadCount, passesOf, recountReduced, type CleanUpStrength } from '../../domain/strayBeads'
import type { Weave } from '../../domain/weave'

/** Small colors join's highest step (ConvertImage card DS-3). */
export const MOST_LEAST_COLOR_BEADS = 50

/** What Clean up needs from the wizard: the picture's kind, the Frame's sampled grid and its reduction, the Weave, and
 * the wizard's own match of a reduction at a minimum (its source and the person's choices). */
export interface ConvertCleanUpDeps {
  kind: Ref<PictureKind | undefined>
  raw: Ref<readonly (readonly (string | undefined)[])[] | undefined>
  reduced: Ref<ReducedColors>
  weave: Ref<Weave>
  match: (reduced: ReducedColors, leastBeads: number) => FoundColor[]
}

/** Clean up (ConvertImage card DS-3, ticket 0906): Clean up stray beads with its strength and Small colors join's number,
 * between the reduction and the beads. A photo opens with it on at Medium and the number at 10, flat art (ticket 0889)
 * with both off; what the person sets is kept until a new picture (`reset`). No Undo: each control shows its state. */
export function useConvertCleanUp({ kind, raw, reduced: sampled, weave, match }: ConvertCleanUpDeps) {
  const chosenOn = ref<boolean>()
  const strength = ref<CleanUpStrength>('medium')
  const chosenLeast = ref<number>()

  const photo = computed(() => kind.value === 'photo')
  const on = computed(() => chosenOn.value ?? photo.value)
  const leastBeads = computed(() => chosenLeast.value ?? (photo.value ? LEAST_COLOR_BEADS : NO_LEAST_COLOR_BEADS))

  /** The found colors before the cleanup: what a bead's color is, for the rule and the lone beads' count. */
  const before = computed(() => match(sampled.value, leastBeads.value))
  const colorOf = computed(() => {
    const results = new Map(before.value.map((color) => [color.pictureHex, color.result?.hex]))
    const byHex = sampled.value.byHex
    return (hex: string) => results.get(byHex.get(hex) ?? hex)
  })
  /** The beads that stand alone before any cleanup. */
  const lone = computed(() => (raw.value ? loneBeadCount(raw.value, colorOf.value, weave.value) : 0))
  const cleanedBeads = computed(() => (on.value && raw.value ? cleanUpStrayBeads(raw.value, colorOf.value, weave.value, passesOf(strength.value)) : undefined))
  const changed = computed(() => (cleanedBeads.value?.cleaned ? cleanedBeads.value : undefined))

  const reduced = computed(() => (changed.value ? recountReduced(changed.value.raw, sampled.value) : sampled.value))
  const found = computed(() => (changed.value ? match(reduced.value, leastBeads.value) : before.value))
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
      strength.value = 'medium'
      chosenLeast.value = undefined
    },
    /** Whether the picture is flat art, so the page says why the helper is off. */
    flatArt: computed(() => kind.value === 'flat'),
    /** The Frame's grid as the beads take it, and its reduction counted again. */
    raw: computed(() => changed.value?.raw ?? raw.value ?? []),
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
