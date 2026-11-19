import { vi } from 'vitest'
import { computed, defineComponent, h, ref, type Component, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createProject } from '../domain/createProject'
import { provideColorPick, provideMoveColor, providePaletteLetters, provideRemoveAddedColor, provideRemoveAllAddedColors, useProjectPalette } from '../composables/tools/usePalette'
import { provideBeadColors, type BeadColors } from '../composables/palette/useBeadColors'
import { lettersOfPalette } from '../domain/paletteEdits'
import { editHarness } from './editHarness'

const BEAD_ID = 'toho/round/10-0'

// `letters` hands out the Project's Swatch letters too, the switch that shows them being that ref (ticket 1092).
/** Mounts a Palette control the way the app shell hosts it: over a Project whose Palette holds `ids`, with the real
 * Palette and Edit, moving a swatch for real, and spies for asking to remove one or all. The Project is on TOHO Round
 * 10/0, whose catalog names no codes, so its default colors are the generic ones the tests name by id (ticket 1070). */
export function mountWithPalette(component: Component, ids: string[], props: Record<string, unknown> = {}, options: { attachTo?: HTMLElement; codes?: Record<string, string>; beadColors?: BeadColors; letters?: Ref<boolean> } = {}) {
  const base = createProject({ technique: 'loom', beadId: BEAD_ID, size: { width: 3, height: 3, unit: 'beads' } })
  // Every swatch has its Swatch letter, as a Palette the app made does.
  const harness = editHarness({ ...base, palette: ids, paletteLetters: lettersOfPalette(ids, BEAD_ID, base.paletteLetters), ...(options.codes ? { paletteCodes: options.codes } : {}) })
  const requestRemove = vi.fn()
  const requestRemoveAll = vi.fn()
  let palette!: ReturnType<typeof useProjectPalette>
  const Host = defineComponent({
    setup() {
      palette = useProjectPalette({ currentProject: harness.currentProject, edit: harness.edit })
      provideRemoveAddedColor(requestRemove)
      provideRemoveAllAddedColors(requestRemoveAll)
      provideMoveColor(palette.moveColor)
      provideColorPick({ picking: ref(false), toggle: () => {} })
      if (options.beadColors) provideBeadColors(options.beadColors)
      const shown = options.letters
      if (shown) providePaletteLetters({ letters: computed(() => harness.currentProject()?.paletteLetters ?? {}), shown, setShown: (on) => (shown.value = on), setLetter: palette.setLetter })
      return () => h(component, props)
    },
  })
  const wrapper = mount(Host, options.attachTo ? { attachTo: options.attachTo } : {})
  return { wrapper, harness, palette, requestRemove, requestRemoveAll }
}
