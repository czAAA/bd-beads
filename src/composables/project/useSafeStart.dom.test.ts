import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import type { OpeningNote, OpeningNoteStore } from '../../services/openingNote'
import { useSafeStart } from './useSafeStart'

/** A note kept in memory, and frames run by hand. */
function setup(left?: OpeningNote) {
  let kept = left
  const note: OpeningNoteStore = { read: () => kept, write: (next) => void (kept = next), clear: () => void (kept = undefined) }
  const frames: (() => void)[] = []
  const scope = effectScope()
  const safeStart = scope.run(() => useSafeStart({ note, nextFrame: (run) => void frames.push(run) }))!
  const runFrames = () => frames.splice(0).forEach((run) => run())
  return { safeStart, scope, noted: () => kept, runFrames }
}

let stop: (() => void) | undefined
afterEach(() => stop?.())

describe('safe start (ticket 0716)', () => {
  it('holds back the Project a note left set names, says so, and clears the note so the next load tries again', () => {
    const { safeStart, scope, noted } = setup({ id: 'p', name: 'Scarf' })
    stop = () => scope.stop()

    expect(safeStart.held).toBe('p')
    expect(safeStart.missed.value).toEqual({ id: 'p', name: 'Scarf' })
    expect(noted()).toBeUndefined()
  })

  it('notes the Project before it opens and clears the note one frame after its first drawn frame', () => {
    const { safeStart, scope, noted, runFrames } = setup()
    stop = () => scope.stop()
    const active = ref<{ id: string; name: string }>()
    scope.run(() => safeStart.follow(() => active.value))
    expect(safeStart.held).toBeUndefined()

    active.value = { id: 'p', name: 'Scarf' }
    expect(noted()).toEqual({ id: 'p', name: 'Scarf' })
    safeStart.onDrawn()
    expect(noted()).toEqual({ id: 'p', name: 'Scarf' })
    runFrames()
    expect(noted()).toBeUndefined()
  })

  it('keeps the note of a Project opened after a frame was asked for the one before', () => {
    const { safeStart, scope, noted, runFrames } = setup()
    stop = () => scope.stop()
    const active = ref<{ id: string; name: string }>({ id: 'a', name: 'A' })
    scope.run(() => safeStart.follow(() => active.value))

    safeStart.onDrawn()
    active.value = { id: 'b', name: 'B' }
    runFrames()

    expect(noted()).toEqual({ id: 'b', name: 'B' })
  })

  it('clears the note when the page goes away normally, as a frozen one cannot', () => {
    const { safeStart, scope, noted } = setup()
    stop = () => scope.stop()
    scope.run(() => safeStart.follow(() => ({ id: 'p', name: 'Scarf' })))

    window.dispatchEvent(new Event('pagehide'))

    expect(noted()).toBeUndefined()
  })
})
