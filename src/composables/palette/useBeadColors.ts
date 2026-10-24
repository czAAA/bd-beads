import { computed, inject, provide, ref, shallowRef, type InjectionKey, type Ref } from 'vue'
import { catalogSwatches } from '../../domain/beadSwatch'
import { findBead } from '../../domain/beads'
import type { ColorCatalog } from '../../domain/colorCatalog'
import type { AddUsedColorOutcome, Palette } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { loadColorCatalog } from '../../services/colorCatalogs'

/** What the Bead's colors need from the app shell: the open Project, its Palette, and how a color joins the Palette
 * (an Edit, so Undo covers it, ADR 0036). */
export interface BeadColorsDeps {
  currentProject: () => Project | undefined
  palette: Readonly<Ref<Palette>>
  addUsed: (hex: string, code?: string) => { outcome: AddUsedColorOutcome }
}

/** The Color catalog of the open Project's Bead as a list of swatches to add to its Palette (ticket 0537, ADR 0072).
 * The catalog is fetched on the first `load`, not when the Project opens. */
export function useBeadColors({ currentProject, palette, addUsed }: BeadColorsDeps) {
  const catalog = shallowRef<ColorCatalog>()
  const state = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  const catalogId = computed(() => {
    const project = currentProject()
    return project && (project.bead ?? findBead(project.beadId))?.formFactor.colorCatalog
  })
  const size = computed(() => {
    const project = currentProject()
    return project && (project.bead ?? findBead(project.beadId))?.size
  })

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
      ? catalogSwatches(own, size.value, palette.value.colors.map((color) => color.hex))
      : []
  })

  return { available: computed(() => !!catalogId.value), state, swatches, load, add: (hex: string, code?: string) => addUsed(hex, code).outcome }
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

