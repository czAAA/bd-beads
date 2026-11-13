import { computed, readonly, ref, type Ref } from 'vue'
import { filterBeadColors } from '../../domain/beadColorFilter'
import { FINISHES, type Finish } from '../../domain/colorCatalog'
import type { ColorSource, TargetColor } from '../../domain/convertColors'

/** What the converter's Finish filter reads of the wizard: the source, and the codes the source names before it. */
export interface ConvertFinishesDeps {
  /** The device's last Finishes (ticket 0893), none for every Finish. */
  start?: readonly Finish[]
  source: Ref<ColorSource>
  /** The Bead's codes, or My beads' of them: what the filter keeps a part of. */
  sourceTargets: Ref<readonly TargetColor[]>
}

/** The match kept to chosen Finishes (ticket 0901, ConvertImage card DS-2), through the Palette popover's own filter
 * (`filterBeadColors`). It applies to a catalog source only; under Default Palette or Exact the Finishes are kept, off. */
export function useConvertFinishes({ start = [], source, sourceTargets }: ConvertFinishesDeps) {
  const finishes = ref<Finish[]>(FINISHES.filter((finish) => start.includes(finish)))
  const applies = computed(() => source.value === 'bead-colors' || source.value === 'my-beads')
  const kept = computed(() => (applies.value ? filterBeadColors(sourceTargets.value, { families: [], finishes: finishes.value }) : [...sourceTargets.value]))
  // A filter that leaves no code (a Finish none of My beads has) matches to the whole source rather than to nothing.
  const targets = computed(() => (kept.value.length > 0 ? kept.value : [...sourceTargets.value]))
  return {
    finishes: readonly(finishes),
    /** The codes the match may use: the source's in a Finish on. */
    targets,
    /** How many codes the Finishes leave ("codes in 11/0: 412"). */
    codesLeft: computed(() => kept.value.length),
    /** Whether any Finish is on and narrows the match. */
    on: computed(() => applies.value && finishes.value.length > 0),
    /** The Finishes that narrow the match now: none under Default Palette or Exact. */
    applied: computed<readonly Finish[]>(() => (applies.value ? finishes.value : [])),
    /** Turns a Finish on or off, kept in the shared order. */
    toggle(finish: Finish) {
      const next = finishes.value.includes(finish) ? finishes.value.filter((item) => item !== finish) : [...finishes.value, finish]
      finishes.value = FINISHES.filter((item) => next.includes(item))
    },
    /** Clear filters: every Finish off, the whole source again. */
    clear: () => (finishes.value = []),
  }
}
