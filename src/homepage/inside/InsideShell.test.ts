import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { provideAppShell } from '../../composables/shell/useAppShell'
import { provideShellScope } from '../../composables/ui/shellScope'
import { hasProjectBeads } from '../../domain/layerBeads'
import { en } from '../../i18n/en'
import InsideEditor from './InsideEditor.vue'
import InsideShell from './InsideShell.vue'
import { demoLibrary } from './demoProjects'

type Wired = ReturnType<typeof provideAppShell>

/** Everything this browser keeps, to see that nothing done in the demo reaches it. */
function stored(): Record<string, string | null> {
  return Object.fromEntries(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)!).map((key) => [key, localStorage.getItem(key)]))
}

const mounted: { unmount: () => void }[] = []

/** The demo's shell in its box, as What's inside mounts it. */
function demo() {
  const box = ref<HTMLElement>()
  const Box = defineComponent({
    setup() {
      provideShellScope({ root: () => box.value, teleportTo: '.inside-editor' })
      return () => h('div', { ref: box, class: 'inside-editor' }, [h(InsideShell, { projects: demoLibrary(en) })])
    },
  })
  const wrapper = mount(Box, { attachTo: document.body })
  mounted.push(wrapper)
  const shell = wrapper.findComponent(InsideShell)
  return { wrapper, shell, wired: (shell.vm as unknown as { wired: Wired }).wired }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  // The page project's DOM draws no frames: the editor's own waits for one get a timer.
  if (typeof requestAnimationFrame === 'undefined') {
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => setTimeout(() => run(0), 0))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  }
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe("What's inside's demo editor (ticket 0797)", () => {
  it('opens Kaleidoscope, the demo\'s own, with nothing drawn', () => {
    const { wired } = demo()
    expect(wired.canvas.activeProject.value?.layers[0].name).toBe('Kaleidoscope')
    expect(wired.panels.projects.value.map((project) => project.layers[0].name)).toEqual(['Kaleidoscope', 'Heart', 'Bracelet'])
  })

  it("never lets an edit, an export choice or a Menu press reach the beader's library or preferences", async () => {
    const before = stored()
    const { wrapper, wired } = demo()

    wired.canvas.onSelectTool('paint')
    wired.canvas.onSelectCustomColor('#e63746')
    wired.canvas.onCellPrimaryDown(4, 4)
    wired.shell.endStroke()
    await nextTick()
    expect(hasProjectBeads(wired.canvas.activeProject.value!)).toBe(true)

    // The export quality chosen in the Frame panel of the demo's Heart.
    wired.panels.activeProjectId.value = wired.panels.projects.value.find((project) => project.layers[0].name === 'Heart')!.id
    await nextTick()
    wired.canvas.onToggleFramePanel()
    await flushPromises()
    await wrapper.get('[data-testid="quality-stop-high"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="strip-frame"]').trigger('click')

    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await flushPromises()

    expect(stored()).toEqual(before)
  })

  it('empties the demo Canvas from its Menu\'s New Project, with no form', async () => {
    const { wrapper } = demo()
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(InsideShell).emitted('startAfresh')).toHaveLength(1)
    expect(wrapper.find('[data-testid="new-project-form"]').exists()).toBe(false)
  })

  it('takes keys only while the focus is in its box', async () => {
    const { wrapper, wired } = demo()
    const outside = document.body.appendChild(document.createElement('button'))
    outside.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(wired.dialogRegistry.open.value).toBeUndefined()

    wrapper.get('[data-testid="strip-menu"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(wired.dialogRegistry.open.value).toBe('shortcuts')
  })
  it('is a region named "What\'s inside: the editor", its ghost hidden from screen readers', () => {
    const wrapper = mount(InsideEditor, { attachTo: document.body })
    mounted.push(wrapper)
    const region = wrapper.get('[data-testid="inside-editor"]')
    expect(region.attributes('role')).toBe('region')
    expect(region.attributes('aria-label')).toBe(en.homepage.inside.editor)
    expect(wrapper.get('[data-testid="inside-ghost"]').attributes('aria-hidden')).toBe('true')
  })
})
