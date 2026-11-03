import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useWheelTurn } from './useWheelTurn'

describe('the Homepage turned by wheel and trackpad (ticket 0784)', () => {
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

  it('turns up as it turns down', () => {
    const { turns } = turning({ at: 2 })
    gesture(-100)
    expect(turns).toEqual([1])
  })

  it('holds the page\'s scroll past the first and last section, turning nothing', () => {
    const first = turning()
    expect(gesture(-100).every((event) => event.defaultPrevented)).toBe(true)
    expect(first.turns).toEqual([])
  })

  it('leaves a pinch zoom and a sideways scroll alone', () => {
    const { turns } = turning()
    expect(wheel(400, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(wheel(400, { deltaX: 500 }).defaultPrevented).toBe(false)
    vi.advanceTimersByTime(200)
    expect(turns).toEqual([])
  })

  it('lets a section that scrolls inside itself take the wheel, and that gesture turns nothing', () => {
    const { turns } = turning()
    const inner = document.createElement('div')
    inner.style.overflowY = 'auto'
    Object.defineProperties(inner, { clientHeight: { value: 300 }, scrollHeight: { value: 400 } })
    page.appendChild(inner)
    const events = gesture(100, 3, inner)
    expect(events[0]!.defaultPrevented).toBe(false)
    // It reaches its end mid-gesture: still no turn.
    inner.scrollTop = 100
    gesture(100, 3, inner)
    expect(turns).toEqual([])
    // A new gesture after the quiet turns.
    vi.advanceTimersByTime(300)
    gesture(100, 3, inner)
    expect(turns).toEqual([1])
  })

  it('lets the page scroll itself where it scrolls freely, as past the plans', () => {
    const { turns } = turning({ at: 2, free: (event) => event.deltaY > 0 })
    expect(gesture(100).every((event) => !event.defaultPrevented)).toBe(true)
    expect(turns).toEqual([])
  })

  it('holds the rest of a gesture that turned, even where the page would scroll freely', () => {
    const { turns, section } = turning({ at: 1, free: (event) => event.deltaY > 0 && section.value === 2 })
    const events = gesture(100, 20)
    expect(turns).toEqual([2])
    expect(events.every((event) => event.defaultPrevented)).toBe(true)
  })

  it('waits a turn\'s while after a turn made any other way', async () => {
    const { turns, section } = turning()
    section.value = 1
    await nextTick()
    wheel(200)
    vi.advanceTimersByTime(200)
    expect(turns).toEqual([])
    vi.advanceTimersByTime(400)
    expect(turns).toEqual([2])
  })
})
