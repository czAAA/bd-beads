import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { hasOpenLayer, useOverlayLayer } from './useOverlayLayer'

function layer(open: () => boolean, close: () => void) {
  return defineComponent({
    setup() {
      useOverlayLayer({ isOpen: open, root: () => undefined, close })
      return () => h('div')
    },
  })
}

function pressEscape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  document.body.dispatchEvent(event)
  return event
}

describe('useOverlayLayer', () => {
  it('closes only the top-most open layer, and keeps Escape from the handlers behind it', () => {
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    const behind = vi.fn()
    window.addEventListener('keydown', behind)
    mount(layer(() => true, closeBottom))
    const top = mount(layer(() => true, closeTop))

    const event = pressEscape()

    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
    expect(behind).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)

    top.unmount()
    pressEscape()
    expect(closeBottom).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', behind)
  })

  it('counts a layer only while it is open', async () => {
    const open = ref(false)
    const close = vi.fn()
    mount(layer(() => open.value, close))

    expect(hasOpenLayer()).toBe(false)
    pressEscape()
    expect(close).not.toHaveBeenCalled()

    open.value = true
    await Promise.resolve()
    expect(hasOpenLayer()).toBe(true)
    pressEscape()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('leaves other keys alone', () => {
    const close = vi.fn()
    mount(layer(() => true, close))

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)

    expect(close).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('lets go of Escape once every layer is gone', () => {
    const wrapper = mount(layer(() => true, vi.fn()))
    wrapper.unmount()

    expect(hasOpenLayer()).toBe(false)
    expect(pressEscape().defaultPrevented).toBe(false)
  })
})

describe('a press outside', () => {
  const pressOn = (target: Element, init: PointerEventInit = {}) => {
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }

  function panel(options: { close: () => void; outside?: 'close' | 'swallow'; isOpener?: (target: Element) => boolean }) {
    return defineComponent({
      setup() {
        const el = ref<HTMLElement>()
        useOverlayLayer({ isOpen: () => true, root: () => el.value, ...options })
        return () => h('div', { ref: el, class: 'panel' }, [h('button', { class: 'inside' })])
      },
    })
  }

  function page() {
    const outside = document.createElement('button')
    document.body.append(outside)
    return outside
  }

  it('closes the top-most layer only, stops the press and swallows the click, then the next press closes the one beneath', () => {
    const outside = page()
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    mount(panel({ close: closeBottom }), { attachTo: document.body })
    mount(panel({ close: closeTop }), { attachTo: document.body })
    const behind = vi.fn()
    outside.addEventListener('pointerdown', behind)
    const clicked = vi.fn()
    outside.addEventListener('click', clicked)

    const first = pressOn(outside)
    outside.click()

    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
    expect(first.defaultPrevented).toBe(true)
    expect(behind).not.toHaveBeenCalled()
    expect(clicked).not.toHaveBeenCalled()
  })

  it('leaves a press inside the layer, on its opener and on a dialog that is not a layer alone', () => {
    const outside = page()
    outside.className = 'opener'
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'alertdialog')
    document.body.append(dialog)
    const close = vi.fn()
    const wrapper = mount(panel({ close, isOpener: (target) => target.classList.contains('opener') }), { attachTo: document.body })

    pressOn(wrapper.get('.inside').element)
    pressOn(outside)
    pressOn(dialog)

    expect(close).not.toHaveBeenCalled()
  })

  it('swallows without closing when the layer demands an answer', () => {
    const close = vi.fn()
    mount(panel({ close, outside: 'swallow' }), { attachTo: document.body })

    const press = pressOn(page())

    expect(press.defaultPrevented).toBe(true)
    expect(close).not.toHaveBeenCalled()
  })

  it("ignores a pinch's second finger", () => {
    const close = vi.fn()
    mount(panel({ close }), { attachTo: document.body })

    pressOn(page(), { pointerType: 'touch', isPrimary: false })

    expect(close).not.toHaveBeenCalled()
  })
})
