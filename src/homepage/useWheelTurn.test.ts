import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useWheelTurn } from './useWheelTurn'

describe('the Homepage turned by wheel and trackpad, on the second scroll (tickets 0784, 0793)', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  let page: HTMLElement
  beforeEach(() => {
    vi.useFakeTimers()
    page = document.createElement('div')
    document.body.appendChild(page)
  })
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  /** Three sections, the page's own scroll free where `free` says; turns are noted and moved to at once. */
  function turning(options: { at?: number; free?: (event: WheelEvent) => boolean } = {}) {
    const section = ref(options.at ?? 0)
    const turns: number[] = []
    const scope = effectScope()
    scopes.push(scope)
    const made = scope.run(() =>
      useWheelTurn({
        section,
        count: () => 3,
        viewport: () => 800,
        scrollsFreely: options.free ?? (() => false),
        turn: (index) => {
          turns.push(index)
          section.value = index
        },
      }),
    )!
    page.addEventListener('wheel', made.onWheel)
    return { ...made, turns, section }
  }

  /** A wheel event over `target`, as the browser sends it. */
  function wheel(delta: number, init: WheelEventInit = {}, target: Element = page) {
    const event = new WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }

  /** A gesture: `count` wheels of `delta`, 20ms apart. */
  function gesture(delta: number, count = 3, target: Element = page) {
    const events: WheelEvent[] = []
    for (let index = 0; index < count; index += 1) {
      events.push(wheel(delta, {}, target))
      vi.advanceTimersByTime(20)
    }
    vi.advanceTimersByTime(120)
    return events
  }

  /** A scroll, then the quiet that ends it. */
  function scroll(delta: number, count = 3, target: Element = page) {
    const events = gesture(delta, count, target)
    vi.advanceTimersByTime(300)
    return events
  }

  it('turns on the second scroll, however slow the notches and however long between them', () => {
    const { turns, lean } = turning()
    wheel(4)
    expect(lean.value).toBe(-8)
    vi.advanceTimersByTime(300)
    expect(turns).toEqual([])
    expect(lean.value).toBe(0)
    vi.advanceTimersByTime(5000)
    wheel(4)
    expect(turns).toEqual([1])
  })

  it('turns up as it turns down', () => {
    const { turns } = turning({ at: 2 })
    scroll(-100)
    scroll(-100)
    expect(turns).toEqual([1])
  })

  it('does not turn on a long first scroll: one gesture is one scroll', () => {
    const { turns } = turning()
    scroll(100, 30)
    expect(turns).toEqual([])
  })

  it('counts again after a scroll the other way', () => {
    const { turns } = turning({ at: 1 })
    scroll(100)
    scroll(-100)
    scroll(100)
    expect(turns).toEqual([])
    scroll(100)
    expect(turns).toEqual([2])
  })

  it('counts again on each section: the scroll that turned readies nothing, its momentum turns nothing', () => {
    const { turns } = turning()
    scroll(100)
    scroll(100, 20)
    expect(turns).toEqual([1])
    scroll(100)
    expect(turns).toEqual([1])
    scroll(100)
    expect(turns).toEqual([1, 2])
  })

  it('counts again after a turn made any other way, and waits a turn\'s while', async () => {
    const { turns, section } = turning()
    scroll(100)
    section.value = 1
    await nextTick()
    wheel(4)
    vi.advanceTimersByTime(300)
    wheel(4)
    expect(turns).toEqual([])
    vi.advanceTimersByTime(300)
    expect(turns).toEqual([2])
  })

  it('holds the page\'s scroll past the first and last section, turning nothing', () => {
    const first = turning()
    expect(scroll(-100).every((event) => event.defaultPrevented)).toBe(true)
    expect(scroll(-100).every((event) => event.defaultPrevented)).toBe(true)
    expect(first.turns).toEqual([])
  })

  it('leaves a pinch zoom and a sideways scroll alone', () => {
    const { turns } = turning()
    expect(wheel(400, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(wheel(400, { deltaX: 500 }).defaultPrevented).toBe(false)
    vi.advanceTimersByTime(400)
    expect(wheel(400, { ctrlKey: true }).defaultPrevented).toBe(false)
    vi.advanceTimersByTime(400)
    expect(turns).toEqual([])
  })

  it('scrolls a section taller than its room to its end first; the scroll that reaches it is the first', () => {
    const { turns } = turning()
    const inner = document.createElement('div')
    inner.style.overflowY = 'auto'
    Object.defineProperties(inner, { clientHeight: { value: 300 }, scrollHeight: { value: 400 } })
    page.appendChild(inner)
    expect(scroll(100, 3, inner)[0]!.defaultPrevented).toBe(false)
    // The next scroll reaches its end mid-way: no turn, the rest of it held.
    const reaching = gesture(100, 1, inner)
    inner.scrollTop = 100
    reaching.push(...scroll(100, 3, inner))
    expect(reaching.map((event) => event.defaultPrevented)).toEqual([false, true, true, true])
    expect(turns).toEqual([])
    scroll(100, 3, inner)
    expect(turns).toEqual([1])
  })

  it('lets the page scroll itself where it scrolls freely, as past the plans, and turns up once back at them', () => {
    const { turns } = turning({ at: 2, free: (event) => event.deltaY > 0 })
    expect(scroll(100).every((event) => !event.defaultPrevented)).toBe(true)
    expect(turns).toEqual([])
    scroll(-100)
    scroll(-100)
    expect(turns).toEqual([1])
  })

  it('holds the rest of a gesture that turned, even where the page would scroll freely', () => {
    const { turns, section } = turning({ at: 1, free: (event) => event.deltaY > 0 && section.value === 2 })
    scroll(100)
    const events = gesture(100, 20)
    expect(turns).toEqual([2])
    expect(events.every((event) => event.defaultPrevented)).toBe(true)
  })
})
