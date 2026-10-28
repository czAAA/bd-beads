import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, type Component } from 'vue'
import { provideAppShell } from '../composables/shell/useAppShell'
import type { OpenPanel } from '../composables/shell/openPanel'

/** Mounts parts of the shell (AppPanels, AppDialogs) under the app's real wiring and nothing else of the App, so a
 * part's wiring, a control reaching its flow, is tested there and not in an App test (ticket 0618). Hands back the
 * wrapper and the wired contexts, to open a panel or answer for a part that isn't mounted (the strip's Undo). */
export function mountShellParts(...parts: Component[]) {
  let wired!: ReturnType<typeof provideAppShell>
  const Host = defineComponent({
    setup() {
      wired = provideAppShell()
      return () => parts.map((part) => h(part))
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  /** Opens a panel as its strip button would. */
  async function openPanel(panel: OpenPanel) {
    wired.panels.openPanel.value = panel
    await nextTick()
  }
  return { wrapper, openPanel, ...wired }
}
