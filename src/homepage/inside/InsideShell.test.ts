import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { provideAppShell } from '../../composables/shell/useAppShell'
import { provideShellScope } from '../../composables/ui/shellScope'
import { hasProjectBeads } from '../../domain/layerBeads'
import { en } from '../../i18n/en'
import { newReferenceImage } from '../../domain/referenceImage'
import type { DemoSnapshot } from '../demoCopy'
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
  it("has no main of its own: it sits in the Homepage's (ticket 0856)", () => {
    const { wrapper } = demo()
    expect(wrapper.find('[data-testid="app-canvas"]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
  })

  it('opens Ring, the demo\'s own, with nothing drawn', () => {
    const { wired } = demo()
    expect(wired.canvas.activeProject.value?.layers[0].name).toBe('Ring')
    expect(wired.panels.projects.value.map((project) => project.layers[0].name)).toEqual(['Ring', 'Heart', 'Bracelet'])
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

  /** The demo editor with the ghost's hand, applying at once. */
  function editorWithHand(props: { expand?: 'expand' | 'collapse' } = {}) {
    const wrapper = mount(InsideEditor, { props, attachTo: document.body })
    mounted.push(wrapper)
    const vm = wrapper.vm as unknown as {
      hand: (instant: boolean, signal: AbortSignal) => { press: (target: string) => Promise<unknown> }
      snapshot: () => Promise<DemoSnapshot | undefined>
    }
    const wired = () => (wrapper.findComponent(InsideShell).vm as unknown as { wired: Wired }).wired
    return { wrapper, vm, wired, hand: vm.hand(true, new AbortController().signal) }
  }

  /** Whether an element is inert, by its own attribute or a box it lies in. */
  const isInert = (element: Element) => element.closest('[inert]') !== null

  describe('only to watch (ticket 0879)', () => {
    it('is inert all through but Expand, the page\'s own control, which still works', async () => {
      const { wrapper } = editorWithHand({ expand: 'expand' })
      await flushPromises()
      for (const id of ['strip-menu', 'strip-project', 'strip-frame', 'app-drawing-area', 'tool-pill']) {
        const found = wrapper.find(`[data-testid="${id}"]`)
        if (found.exists()) expect(isInert(found.element), id).toBe(true)
      }
      const expand = wrapper.get('[data-testid="strip-expand"]')
      expect(isInert(expand.element)).toBe(false)
      await expand.trigger('click')
      expect(wrapper.emitted('toggleExpand')).toHaveLength(1)
    })

    it('takes no key pressed on Expand, the one thing in it that can have the focus', async () => {
      const { wrapper, wired } = editorWithHand({ expand: 'expand' })
      await flushPromises()
      wrapper.get('[data-testid="strip-expand"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
      expect(wired().dialogRegistry.open.value).toBeUndefined()
    })

    it("lets the ghost's press open its Menu, inert like the rest", async () => {
      const { wrapper, hand } = editorWithHand()
      await hand.press('strip-menu')
      await flushPromises()
      const newProject = wrapper.find('[data-testid="menu-new-project"]')
      expect(newProject.exists()).toBe(true)
      expect(isInert(newProject.element)).toBe(true)
    })

    it('closes nothing the ghost opened on a press in the box, Expand\'s or any other', async () => {
      const { wrapper, hand } = editorWithHand({ expand: 'expand' })
      await hand.press('strip-menu')
      await flushPromises()
      for (const id of ['app-canvas', 'strip-expand']) {
        wrapper.get(`[data-testid="${id}"]`).element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
        await flushPromises()
        expect(wrapper.find('[data-testid="menu-new-project"]').exists(), id).toBe(true)
      }
    })
  })

  describe('Open editor from here takes what the demo shows (ticket 0879)', () => {
    it("takes the Project on its Canvas with its reference image's picture, never the demo's others", async () => {
      const { vm, wired } = editorWithHand()
      await flushPromises()
      const ring = wired().canvas.activeProject.value!
      const picture = new Blob(['feather'], { type: 'image/webp' })
      const shown = { ...ring, id: 'shown', referenceImage: newReferenceImage({ name: 'feather.webp', type: 'image/webp', width: 4, height: 2, bytes: 7 }, { x: 0, y: 0, width: 40, height: 20 }) }
      wired().canvas.onImportProjects([shown], new Map([['shown', picture]]))
      wired().panels.activeProjectId.value = 'shown'
      await flushPromises()

      const taken = await vm.snapshot()
      expect(taken?.project.id).toBe('shown')
      expect(taken?.picture).toBe(picture)
    })

    it('takes no picture for a Project without a reference image', async () => {
      const { vm, wired } = editorWithHand()
      await flushPromises()
      const taken = await vm.snapshot()
      expect(taken?.project).toBe(wired().canvas.activeProject.value)
      expect(taken?.picture).toBeUndefined()
    })
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
