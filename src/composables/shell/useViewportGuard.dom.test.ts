import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useViewportGuard } from './useViewportGuard'

const scrollTo = vi.fn()
const visualViewport = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, scale: 1 })

/** A page moved off the origin, as Safari leaves it after a focus or a gesture it took over. */
function moveView({ scrollY = 0, offsetTop = 0, scale = 1 }: { scrollY?: number; offsetTop?: number; scale?: number }) {
  vi.stubGlobal('scrollY', scrollY)
  Object.assign(visualViewport, { offsetTop, scale })
}

describe('useViewportGuard', () => {
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('visualViewport', visualViewport)
    moveView({})
    wrapper = mount(defineComponent({ setup: () => useViewportGuard(), render: () => h('div', [h('input')]) }), { attachTo: document.body })
  })
  afterEach(() => {
    const focused = document.activeElement
    if (focused instanceof HTMLElement) focused.blur()
    wrapper.unmount()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    scrollTo.mockClear()
  })

  it('puts a scrolled page back at the origin', () => {
    moveView({ scrollY: 40 })
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(1)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('puts back a visual viewport that stayed panned after the keyboard closed', () => {
    moveView({ offsetTop: 120 })
    window.visualViewport?.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(400)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('leaves the view alone while a field has focus, where the browser moves it on purpose', () => {
    wrapper.get('input').element.focus()
    moveView({ scrollY: 40 })
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(1)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('puts the page back once a field has lost focus and the keyboard has gone', () => {
    const input = wrapper.get('input').element
    input.focus()
    moveView({ scrollY: 40 })
    input.blur()
    vi.advanceTimersByTime(400)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('stops watching when it is unmounted', () => {
    wrapper.unmount()
    moveView({ scrollY: 40 })
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(1)
    expect(scrollTo).not.toHaveBeenCalled()
    wrapper = mount(defineComponent({ render: () => h('div') }), { attachTo: document.body })
  })

  it('leaves a page zoom alone: panning a zoomed page is not being lost', () => {
    moveView({ offsetTop: 120, scale: 2 })
    window.visualViewport?.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(1)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does nothing when the view is at the origin', () => {
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(1)
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
