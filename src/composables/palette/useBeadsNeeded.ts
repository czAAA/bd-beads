import { computed, type ComputedRef } from 'vue'
import { beadLabel, gramsPerBead, type Bead } from '../../domain/beads'
import { computeColorQuantities, estimatedGrams, formatGrams, type ColorQuantity } from '../../domain/beadQuantities'
import { groupThousands } from '../../domain/formatNumber'
import { createPalette, defaultPaletteIds, projectPalette, type Palette } from '../../domain/palette'
import { frameById, firstFrameId, soloFrame } from '../../domain/layerRecord'
import type { FrameRef } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { resolveProjectBead } from '../../domain/projectBead'
import { useI18n } from '../../i18n/useI18n'

/** A Frame's Beads needed (BeadsNeeded card, ticket 1218: the one `frame` names, read from a view of it alone): its rows,
 * its Bead's weight, the total as the header reads it ("1 512 · ≈ 7.6 g", each weight rounded up to 0.1 g). One count
 * for the section, the Frame panel's title line and the Frame button's Tooltip (0932); `total` is empty with none. */
export function useBeadsNeeded(whole: () => Project | undefined, frame: () => FrameRef = () => firstFrameId(whole())): {
  palette: ComputedRef<Palette>
  quantities: ComputedRef<ColorQuantity[]>
  averageGrams: ComputedRef<number | undefined>
  beadName: ComputedRef<string | undefined>
  weightOf: (count: number) => string | undefined
  count: ComputedRef<number>
  total: ComputedRef<string>
} {
  const { t, locale } = useI18n()
  const project = () => {
    const shown = whole()
    return shown && soloFrame(shown, frame())
  }
  // Read from the Project itself, not through the library's reactive wrapper: a Project is replaced whole by every edit,
  // so its identity is all this needs to depend on, and reading each of tens of thousands of beads through a proxy is slow.
  const palette = computed(() => {
    const shown = project()
    return shown ? projectPalette(shown) : createPalette(defaultPaletteIds())
  })
  const quantities = computed(() => {
    const shown = project()
    return shown ? computeColorQuantities(shown, palette.value, frame()) : []
  })
  /** Estimated weight (ticket 155, CONTEXT.md): count × average weight of the woven layer's Bead, the Frame's (ticket 0665). */
  const bead = computed<Bead | undefined>(() => {
    const shown = project()
    return shown ? resolveProjectBead(shown) : undefined
  })
  const averageGrams = computed(() => gramsPerBead(bead.value))
  /** The Frame's Bead to buy, "TOHO Cube 1.5mm", as the Layer settings summary names it (ticket 0974); none with no Frame. */
  const beadName = computed(() => {
    const shown = project()
    return shown && frameById(shown, frame()) && bead.value ? beadLabel(bead.value) : undefined
  })
  function weightOf(count: number): string | undefined {
    const grams = estimatedGrams(count, bead.value)
    return grams === undefined ? undefined : formatGrams(grams, t.value.quantities.gramsUnit, locale.value)
  }
  const count = computed(() => quantities.value.reduce((sum, quantity) => sum + quantity.count, 0))
  const total = computed(() => {
    if (quantities.value.length === 0) return ''
    const grams = weightOf(count.value)
    return `${groupThousands(count.value, locale.value)}${grams ? ` · ≈ ${grams}` : ''}`
  })
  return { palette, quantities, averageGrams, beadName, weightOf, count, total }
}
