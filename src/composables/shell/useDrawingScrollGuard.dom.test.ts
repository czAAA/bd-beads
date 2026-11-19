import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useDrawingScrollGuard } from './useDrawingScrollGuard'

/** A box in the drawing area moved by the browser, as a focus or a key leaves it. */
function scroll(box: Element, top: number, left = 0) {
  box.scrollTop = top
  box.scrollLeft = left
  box.dispatchEvent(new Event('scroll'))
}

describe('useDrawingScrollGuard', () => {
  let wrapper: ReturnType<typeof mount>
  const box = (testid: string) => wrapper.get(`[data-testid="${testid}"]`).element

  beforeEach(() => {
    wrapper = mount(defineComponent({
      setup() {
        const area = ref<HTMLElement>()
        useDrawingScrollGuard(area)
        return () => h('div', { ref: area, 'data-testid': 'area', style: 'overflow: hidden' }, [
          h('div', { 'data-testid': 'surface', style: 'overflow: clip' }),
          h('div', { 'data-testid': 'scroller', style: 'overflow: auto', 'data-no-scroll': '' }),
          h('div', { 'data-testid': 'list', style: 'overflow-y: auto' }),
        ])
      },
    }), { attachTo: document.body })
  })
  afterEach(() => wrapper.unmount())

  it('puts the area itself back when it is scrolled', () => {
    scroll(box('area'), 450, 30)
    expect([box('area').scrollTop, box('area').scrollLeft]).toEqual([0, 0])
  })

  it('puts back a clipping box inside it', () => {
    scroll(box('surface'), 450)
    expect(box('surface').scrollTop).toBe(0)
  })

  it('puts back a box marked as never scrolled, even one whose CSS scrolls', () => {
    scroll(box('scroller'), 120)
    expect(box('scroller').scrollTop).toBe(0)
  })

  it('leaves a list that scrolls on purpose where it was scrolled to', () => {
    scroll(box('list'), 120)
    expect(box('list').scrollTop).toBe(120)
  })
})
