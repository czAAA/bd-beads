import { vi } from 'vitest'
import { defineComponent, h, ref, type Component } from 'vue'
import { mount } from '@vue/test-utils'
import { createProject } from '../domain/createProject'
import { provideColorPick, provideMoveColor, provideRemoveAddedColor, provideRemoveAllAddedColors, useProjectPalette } from '../composables/tools/usePalette'
import { provideBeadColors, type BeadColors } from '../composables/palette/useBeadColors'
import { editHarness } from './editHarness'

/** Mounts a Palette control the way the app shell hosts it: over a Project whose Palette holds `ids`, with the real
 * Palette and Edit, moving a swatch for real, and spies for asking to remove one or all. */
export function mountWithPalette(component: Component, ids: string[], props: Record<string, unknown> = {}, options: { attachTo?: HTMLElement; codes?: Record<string, string>; beadColors?: BeadColors } = {}) {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
  const harness = editHarness({ ...base, palette: ids, ...(options.codes ? { paletteCodes: options.codes } : {}) })
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
      return () => h(component, props)
    },
  })
  const wrapper = mount(Host, options.attachTo ? { attachTo: options.attachTo } : {})
  return { wrapper, harness, palette, requestRemove, requestRemoveAll }
}
