import { vi } from 'vitest'
import { defineComponent, h, ref, type Component } from 'vue'
import { mount } from '@vue/test-utils'
import { createProject } from '../domain/project'
import { provideColorPick, provideMoveColor, provideRemoveAddedColor, provideRemoveAllAddedColors, useProjectPalette } from '../composables/tools/usePalette'
import { editHarness } from './editHarness'

/** Mounts a Palette control the way the app shell hosts it: over a Project whose Palette holds `ids`, with the real
 * Palette and Edit, moving a swatch for real, and spies for asking to remove one or all. */
export function mountWithPalette(component: Component, ids: string[], props: Record<string, unknown> = {}, options: { attachTo?: HTMLElement } = {}) {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
  const harness = editHarness({ ...base, palette: ids })
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
      return () => h(component, props)
    },
  })
  const wrapper = mount(Host, options)
  return { wrapper, harness, palette, requestRemove, requestRemoveAll }
}
