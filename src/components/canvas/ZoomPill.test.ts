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

  it('reads the handle, rulers, undo, redo, progress bar, out, level, in, fit', () => {
    const wrapper = mount(ZoomPill, { props: { zoomPercent: 100, rulers: true, progressBar: true } })
    const order = wrapper.findAll('[data-testid^="zoom-pill-"]').map((element) => element.attributes('data-testid'))
    expect(order).toEqual([
      'zoom-pill-handle',
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

  describe('drag handle (ticket 297)', () => {
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

    /** A pill 200 x 46 at the bottom right of a 400 x 600 area, in a layout-less DOM. */
    function mountDraggable() {
      const wrapper = mount(ZoomPill, { props: { zoomPercent: 100, corner: 'bottom-right' }, attachTo: document.body })
      const pill = wrapper.get('[data-testid="zoom-pill"]').element as HTMLElement
      Object.defineProperty(pill, 'offsetParent', { value: { getBoundingClientRect: () => rect(0, 0, 400, 600) } })
      pill.getBoundingClientRect = () => rect(184, 538, 200, 46)
      const handle = wrapper.get('[data-testid="zoom-pill-handle"]')
      ;(handle.element as HTMLElement).setPointerCapture = () => {}
      return { wrapper, handle }
    }
    const pointer = (clientX: number, clientY: number) => ({ pointerId: 1, pointerType: 'touch', clientX, clientY, button: 0 })

    it('names the handle', () => {
      const { wrapper, handle } = mountDraggable()
      expect(handle.attributes('aria-label')).toBe('Move the zoom controls')
      wrapper.unmount()
    })

    it('snaps to the nearest corner on release, without firing the pill\'s other buttons', async () => {
      const { wrapper, handle } = mountDraggable()
      await handle.trigger('pointerdown', pointer(200, 560))
      await handle.trigger('pointermove', pointer(-3000, -3000))
      expect(wrapper.get('[data-testid="zoom-pill"]').attributes('style')).toContain('translate(-184px, -538px)')
      await handle.trigger('pointerup', pointer(-3000, -3000))
      expect(wrapper.emitted('move')).toEqual([['top-left']])
      expect(wrapper.emitted('zoom-in')).toBeUndefined()
      expect(wrapper.emitted('reset')).toBeUndefined()
      wrapper.unmount()
    })

    it('moves to the neighbouring corner with an arrow key', async () => {
      const { wrapper, handle } = mountDraggable()
      await handle.trigger('keydown', { key: 'ArrowLeft' })
      await handle.trigger('keydown', { key: 'ArrowUp' })
      await handle.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.emitted('move')).toEqual([['bottom-left'], ['top-right']])
      wrapper.unmount()
    })
  })
})
