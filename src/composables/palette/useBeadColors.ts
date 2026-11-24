import { computed, inject, provide, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import { catalogSwatches } from '../../domain/beadSwatch'
import { colorCatalogOf, findBead, type Bead } from '../../domain/beads'
import type { ColorCatalog, Finish } from '../../domain/colorCatalog'
import { beadIdOfLayer, beadOfLayer } from '../../domain/layerRecord'
import { brandColors, type AddUsedColorOutcome, type Palette, type PaletteCode } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { loadColorCatalog } from '../../services/colorCatalogs'
import type { FeedbackPrefill } from '../shell/useFeedbackFlow'

/** What the Bead's colors need from the app shell: the open Project, its Palette, and how a color joins the Palette
 * (an Edit, so Undo covers it, ADR 0036). */
export interface BeadColorsDeps {
  currentProject: () => Project | undefined
  palette: Readonly<Ref<Palette>>
  addUsed: (hex: string, code?: PaletteCode) => { outcome: AddUsedColorOutcome; colorId?: string }
  /** Makes a swatch the current color: a code just added is painted with at once (ticket 1092). */
  select?: (colorId: string) => void
  /** Takes an added swatch out of the Palette with no question (ticket 1092): a row in the Palette is a toggle. Without
   * it no row offers removal (the Convert image wizard's remap picker). */
  remove?: (colorId: string) => void
  /** The active Palette color, whose code a color Report starts from when no swatch is highlighted (ticket 0700). */
  selectedColorId?: () => string | undefined
  /** Opens the Feedback sheet; without it the list offers no Report (the Convert image wizard's remap picker). */
  report?: (kind: 'bead-color', prefill: FeedbackPrefill) => void
}

/** The Color catalog of a Bead as a list of swatches to add to the Palette (ticket 0537, ADR 0072), its catalog fetched on
 * the first `load`, not when the Bead comes up. Every list reads the Palette alone, so a code joins its own catalog's
 * section whichever Bead the list is of (ADR 0103, ticket 1226). */
function catalogList(bead: Readonly<Ref<Bead | undefined>>, deps: Pick<BeadColorsDeps, 'palette' | 'addUsed' | 'select'>) {
  const loaded = shallowRef<ColorCatalog>()
  const state = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  // The catalog is the registry's, not the copy's (ticket 0694).
  const catalogId = computed(() => colorCatalogOf(bead.value?.id))
  const size = computed(() => bead.value?.size)
  /** The loaded catalog while it is the Bead's own; after Replace Bead, none until `load` fetches the new one. */
  const catalog = computed(() => (loaded.value?.id === catalogId.value ? loaded.value : undefined))

  async function load() {
    const id = catalogId.value
    if (!id || loaded.value?.id === id) return
    state.value = 'loading'
    try {
      const fetched = await loadColorCatalog(id)
      if (catalogId.value !== id) return
      loaded.value = fetched
      state.value = 'ready'
    } catch {
      state.value = 'failed'
    }
  }

  const swatches = computed(() => {
    const own = catalog.value
    return own && size.value ? catalogSwatches(own, size.value, deps.palette.value.colors, brandColors(bead.value?.brand.id)) : []
  })

  /** A code joins the Palette, in its catalog's section (ADR 0103), and is the current color at once (ticket 1092); the
   * popover it was pressed in stays open. */
  function add(hex: string, code?: string): AddUsedColorOutcome {
    const catalog = catalogId.value
    const { outcome, colorId } = deps.addUsed(hex, code && catalog ? { catalog, code } : undefined)
    if (outcome === 'added' && colorId) deps.select?.(colorId)
    return outcome
  }

  return { available: computed(() => !!catalogId.value), state, swatches, load, add, bead, catalog }
}

/** The Color catalog of the open Project's Bead as a list of swatches to add to its Palette (ticket 0537, ADR 0072), and
 * `chooser`, the same of any onboarded Bead the Add another color popover's Bead chooser stands on (ticket 1226). */
export function useBeadColors({ currentProject, palette, addUsed, select, remove, selectedColorId, report }: BeadColorsDeps): BeadColors & { chooser: BeadColorsList; chooseBead: (beadId: string) => void; resetChooser: () => void } {
  // The woven layer's Bead, the Frame's when there is one (ADR 0079, ticket 0665), whose colors the Palette holds.
  const bead = computed(() => {
    const project = currentProject()
    return project && (beadOfLayer(project, 'frame').bead ?? findBead(beadIdOfLayer(project, 'frame')))
  })
  const own = catalogList(bead, { palette, addUsed, select })

  /** A color Report from the list's foot row (ticket 0700): the Bead's Brand and catalog, and the code, stored hex and
   * Swatch letter of the highlighted swatch, else of the active Palette color when it has a code. */
  function reportColor(listed: { bead: Readonly<Ref<Bead | undefined>> }) {
    return (highlighted?: { code: string; hex: string }) => {
      const active = palette.value.byId(selectedColorId?.())
      const color = highlighted ?? (active?.code ? { code: active.code, hex: active.hex } : undefined)
      const letter = color && currentProject()?.paletteLetters?.[color.hex]
      const catalogId = colorCatalogOf(listed.bead.value?.id)
      report?.('bead-color', {
        ...(listed.bead.value ? { brand: listed.bead.value.brand.name } : {}),
        ...(catalogId ? { catalog: catalogId } : {}),
        ...(color ? { code: color.code, hex: color.hex } : {}),
        ...(letter ? { swatchLetter: letter } : {}),
      })
    }
  }

  // The Bead chooser's pick, or none while it stands on the Palette's own Bead; a popover that opens again starts there.
  const chosenBeadId = ref<string>()
  const chosenBead = computed(() => {
    const id = chosenBeadId.value
    return (id && (id === bead.value?.id ? bead.value : findBead(id))) || bead.value
  })
  const chosen = catalogList(chosenBead, { palette, addUsed, select })

  // `bead` is handed out so the list reads a typed shop code as the Bead's own (ticket 0696); `catalog` so its empty
  // state can say which sizes a code exists in (ticket 0713).
  return {
    ...own,
    ...(remove ? { remove } : {}),
    ...(report ? { report: reportColor(own) } : {}),
    chooser: { ...chosen, ...(remove ? { remove } : {}), ...(report ? { report: reportColor(chosen) } : {}) },
    chooseBead: (beadId: string) => void (chosenBeadId.value = beadId),
    resetChooser: () => void (chosenBeadId.value = undefined),
  }
}

/** One Bead's colors as the list shows them: its codes, how one joins the Palette and, where the host offers them, how
 * one leaves it and how a Report starts. */
export type BeadColorsList = ReturnType<typeof catalogList> & {
  /** Takes a swatch out of the Palette with no question (ticket 1092): a row in the Palette is a toggle. */
  remove?: (colorId: string) => void
  /** Starts a color Report from the list's foot row (ticket 0700). */
  report?: (highlighted?: { code: string; hex: string }) => void
  /** The Finishes the list's filter opens with: the converter's, in Color by color's Change picker (ticket 0901). */
  finishes?: Readonly<Ref<readonly Finish[]>>
}

export type BeadColors = BeadColorsList & {
  /** The same of the Bead the Add another color popover's chooser stands on, and how it is picked (ticket 1226). */
  chooser?: BeadColorsList
  chooseBead?: (beadId: string) => void
  /** The chooser stands on the Palette's own Bead again, as the popover opens. */
  resetChooser?: () => void
}

const beadColorsKey: InjectionKey<BeadColors> = Symbol('beadColors')

/** The app shell hands out the Bead's colors to the Palette's controls. */
export function provideBeadColors(colors: BeadColors) {
  provide(beadColorsKey, colors)
}

/** Absent (mounted alone) means no Bead colors are offered. */
export function useBeadColorsList(): BeadColors | undefined {
  return inject(beadColorsKey, undefined)
}


/** Fetches the Bead's Color catalog once `coded` turns true, for a place that names a color by its code (ticket 0760). */
export function loadCatalogWhen(beadColors: BeadColors | undefined, coded: () => boolean) {
  watch(coded, (needed) => needed && void beadColors?.load(), { immediate: true })
}
