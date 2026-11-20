import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { rowProgressPosition, shownWayOf } from '../domain/rowProgress'
import { en } from '../i18n/en'
import { rowProgressAnnouncement } from '../i18n/rowProgressWords'
import { useWovenCuff } from './useWovenCuff'

const STEP_MS = 1400
const HOLD_MS = 2800
const PASSES = 24

/** The cuff as the Welcome tile runs it, with the card's timing; `shown` and reduced motion as a test sets them. */
function cuff({ reduced = false, shown = true } = {}) {
  const scope = effectScope()
  const visible = ref(shown)
  const announce = vi.fn()
  const woven = scope.run(() =>
    useWovenCuff({ timing: () => ({ stepMs: STEP_MS, holdMs: HOLD_MS, passes: PASSES }), reducedMotion: () => reduced, shown: () => visible.value, announce, messages: () => en }),
  )!
  const done = () => rowProgressPosition(woven.project.value).current
  return { woven, done, announce, visible, stop: () => scope.stop() }
}

describe('the cuff woven on the Welcome tile (ticket 1157)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is the peacock cuff with Row progress on, its rows running left to right, no pass done yet', () => {
    const { woven, done, stop } = cuff()
    expect(shownWayOf(woven.project.value)).toBe('right')
    expect(done()).toBe(0)
    expect(rowProgressPosition(woven.project.value).total).toBe(95)
    stop()
  })

  it('marks a pass done every step, as Row done does, up to its last pass, rests, then starts again from the first', async () => {
    const { woven, done, stop } = cuff()
    vi.advanceTimersByTime(STEP_MS)
    expect(done()).toBe(1)
    // Each step is a press of Row done, so the ring, pill and fill glide as they do in the editor.
    expect(woven.rowPress.value).toMatchObject({ done: true, from: 0, to: 1 })
    vi.advanceTimersByTime(STEP_MS * (PASSES - 1))
    expect(done()).toBe(PASSES)
    vi.advanceTimersByTime(HOLD_MS - 1)
    expect(done()).toBe(PASSES)
    vi.advanceTimersByTime(1)
    expect(done()).toBe(0)
    // Back to the first pass is a jump: nothing glides back across the cuff.
    expect(woven.rowPress.value).toBeUndefined()
    vi.advanceTimersByTime(STEP_MS)
    expect(done()).toBe(1)
    await nextTick()
    stop()
  })

  it('weaves only while its section is shown', () => {
    const { done, visible, stop } = cuff({ shown: false })
    vi.advanceTimersByTime(STEP_MS * 3)
    expect(done()).toBe(0)
    visible.value = true
    return nextTick().then(() => {
      vi.advanceTimersByTime(STEP_MS)
      expect(done()).toBe(1)
      visible.value = false
      return nextTick().then(() => {
        vi.advanceTimersByTime(STEP_MS * 3)
        expect(done()).toBe(1)
        stop()
      })
    })
  })

  it("steps as Row done and Back a row do, and the first press stops the weaving for the visit", () => {
    const { woven, done, stop } = cuff()
    vi.advanceTimersByTime(STEP_MS * 2)
    woven.moveRow(1)
    expect(done()).toBe(3)
    woven.moveRow(-1)
    expect(done()).toBe(2)
    vi.advanceTimersByTime(STEP_MS * 10)
    expect(done()).toBe(2)
    stop()
  })

  it('never goes past the last of its passes, nor back past the first', () => {
    const { woven, done, stop } = cuff()
    woven.moveRow(-1)
    expect(done()).toBe(0)
    for (let press = 0; press < PASSES + 3; press++) woven.moveRow(1)
    expect(done()).toBe(PASSES)
    stop()
  })

  it("says each pass a press reaches in the counter's words, and nothing while it weaves by itself", () => {
    const { woven, announce, stop } = cuff()
    vi.advanceTimersByTime(STEP_MS * 4)
    expect(announce).not.toHaveBeenCalled()
    woven.moveRow(1)
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenLastCalledWith(rowProgressAnnouncement(en.rowProgress, woven.project.value))
    expect(announce).toHaveBeenLastCalledWith('Pass 6 of 95, row 4')
    stop()
  })

  it('under reduced motion shows 6 passes done and never weaves by itself, though a press still steps it', () => {
    const { woven, done, stop } = cuff({ reduced: true })
    expect(done()).toBe(6)
    vi.advanceTimersByTime(STEP_MS * 5)
    expect(done()).toBe(6)
    woven.moveRow(1)
    expect(done()).toBe(7)
    stop()
  })

  it('stops weaving once its scope ends', () => {
    const { done, stop } = cuff()
    stop()
    vi.advanceTimersByTime(STEP_MS * 3)
    expect(done()).toBe(0)
  })
})
