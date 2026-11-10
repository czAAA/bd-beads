import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { hasOpenLayer, useOverlayLayer } from './useOverlayLayer'
import { provideShellScope, type ShellScope } from './shellScope'

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

  function panel(options: { close: () => void; outside?: 'close' | 'swallow' | 'through'; isOpener?: (target: Element) => boolean }) {
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

  it('closes and lets the press go on when the layer stands aside for it (the paper tag over the canvas)', () => {
    const outside = page()
    const behind = vi.fn()
    outside.addEventListener('pointerdown', behind)
    const close = vi.fn()
    mount(panel({ close, outside: 'through' }), { attachTo: document.body })

    const press = pressOn(outside)

    expect(close).toHaveBeenCalledTimes(1)
    expect(press.defaultPrevented).toBe(false)
    expect(behind).toHaveBeenCalledTimes(1)
  })

  it("ignores a pinch's second finger", () => {
    const close = vi.fn()
    mount(panel({ close }), { attachTo: document.body })

    pressOn(page(), { pointerType: 'touch', isPrimary: false })

    expect(close).not.toHaveBeenCalled()
  })
})

describe('useOverlayLayer in a boxed shell (ticket 0797)', () => {
  /** A layer of a shell living in `box`, as the Homepage's demo editor is. */
  /** An open layer with an element of its own, in `scope` when given. */
  function rootedLayer(close: () => void, scope?: ShellScope) {
    const own = document.body.appendChild(document.createElement('div'))
    const child = defineComponent({
      setup() {
        useOverlayLayer({ isOpen: () => true, root: () => own, close })
        return () => h('div')
      },
    })
    return defineComponent({
      setup() {
        if (scope) provideShellScope(scope)
        return () => h(child)
      },
    })
  }

  function press(target: Element): PointerEvent {
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return event
  }

  it('hears presses and Escape only inside its box, and the page layer beneath hears the rest', () => {
    const box = document.body.appendChild(document.createElement('div'))
    const inside = box.appendChild(document.createElement('button'))
    const outside = document.body.appendChild(document.createElement('button'))
    const scope: ShellScope = { root: () => box, teleportTo: 'body' }
    const closePage = vi.fn()
    const closeBoxed = vi.fn()
    const page = mount(rootedLayer(closePage))
    const boxed = mount(rootedLayer(closeBoxed, scope))

    const outsidePress = press(outside)
    expect(closePage).toHaveBeenCalledTimes(1)
    expect(closeBoxed).not.toHaveBeenCalled()
    expect(outsidePress.defaultPrevented).toBe(true)

    press(inside)
    expect(closeBoxed).toHaveBeenCalledTimes(1)
    inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closeBoxed).toHaveBeenCalledTimes(2)
    expect(closePage).toHaveBeenCalledTimes(1)

    expect(hasOpenLayer()).toBe(true)
    expect(hasOpenLayer(scope)).toBe(true)
    page.unmount()
    expect(hasOpenLayer()).toBe(false)
    expect(hasOpenLayer(scope)).toBe(true)
    boxed.unmount()
    box.remove()
    outside.remove()
  })

  it("leaves a press on the page's own control in the box alone: the layer stays open and the press goes on (ticket 0830)", () => {
    const box = document.body.appendChild(document.createElement('div'))
    const own = box.appendChild(document.createElement('button'))
    const other = box.appendChild(document.createElement('button'))
    const scope: ShellScope = { root: () => box, teleportTo: 'body', pagesOwn: (target) => target === own }
    const close = vi.fn()
    const boxed = mount(rootedLayer(close, scope))

    const ownPress = press(own)
    expect(close).not.toHaveBeenCalled()
    expect(ownPress.defaultPrevented).toBe(false)

    const otherPress = press(other)
    expect(close).toHaveBeenCalledTimes(1)
    expect(otherPress.defaultPrevented).toBe(true)
    boxed.unmount()
    box.remove()
  })
})
