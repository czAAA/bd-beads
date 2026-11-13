import { computed, type Ref } from 'vue'
import type { TargetColor } from '../../domain/convertColors'
import { myBeadsCodes, ownedTargets, withCodesAdded, withCodeToggled, withListCleared, type MyBeads } from '../../domain/myBeads'

/** What the converter's My beads reads from the wizard: the device's list, the Bead's Color catalog and its codes. */
export interface ConvertMyBeadsDeps {
  list: Ref<MyBeads>
  catalogId: Ref<string | undefined>
  /** The Bead's codes made in its size, discontinued ones left out; none while its catalog loads. */
  beadTargets: Ref<readonly TargetColor[]>
}

/** My beads in the converter (ticket 0902, ADR 0010 D-3): the list of the Bead's Color catalog, ticked and unticked in
 * the Colors popover's My beads view, and the codes of it a match may use. */
export function useConvertMyBeads({ list, catalogId, beadTargets }: ConvertMyBeadsDeps) {
  const codes = computed(() => myBeadsCodes(list.value, catalogId.value))
  /** The list's codes made in the Bead's size: all a match to My beads names. */
  const targets = computed(() => ownedTargets(beadTargets.value, codes.value))
  return {
    codes,
    targets,
    /** My beads is a source from the first ticked code (and not for a Bead with no Color catalog). */
    offered: computed(() => !!catalogId.value && codes.value.length > 0),
    /** Ticks a code into the list, or unticks it; the device keeps it at once. */
    toggle(code: string) {
      if (catalogId.value) list.value = withCodeToggled(list.value, catalogId.value, code)
    },
    /** Adds pasted codes to the list (ticket 0903); the device keeps it at once. */
    add(added: readonly string[]) {
      if (catalogId.value) list.value = withCodesAdded(list.value, catalogId.value, added)
    },
    /** Clear list (ticket 0903): the Bead's catalog's codes gone, other catalogs' kept. */
    clear() {
      if (catalogId.value) list.value = withListCleared(list.value, catalogId.value)
    },
  }
}
