import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useSpaceDragPan } from './useSpaceDragPan'

/** A minimal host component: useSpaceDragPan needs a live component instance (lifecycle hooks) to run inside, same as it will in App.vue. */
function mountHost(scrollEl: HTMLElement | null = document.createElement('div')) {
  let state!: ReturnType<typeof useSpaceDragPan>
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useSpaceDragPan(ref(scrollEl))
      },
      render() {
        return h('div')
      },
    }),
  )
  return { wrapper, state: state! }
}

function keydown(init: KeyboardEventInit, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

function keyup(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, ...init }))
}

function pointer(type: string, init: { clientX: number; clientY: number }) {
  window.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }))
}

describe('useSpaceDragPan', () => {
  it('holds spaceHeld true only while Space is down', () => {
    const { state } = mountHost()

    keydown({ code: 'Space' })
    expect(state.spaceHeld.value).toBe(true)

    keyup({ code: 'Space' })
    expect(state.spaceHeld.value).toBe(false)
  })

  it('does not arm Space while typing in a form field, so a space character still types normally', () => {
    const { state } = mountHost()
    const field = document.createElement('input')
    document.body.appendChild(field)

    try {
      keydown({ code: 'Space' }, field)
      expect(state.spaceHeld.value).toBe(false)
    } finally {
      field.remove()
    }
  })

  it('does not arm Space while a button has focus, so its native Space-to-click activation still works', () => {
    const { state } = mountHost()
    const button = document.createElement('button')
    document.body.appendChild(button)

    try {
      keydown({ code: 'Space' }, button)
      expect(state.spaceHeld.value).toBe(false)
    } finally {
      button.remove()
    }
  })

  it("does not preventDefault a button-focused Space, leaving the browser's own activation intact", () => {
    mountHost()
    const button = document.createElement('button')
    document.body.appendChild(button)

    try {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Space' })
      button.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    } finally {
      button.remove()
    }
  })

  it('pans the scroll element horizontally and the window vertically while dragging with Space held', () => {
    const scrollEl = document.createElement('div')
    scrollEl.scrollLeft = 50
    const { state } = mountHost(scrollEl)
    const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})

    keydown({ code: 'Space' })
    pointer('pointerdown', { clientX: 100, clientY: 100 })
    expect(state.panning.value).toBe(true)

    pointer('pointermove', { clientX: 80, clientY: 70 })

    expect(scrollEl.scrollLeft).toBe(70) // dx = -20, scrollLeft -= dx
    expect(scrollBySpy).toHaveBeenCalledWith(0, 30) // dy = -30, scrollBy(0, -dy)

    pointer('pointerup', { clientX: 80, clientY: 70 })
    expect(state.panning.value).toBe(false)

    scrollBySpy.mockRestore()
  })

  it('never starts panning without Space held', () => {
    const { state } = mountHost()

    pointer('pointerdown', { clientX: 100, clientY: 100 })

    expect(state.panning.value).toBe(false)
  })

  it('clears spaceHeld and panning on window blur, so a lost focus mid-hold cannot strand the grab cursor', () => {
    const { state } = mountHost()

    keydown({ code: 'Space' })
    pointer('pointerdown', { clientX: 0, clientY: 0 })
    expect(state.panning.value).toBe(true)

    window.dispatchEvent(new Event('blur'))

    expect(state.spaceHeld.value).toBe(false)
    expect(state.panning.value).toBe(false)
  })

  it('stops listening once the host unmounts', () => {
    const { wrapper, state } = mountHost()
    wrapper.unmount()

    keydown({ code: 'Space' })

    expect(state.spaceHeld.value).toBe(false)
  })
})
