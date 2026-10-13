import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { usePageZoomLock } from './usePageZoomLock'

function mountLock() {
  return mount(
    defineComponent({
      setup() {
        usePageZoomLock()
      },
      render: () =>
        h('div', [h('header', { 'data-testid': 'header' }), h('div', { 'data-testid': 'project-surface' }, [h('canvas')])]),
    }),
    { attachTo: document.body },
  )
}

function fire(target: Element, event: Event): boolean {
  target.dispatchEvent(event)
  return event.defaultPrevented
}

const wheel = (init: WheelEventInit) => new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init })
const gesture = (type: string) => new Event(type, { bubbles: true, cancelable: true })

describe('usePageZoomLock', () => {
  let wrapper: ReturnType<typeof mountLock>
  afterEach(() => wrapper.unmount())

  it('cancels Ctrl/⌘ + wheel outside the canvas', () => {
    wrapper = mountLock()
    const header = wrapper.get('[data-testid="header"]').element
    expect(fire(header, wheel({ ctrlKey: true }))).toBe(true)
    expect(fire(header, wheel({ metaKey: true }))).toBe(true)
  })

  it('leaves a plain wheel outside the canvas alone, so the left column still scrolls', () => {
    wrapper = mountLock()
    expect(fire(wrapper.get('[data-testid="header"]').element, wheel({}))).toBe(false)
  })

  it('does not cancel Ctrl/⌘ + wheel over the canvas: the surface zooms the canvas with it', () => {
    wrapper = mountLock()
    expect(fire(wrapper.get('canvas').element, wheel({ ctrlKey: true }))).toBe(false)
  })

  it('cancels iOS gestures that start outside the canvas, not inside it', () => {
    wrapper = mountLock()
    const header = wrapper.get('[data-testid="header"]').element
    const canvas = wrapper.get('canvas').element
    expect(fire(header, gesture('gesturestart'))).toBe(true)
    expect(fire(header, gesture('gesturechange'))).toBe(true)
    expect(fire(canvas, gesture('gesturestart'))).toBe(false)
    expect(fire(canvas, gesture('gesturechange'))).toBe(false)
  })

  it('cancels iOS gestures over the canvas while fingers are down, so a pinch never zooms the page too', () => {
    wrapper = mountLock()
    const canvas = wrapper.get('canvas').element
    const touch = (type: string, pointerId: number) => new PointerEvent(type, { bubbles: true, pointerId, pointerType: 'touch' })
    fire(canvas, touch('pointerdown', 1))
    fire(canvas, touch('pointerdown', 2))
    expect(fire(canvas, gesture('gesturestart'))).toBe(true)
    fire(canvas, touch('pointerup', 1))
    fire(canvas, touch('pointerup', 2))
    expect(fire(canvas, gesture('gesturestart'))).toBe(false)
  })

  it('stops listening once unmounted', () => {
    wrapper = mountLock()
    const header = wrapper.get('[data-testid="header"]').element
    wrapper.unmount()
    expect(fire(header, wheel({ ctrlKey: true }))).toBe(false)
    wrapper = mountLock()
  })
})
