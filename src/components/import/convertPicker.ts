import { computed } from 'vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import type { ConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import type { TargetColor } from '../../domain/convertColors'
import { isAddedColorId } from '../../domain/palette'
import type { LabelledColor } from '../../i18n/colorLabel'

// What Convert image's colour pickers share (a found color's Change, the Outline's color; tickets 0758, 0766): the
// colour popover's body over the new Palette and the Bead's Color catalog, a pick handed back as a target color.

/** The Bead colors list, as the popover's own: picking a code chooses it, with its family and Finish. */
export function pickerBeadColors(wizard: ConvertImageWizard, choose: (target: TargetColor) => void): BeadColors {
  return {
    available: computed(() => wizard.hasCatalog.value),
    state: wizard.catalogState,
    swatches: wizard.remapSwatches,
    bead: wizard.bead,
    catalog: computed(() => wizard.catalog.value),
    load: async () => {},
    add: (hex: string, code?: string) => {
      const swatch = wizard.remapSwatches.value.find((entry) => entry.code === code)
      choose({ hex, ...(code ? { code } : {}), ...(swatch ? { family: swatch.family, finish: swatch.finish } : {}) })
      return 'added'
    },
  }
}

/** A swatch of the new Palette as a target color: its hex, its code, and its id when it is a built-in color. */
export function paletteTarget(wizard: ConvertImageWizard, colorId: string): TargetColor | undefined {
  const swatch = wizard.remapPalette.value.byId(colorId)
  return swatch && { hex: swatch.hex, ...(swatch.code ? { code: swatch.code } : {}), ...(!isAddedColorId(swatch.id) ? { colorId: swatch.id } : {}) }
}

/** A target color as the shared color label reads it (ticket 0760): its code, family and Finish, and its built-in id. */
export function labelledColorOf(target: TargetColor): LabelledColor {
  return { hex: target.hex, ...(target.colorId ? { id: target.colorId } : {}), ...(target.code ? { code: target.code } : {}), ...(target.family ? { family: target.family } : {}), ...(target.finish ? { finish: target.finish } : {}) }
}
