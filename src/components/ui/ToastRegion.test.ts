import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
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
  return { region, show }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ToastRegion (ticket 0859)', () => {
  it('drops the toasts under an open panel over their corner', async () => {
    const { region, show } = mountInBox({ clearOfPanel: true })
    await show()

    expect(region.classList).toContain('toast-region--below-panel')
    expect(region.style.getPropertyValue('--toasts-below')).toBe('300px')
  })

  it('keeps its place with no panel open', async () => {
    const { region, show } = mountInBox({ clearOfPanel: false })
    await show()

    expect(region.classList).not.toContain('toast-region--below-panel')
  })
})
