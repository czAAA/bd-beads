import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { hasOpenLayer, useEscapeLayer } from './useEscapeLayer'

function layer(open: () => boolean, close: () => void) {
  return defineComponent({
    setup() {
      useEscapeLayer(open, close)
      return () => h('div')
    },
  })
}

function pressEscape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  document.body.dispatchEvent(event)
  return event
}

describe('useEscapeLayer', () => {
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
