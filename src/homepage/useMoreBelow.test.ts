import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { FakeResizeObserver } from '../testUtils/fakeResizeObserver'
import { useMoreBelow } from './useMoreBelow'

describe('More below (ticket 0826)', () => {
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

  /** More below over three sections, the one at `at` shown in `el`. */
  function moreBelow(el: HTMLElement, options: { at?: number; phone?: boolean } = {}) {
    const section = ref(options.at ?? 0)
    const shown = ref(el)
    const scope = effectScope()
    scopes.push(scope)
    const made = scope.run(() => useMoreBelow({ section, count: () => 3, shown: () => shown.value, phone: () => options.phone ?? false }))!
    return { ...made, section, shown }
  }

  it('shows on a section with one after it, with no fade while the section has no more', () => {
    const { shows, continues } = moreBelow(room(0))
    expect(shows.value).toBe(true)
    expect(continues.value).toBe(false)
  })

  it('fades while the section scrolls on, and is gone on the last section once its end shows', () => {
    const el = room(400)
    const { shows, continues } = moreBelow(el, { at: 2 })
    expect([shows.value, continues.value]).toEqual([true, true])
    el.scrollTop = 400
    el.dispatchEvent(new Event('scroll'))
    expect([shows.value, continues.value]).toEqual([false, false])
  })

  it('follows what the section holds as it grows', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    const el = room(0)
    const { shows } = moreBelow(el, { at: 2 })
    expect(shows.value).toBe(false)
    Object.defineProperty(el, 'scrollHeight', { value: 500 })
    FakeResizeObserver.instances[0]!.trigger(100, 500)
    expect(shows.value).toBe(true)
  })

  it('measures the section turned to, and leaves the one turned from', async () => {
    const first = room(400)
    const { continues, shown } = moreBelow(first)
    shown.value = room(0)
    await nextTick()
    expect(continues.value).toBe(false)
    first.dispatchEvent(new Event('scroll'))
    expect(continues.value).toBe(false)
  })

  it('on a phone shows only while the section scrolls on', () => {
    expect(moreBelow(room(0), { phone: true }).shows.value).toBe(false)
    expect(moreBelow(room(400), { phone: true }).shows.value).toBe(true)
  })
})
