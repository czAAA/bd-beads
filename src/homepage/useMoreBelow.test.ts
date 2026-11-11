import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { FakeResizeObserver } from '../testUtils/fakeResizeObserver'
import { useMoreBelow } from './useMoreBelow'

describe('More below (tickets 0826, 0870)', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    vi.unstubAllGlobals()
    FakeResizeObserver.reset()
  })

  /** A section's room, 300 tall, holding `more` px past it. */
  function room(more: number) {
    const el = document.createElement('section')
    el.style.overflowY = 'auto'
    el.appendChild(document.createElement('div'))
    Object.defineProperties(el, { clientHeight: { configurable: true, value: 300 }, scrollHeight: { configurable: true, writable: true, value: 300 + more } })
    return el
  }

  /** More below over the section shown in `el`. */
  function moreBelow(el: HTMLElement) {
    const shown = ref(el)
    const scope = effectScope()
    scopes.push(scope)
    const made = scope.run(() => useMoreBelow({ shown: () => shown.value }))!
    return { ...made, shown }
  }

  it('is hidden on a section that fits whole, though another section comes after it (ticket 0870)', () => {
    expect(moreBelow(room(0)).shows.value).toBe(false)
  })

  it('shows on a section that scrolls further, and is gone once its end shows', () => {
    const el = room(400)
    const { shows } = moreBelow(el)
    expect(shows.value).toBe(true)
    el.scrollTop = 400
    el.dispatchEvent(new Event('scroll'))
    expect(shows.value).toBe(false)
  })

  it('follows what the section holds as it grows', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    const el = room(0)
    const { shows } = moreBelow(el)
    expect(shows.value).toBe(false)
    Object.defineProperty(el, 'scrollHeight', { value: 500 })
    FakeResizeObserver.instances[0]!.trigger(100, 500)
    expect(shows.value).toBe(true)
  })

  it('measures the section turned to', async () => {
    const { shows, shown } = moreBelow(room(400))
    shown.value = room(0)
    await nextTick()
    expect(shows.value).toBe(false)
  })
})
