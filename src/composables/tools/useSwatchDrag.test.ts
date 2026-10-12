import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useSwatchDrag } from './useSwatchDrag'

function setup(slotAt: (x: number, y: number) => number | undefined) {
  const onMove = vi.fn()
  let drag!: ReturnType<typeof useSwatchDrag>
  const wrapper = mount(
    defineComponent({
      setup() {
        drag = useSwatchDrag(onMove, slotAt)
        return () => h('div')
      },
    }),
  )
  return { onMove, drag, wrapper }
}

const pointer = (type: string, x: number) =>
  window.dispatchEvent(Object.assign(new MouseEvent(type, { clientX: x, clientY: 0 }), { pointerId: 1 }))

describe('useSwatchDrag (ticket 398)', () => {
  it('moves from the pressed slot to the slot under the pointer on release, and swallows the click', () => {
    const { onMove, drag, wrapper } = setup((x) => (x >= 100 ? 3 : 1))
    drag.onPointerDown({ button: 0, pointerType: 'mouse', clientX: 0, clientY: 0, pointerId: 1 } as PointerEvent, 1)
    pointer('pointermove', 120)
    expect(drag.draggingFrom.value).toBe(1)
    expect(drag.hoverSlot.value).toBe(3)
    pointer('pointerup', 120)
    expect(onMove).toHaveBeenCalledWith(1, 3)
    expect(drag.consumeDrag()).toBe(true)
    expect(drag.consumeDrag()).toBe(false)
    wrapper.unmount()
  })

  it('treats a press that barely moves as a click: nothing moves, nothing is swallowed', () => {
    const { onMove, drag, wrapper } = setup(() => 2)
    drag.onPointerDown({ button: 0, pointerType: 'mouse', clientX: 0, clientY: 0, pointerId: 1 } as PointerEvent, 0)
    pointer('pointermove', 2)
    pointer('pointerup', 2)
    expect(onMove).not.toHaveBeenCalled()
    expect(drag.consumeDrag()).toBe(false)
    wrapper.unmount()
  })
})
