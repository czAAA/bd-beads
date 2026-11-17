import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Toast } from '../../composables/ui/useToasts'
import ToastRegion from './ToastRegion.vue'

const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top }) as DOMRect
const saved: Toast = { id: 'saved-file', text: 'Saved: sunflower.png', tone: 'success', stamp: 1 }

/** The canvas box with the toasts in it, and an open panel over their corner (the Export panel). */
function mountInBox(props: { clearOfPanel: boolean }) {
  const panel = document.body.appendChild(document.createElement('div'))
  panel.className = 'app-panel app-panel--dropdown'
  panel.getBoundingClientRect = () => rect(620, 144, 984, 400)
  const toasts = ref<Toast[]>([])
  const wrapper = mount({ render: () => h('div', { class: 'box' }, [h(ToastRegion, { toasts: toasts.value, ...props })]) }, { attachTo: document.body })
  const region = wrapper.get('[data-testid="toast-region"]').element as HTMLElement
  region.getBoundingClientRect = () => rect(560, 160, 984, 220)
  region.parentElement!.getBoundingClientRect = () => rect(0, 100, 1000, 900)
  /** The saved-file toast shows, as after a press in the panel. */
  async function show() {
    toasts.value = [saved]
    await nextTick()
    await nextTick()
  }
  return { wrapper, region, show }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ToastRegion (ticket 0859)', () => {
  it('drops the toasts under an open panel over their corner', async () => {
    const { wrapper, region, show } = mountInBox({ clearOfPanel: true })
    await show()

    expect(region.classList).toContain('toast-region--below-panel')
    expect(region.style.getPropertyValue('--toasts-below')).not.toBe('')
    wrapper.unmount()
  })

  it('keeps its place with no panel open', async () => {
    const { wrapper, region, show } = mountInBox({ clearOfPanel: false })
    await show()

    expect(region.classList).not.toContain('toast-region--below-panel')
    wrapper.unmount()
  })

  it('puts two actions on their own line under the text, each running its own and closing the toast (ticket 0935)', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const toast: Toast = { id: 'frame-stays', text: 'The Canvas is Loom now.', tone: 'info', stamp: 2, action: { label: 'Change the Frame too', run: first }, secondAction: { label: 'Open Frame', run: second } }
    const wrapper = mount(ToastRegion, { props: { toasts: [toast] }, attachTo: document.body })
    const line = wrapper.get('.app-message__text .toast-region__actions')
    expect(line.findAll('button').map((button) => button.text())).toEqual(['Change the Frame too', 'Open Frame'])
    expect(wrapper.find('.app-message__actions').exists()).toBe(false)
    await wrapper.get('[data-testid="toast-second-action"]').trigger('click')
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    expect(wrapper.emitted('dismiss')).toEqual([['frame-stays']])
    wrapper.unmount()
  })

  it('draws an action with an address as a link, which closes the toast as it leaves (ticket 1048)', async () => {
    const reload = vi.fn()
    const toast: Toast = { id: 'update-ready', text: 'Update ready', tone: 'info', stamp: 3, action: { label: 'Reload', run: reload }, secondAction: { label: "What's new", href: '/homepage/#whats-new', run: vi.fn() } }
    const wrapper = mount(ToastRegion, { props: { toasts: [toast] }, attachTo: document.body })
    const link = wrapper.get('a[data-testid="toast-second-action"]')
    expect(link.attributes('href')).toBe('/homepage/#whats-new')
    expect(link.text()).toBe("What's new")
    link.element.addEventListener('click', (event) => event.preventDefault())
    await link.trigger('click')
    expect(reload).not.toHaveBeenCalled()
    expect(wrapper.emitted('dismiss')).toEqual([['update-ready']])
    wrapper.unmount()
  })

  it('draws "Update ready"\'s Version and what it brings after the name, and plain text otherwise (ticket 1048)', () => {
    const update: Toast = { id: 'update-ready', text: 'Update ready', tone: 'info', stamp: 4, update: { version: '2.2.0', note: { kind: 'new', line: 'A new thing' } } }
    const wrapper = mount(ToastRegion, { props: { toasts: [update, saved] }, attachTo: document.body })
    expect(wrapper.get('[data-testid="update-ready"] [data-testid="update-version"]').text()).toBe('2.2.0')
    expect(wrapper.get('[data-testid="saved-file"] .app-message__text').text()).toBe('Saved: sunflower.png')
    wrapper.unmount()
  })
})
