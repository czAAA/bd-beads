import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useSectionInput } from './useSectionInput'

describe('the Homepage turned by wheel, swipe and keys (tickets 0784, 0801)', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  let page: HTMLElement
  let room: HTMLElement
  beforeEach(() => {
    vi.useFakeTimers()
    page = document.createElement('div')
    room = document.createElement('div')
    page.appendChild(room)
    document.body.appendChild(page)
  })
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  /** Three sections, the shown one drawn in `room`; turns are noted and made at once. */
  function turning(options: { at?: number; held?: () => boolean } = {}) {
    const section = ref(options.at ?? 0)
    const turns: number[] = []
    const scope = effectScope()
    scopes.push(scope)
    const made = scope.run(() =>
      useSectionInput({
        section,
        count: () => 3,
        page: () => page,
        shown: () => room,
        held: options.held ?? (() => false),
        reducedMotion: ref(false),
        turn: (index) => {
          turns.push(index)
          section.value = index
        },
      }),
    )!
    page.addEventListener('wheel', made.onWheel)
    page.addEventListener('touchstart', made.onTouchStart)
    page.addEventListener('touchend', made.onTouchEnd)
    page.addEventListener('keydown', made.onKeydown)
    return { ...made, turns, section }
  }

  /** `room` taller than its room by `more` px, scrolled `top` down. */
  function tall(more: number, top = 0) {
    room.style.overflowY = 'auto'
    Object.defineProperties(room, { clientHeight: { configurable: true, value: 300 }, scrollHeight: { configurable: true, value: 300 + more } })
    room.scrollTop = top
    room.scrollBy = vi.fn() as typeof room.scrollBy
  }

  /** A wheel event over `target`, as the browser sends it. */
  function wheel(delta: number, init: WheelEventInit = {}, target: Element = room) {
    const event = new WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }

  /** A scroll: `count` wheels of `delta`, 20ms apart, then the quiet that ends it. */
  function scroll(delta: number, count = 3, target: Element = room) {
    const events: WheelEvent[] = []
    for (let index = 0; index < count; index += 1) {
      events.push(wheel(delta, {}, target))
      vi.advanceTimersByTime(20)
    }
    vi.advanceTimersByTime(700)
    return events
  }

  /** A finger moving `up` px up the screen (down the page) and `across` px sideways over `target`. */
  function swipe(up: number, across = 0, target: Element = room) {
    const at = (y: number, x: number) => ({ clientX: x, clientY: y, identifier: 0, target }) as unknown as Touch
    target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [at(400, 100)] }))
    target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [at(400 - up, 100 + across)] }))
    vi.advanceTimersByTime(700)
  }

  function key(key: string, init: KeyboardEventInit = {}, target: Element = page) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    vi.advanceTimersByTime(700)
    return event
  }

  describe('by wheel and trackpad', () => {
    it('turns on the first scroll, however slow the notch, both ways', () => {
      const { turns } = turning({ at: 1 })
      expect(wheel(4).defaultPrevented).toBe(true)
      expect(turns).toEqual([2])
      vi.advanceTimersByTime(1000)
      wheel(-4)
      expect(turns).toEqual([2, 1])
    })

    it('turns one section a scroll: its momentum turns nothing more and scrolls nothing', () => {
      const { turns } = turning()
      expect(scroll(100, 40).every((event) => event.defaultPrevented)).toBe(true)
      expect(turns).toEqual([1])
    })

    it('turns a scroll that comes before the last turn has stood its while once it has', () => {
      const { turns } = turning()
      wheel(100)
      expect(turns).toEqual([1])
      vi.advanceTimersByTime(400)
      wheel(100)
      expect(turns).toEqual([1])
      vi.advanceTimersByTime(200)
      expect(turns).toEqual([1, 2])
    })

    it('waits a turn\'s while after a turn made any other way, and the gesture going on through it turns nothing', async () => {
      const { turns, section } = turning()
      wheel(4)
      expect(turns).toEqual([1])
      section.value = 2
      await nextTick()
      vi.advanceTimersByTime(400)
      wheel(4)
      vi.advanceTimersByTime(1000)
      expect(turns).toEqual([1])
    })

    it('turns nothing past the first and last section, and holds the scroll there', () => {
      const first = turning()
      expect(scroll(-100).every((event) => event.defaultPrevented)).toBe(true)
      expect(first.turns).toEqual([])
    })

    it('leaves a pinch zoom, a sideways scroll and a scroll under the Menu alone', () => {
      let held = false
      const { turns } = turning({ held: () => held })
      expect(wheel(400, { ctrlKey: true }).defaultPrevented).toBe(false)
      expect(wheel(400, { deltaX: 500 }).defaultPrevented).toBe(false)
      held = true
      vi.advanceTimersByTime(400)
      expect(wheel(400).defaultPrevented).toBe(false)
      expect(turns).toEqual([])
    })

    it('scrolls a section taller than its room to its end first; the scroll that reaches it turns nothing, the next does', () => {
      const { turns } = turning()
      tall(100)
      expect(wheel(60).defaultPrevented).toBe(false)
      room.scrollTop = 100
      expect(wheel(60).defaultPrevented).toBe(true)
      vi.advanceTimersByTime(700)
      expect(turns).toEqual([])
      wheel(60)
      expect(turns).toEqual([1])
    })

    it('turns up from a tall section once it is back at its top', () => {
      const { turns } = turning({ at: 2 })
      tall(500, 40)
      expect(scroll(-40, 1)[0]!.defaultPrevented).toBe(false)
      room.scrollTop = 0
      scroll(-40, 1)
      expect(turns).toEqual([1])
    })
  })

  describe('by swipe', () => {
    it('turns one section a swipe, up the screen to the next and down to the one before', () => {
      const { turns } = turning({ at: 1 })
      swipe(120)
      expect(turns).toEqual([2])
      swipe(-120)
      expect(turns).toEqual([2, 1])
    })

    it('turns nothing on a tap, a short drag or a sideways swipe', () => {
      const { turns } = turning()
      swipe(0)
      swipe(30)
      swipe(80, 200)
      expect(turns).toEqual([])
    })

    it('turns nothing on a swipe that scrolled a section taller than its room, even to its end', () => {
      const { turns } = turning()
      tall(100)
      swipe(200)
      expect(turns).toEqual([])
      room.scrollTop = 100
      swipe(200)
      expect(turns).toEqual([1])
    })

    it('leaves a swipe in the demo editor to the editor', () => {
      const { turns } = turning()
      const editor = document.createElement('div')
      editor.className = 'inside-editor'
      room.appendChild(editor)
      swipe(200, 0, editor)
      expect(turns).toEqual([])
    })
  })

  describe('by keys', () => {
    it('turns with the arrows, Page Up, Page Down and Space, and goes to the ends with Home and End', () => {
      const { turns } = turning()
      key('ArrowDown')
      key('PageUp')
      key(' ')
      key(' ', { shiftKey: true })
      key('End')
      key('Home')
      expect(turns).toEqual([1, 0, 1, 0, 2, 0])
    })

    it('scrolls a section taller than its room first, then turns', () => {
      const { turns } = turning()
      tall(100)
      key('PageDown')
      expect(room.scrollBy).toHaveBeenCalledWith({ top: 255, behavior: 'smooth' })
      room.scrollTop = 100
      key('PageDown')
      expect(turns).toEqual([1])
    })

    it('leaves the keys to a text field, a list the arrows move in, the demo editor, a pressed button and a shortcut', () => {
      const { turns } = turning()
      for (const [tag, attribute, value] of [['textarea'], ['div', 'role', 'tablist'], ['div', 'class', 'inside-editor']] as const) {
        const el = document.createElement(tag)
        if (attribute) el.setAttribute(attribute, value!)
        room.appendChild(el)
        expect(key('ArrowDown', {}, el).defaultPrevented).toBe(false)
      }
      const button = document.createElement('button')
      room.appendChild(button)
      expect(key(' ', {}, button).defaultPrevented).toBe(false)
      expect(key('ArrowDown', { metaKey: true }).defaultPrevented).toBe(false)
      expect(turns).toEqual([])
      expect(key('ArrowDown', {}, button).defaultPrevented).toBe(true)
      expect(turns).toEqual([1])
    })

    it('turns no faster than a turn\'s while when a key is held', () => {
      const { turns, onKeydown } = turning()
      for (let index = 0; index < 10; index += 1) {
        onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', repeat: index > 0, cancelable: true }))
        vi.advanceTimersByTime(30)
      }
      expect(turns).toEqual([1])
    })
  })
})
