import { computed, inject, provide, ref, shallowRef, type InjectionKey, type Ref } from 'vue'
import { catalogSwatches } from '../../domain/beadSwatch'
import { colorCatalogOf, findBead } from '../../domain/beads'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { beadIdOfLayer, beadOfLayer } from '../../domain/layerRecord'
import { brandColors, type AddUsedColorOutcome, type Palette } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { loadColorCatalog } from '../../services/colorCatalogs'
import type { FeedbackPrefill } from '../shell/useFeedbackFlow'

/** What the Bead's colors need from the app shell: the open Project, its Palette, and how a color joins the Palette
 * (an Edit, so Undo covers it, ADR 0036). */
export interface BeadColorsDeps {
  currentProject: () => Project | undefined
  palette: Readonly<Ref<Palette>>
  addUsed: (hex: string, code?: string) => { outcome: AddUsedColorOutcome }
  /** The active Palette color, whose code a color Report starts from when no swatch is highlighted (ticket 0700). */
  selectedColorId?: () => string | undefined
  /** Opens the Feedback sheet; without it the list offers no Report (the Convert image wizard's remap picker). */
  report?: (kind: 'bead-color', prefill: FeedbackPrefill) => void
}

/** The Color catalog of the open Project's Bead as a list of swatches to add to its Palette (ticket 0537, ADR 0072).
 * The catalog is fetched on the first `load`, not when the Project opens. */
export function useBeadColors({ currentProject, palette, addUsed, selectedColorId, report }: BeadColorsDeps) {
  const catalog = shallowRef<ColorCatalog>()
  const state = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  // The woven layer's Bead, the Frame's when there is one (ADR 0079, ticket 0665), whose colors the Palette holds. Its
  // catalog is the registry's, not the copy's (ticket 0694).
  const beadId = computed(() => {
    const project = currentProject()
    return project && beadIdOfLayer(project, 'frame')
  })
  const bead = computed(() => {
    const project = currentProject()
    return project && (beadOfLayer(project, 'frame').bead ?? findBead(beadIdOfLayer(project, 'frame')))
  })
  const catalogId = computed(() => colorCatalogOf(beadId.value))
  const size = computed(() => bead.value?.size)

  async function load() {
    const id = catalogId.value
    if (!id || catalog.value?.id === id) return
    state.value = 'loading'
    try {
      const loaded = await loadColorCatalog(id)
      if (catalogId.value !== id) return
      catalog.value = loaded
      state.value = 'ready'
    } catch {
      state.value = 'failed'
    }
  }

  const swatches = computed(() => {
    const own = catalog.value
    return own && own.id === catalogId.value && size.value
      ? catalogSwatches(own, size.value, palette.value.colors.map((color) => color.hex), brandColors(bead.value?.brand.id))
      : []
  })

  /** A color Report from the list's foot row (ticket 0700): the Bead's Brand and catalog, and the code, stored hex and
   * Swatch letter of the highlighted swatch, else of the active Palette color when it has a code. */
  function reportColor(highlighted?: { code: string; hex: string }) {
    const active = palette.value.byId(selectedColorId?.())
    const color = highlighted ?? (active?.code ? { code: active.code, hex: active.hex } : undefined)
    const letter = color && currentProject()?.paletteLetters?.[color.hex]
    report?.('bead-color', {
      ...(bead.value ? { brand: bead.value.brand.name } : {}),
      ...(catalogId.value ? { catalog: catalogId.value } : {}),
      ...(color ? { code: color.code, hex: color.hex } : {}),
      ...(letter ? { swatchLetter: letter } : {}),
    })
  }

  // `bead` is handed out so the list reads a typed shop code as the Bead's own (ticket 0696); `catalog` so its empty
  // state can say which sizes a code exists in (ticket 0713).
  return { available: computed(() => !!catalogId.value), state, swatches, load, add: (hex: string, code?: string) => addUsed(hex, code).outcome, bead, catalog, ...(report ? { report: reportColor } : {}) }
}

export type BeadColors = ReturnType<typeof useBeadColors>

const beadColorsKey: InjectionKey<BeadColors> = Symbol('beadColors')

/** The app shell hands out the Bead's colors to the Palette's controls. */
export function provideBeadColors(colors: BeadColors) {
  provide(beadColorsKey, colors)
}

/** Absent (mounted alone) means no Bead colors are offered. */
export function useBeadColorsList(): BeadColors | undefined {
  return inject(beadColorsKey, undefined)
}

