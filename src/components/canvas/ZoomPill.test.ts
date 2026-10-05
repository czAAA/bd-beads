import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZoomPill from './ZoomPill.vue'

describe('ZoomPill', () => {
  it('shows the zoom level and emits out/in/fit', async () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 80 } })
    expect(wrapper.get('[data-testid="zoom-pill-level"]').text()).toBe('80%')

    await wrapper.get('[data-testid="zoom-pill-out"]').trigger('click')
    expect(wrapper.emitted('zoom-out')).toHaveLength(1)
    await wrapper.get('[data-testid="zoom-pill-in"]').trigger('click')
    expect(wrapper.emitted('zoom-in')).toHaveLength(1)
    await wrapper.get('[data-testid="zoom-pill-fit"]').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('reads rulers, undo, redo, progress bar, out, level, in, fit', () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 100, rulers: true, progressBar: true } })
    const order = wrapper.findAll('[data-testid^="zoom-pill-"]:not([role="status"])').map((element) => element.attributes('data-testid'))
    expect(order).toEqual([
      'zoom-pill-rulers',
      'zoom-pill-undo',
      'zoom-pill-redo',
      'zoom-pill-progress',
      'zoom-pill-out',
      'zoom-pill-level',
      'zoom-pill-in',
      'zoom-pill-fit',
    ])
  })

  it('disables zoom out at 10% and zoom in at 400%', () => {
    const low = mount(ZoomPill, { props: { zoomPercent: 10 } })
    expect(low.get('[data-testid="zoom-pill-out"]').attributes('disabled')).toBeDefined()
    expect(low.get('[data-testid="zoom-pill-in"]').attributes('disabled')).toBeUndefined()
    const high = mount(ZoomPill, { props: { zoomPercent: 400 } })
    expect(high.get('[data-testid="zoom-pill-in"]').attributes('disabled')).toBeDefined()
    expect(high.get('[data-testid="zoom-pill-out"]').attributes('disabled')).toBeUndefined()
  })

  it('greys Undo and Redo out at the ends of history and emits when they can act', async () => {
    const off = mount(ZoomPill, { props: { zoomPercent: 100 } })
    expect(off.get('[data-testid="zoom-pill-undo"]').attributes('disabled')).toBeDefined()
    expect(off.get('[data-testid="zoom-pill-redo"]').attributes('disabled')).toBeDefined()

    const on = mount(ZoomPill, { props: { zoomPercent: 100, canUndo: true, canRedo: true } })
    await on.get('[data-testid="zoom-pill-undo"]').trigger('click')
    await on.get('[data-testid="zoom-pill-redo"]').trigger('click')
    expect(on.emitted('undo')).toHaveLength(1)
    expect(on.emitted('redo')).toHaveLength(1)
  })

  it('shows the Progress bar toggle pressed while the bar shows, and emits on click', async () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 100, progressBar: true } })
    const toggle = wrapper.get('[data-testid="zoom-pill-progress"]')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.emitted('toggle-progress-bar')).toHaveLength(1)
  })

  describe('drag from anywhere (ticket 302)', () => {
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

    /** A pill 200 x 46 at the bottom right of a 400 x 600 area, in a layout-less DOM. */
    function mountDraggable() {
      const wrapper = mount(ZoomPill, { props: { zoomPercent: 100, corner: 'bottom-right' }, attachTo: document.body })
      const pill = wrapper.get('[data-testid="zoom-pill"]')
      Object.defineProperty(pill.element, 'offsetParent', { value: { getBoundingClientRect: () => rect(0, 0, 400, 600) } })
      ;(pill.element as HTMLElement).getBoundingClientRect = () => rect(184, 538, 200, 46)
      ;(pill.element as HTMLElement).setPointerCapture = () => {}
      return { wrapper, pill }
    }
    const pointer = (clientX: number, clientY: number) => ({ pointerId: 1, pointerType: 'touch', clientX, clientY, button: 0 })

    it('has no handle', () => {
      const { wrapper } = mountDraggable()
      expect(wrapper.find('[data-testid="zoom-pill-handle"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('moves when dragged from a button, and snaps to the nearest corner on release without pressing it', async () => {
      const { wrapper, pill } = mountDraggable()
      const fit = wrapper.get('[data-testid="zoom-pill-fit"]')
      await fit.trigger('pointerdown', pointer(360, 560))
      await fit.trigger('pointermove', pointer(-2640, -2440))
      expect(pill.attributes('style')).toContain('translate(-184px, -538px)')
      expect(pill.classes()).toContain('zoom-pill--dragging')
      await fit.trigger('pointerup', pointer(-2640, -2440))
      await fit.trigger('click')
      expect(wrapper.emitted('move')).toEqual([['top-left']])
      expect(wrapper.emitted('reset')).toBeUndefined()
      wrapper.unmount()
    })

    it('moves when dragged from a gap or the zoom level', async () => {
      const { wrapper } = mountDraggable()
      const level = wrapper.get('[data-testid="zoom-pill-level"]')
      await level.trigger('pointerdown', pointer(300, 560))
      await level.trigger('pointermove', pointer(-3000, 560))
      await level.trigger('pointerup', pointer(-3000, 560))
      expect(wrapper.emitted('move')).toEqual([['bottom-left']])
      wrapper.unmount()
    })

    it('treats a press that stays under the threshold as a tap', async () => {
      const { wrapper, pill } = mountDraggable()
      const zoomIn = wrapper.get('[data-testid="zoom-pill-in"]')
      await zoomIn.trigger('pointerdown', pointer(300, 560))
      await zoomIn.trigger('pointermove', pointer(304, 563))
      expect(pill.classes()).not.toContain('zoom-pill--dragging')
      await zoomIn.trigger('pointerup', pointer(304, 563))
      await zoomIn.trigger('click')
      expect(wrapper.emitted('zoom-in')).toHaveLength(1)
      expect(wrapper.emitted('move')).toBeUndefined()
      wrapper.unmount()
    })

    it('moves to the neighbouring corner with Alt + an arrow key from any control, and announces it', async () => {
      const { wrapper } = mountDraggable()
      const out = wrapper.get('[data-testid="zoom-pill-out"]')
      await out.trigger('keydown', { key: 'ArrowLeft', altKey: true })
      expect(wrapper.emitted('move')).toEqual([['bottom-left']])
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[data-testid="zoom-pill-announcer"]').text()).toBe('Zoom controls moved to the bottom left')
      await out.trigger('keydown', { key: 'ArrowUp', altKey: true })
      expect(wrapper.emitted('move')).toEqual([['bottom-left'], ['top-right']])
      wrapper.unmount()
    })

    it('ignores an arrow key without Alt', async () => {
      const { wrapper } = mountDraggable()
      await wrapper.get('[data-testid="zoom-pill-out"]').trigger('keydown', { key: 'ArrowLeft' })
      expect(wrapper.emitted('move')).toBeUndefined()
      wrapper.unmount()
    })
  })
})
