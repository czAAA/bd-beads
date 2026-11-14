import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { CanvasContext, ShellFrameContext } from '../../composables/shell/useAppShell'
import type { GridPosition } from '../../domain/grid'
import { createHand, ghostState } from './hand'

/** A hand playing (not at once) on a Canvas whose beads sit 10px apart, the Select tool's handlers recorded in order. */
function playingHand({ dragHoldMs = 0 } = {}) {
  const calls: string[] = []
  const ended: number[] = []
  const at = (kind: string) => (row: number, column: number) => void calls.push(`${kind} ${row},${column}`)
  const canvas = {
    onCellPrimaryDown: at('down'),
    onCellPrimaryMove: at('move'),
    surfaceProbe: ref({ beadOnScreen: ({ row, column }: GridPosition) => ({ x: column * 10, y: row * 10 }) }),
  } as unknown as CanvasContext
  const shell = { endStroke: () => void (calls.push('end'), ended.push(performance.now())) } as unknown as ShellFrameContext
  const hand = createHand({
    root: document.createElement('div'),
    shell,
    canvas,
    ghost: ghostState(),
    instant: false,
    signal: new AbortController().signal,
    moveMs: 0,
    rippleMs: 0,
    pauseMs: 0,
    dragMs: 0,
    dragHoldMs,
    roomPx: 24,
  })
  return { hand, calls, ended }
}

beforeEach(() => {
  if (typeof requestAnimationFrame === 'undefined') {
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => setTimeout(() => run(0), 0))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  }
})

afterEach(() => vi.unstubAllGlobals())

describe("What's inside's hand: a Selection's drag (ticket 0820)", () => {
  it('grows the Selection bead by bead behind the ghost, the longer side a bead a step', async () => {
    const { hand, calls } = playingHand()
    await hand.drag({ row: 0, column: 0 }, { row: 2, column: 4 })
    expect(calls).toEqual(['down 0,0', 'move 1,1', 'move 1,2', 'move 2,3', 'move 2,4', 'end'])
  })

  it('holds the whole Selection before the ghost moves on', async () => {
    const { hand, ended } = playingHand({ dragHoldMs: 120 })
    await hand.drag({ row: 0, column: 0 }, { row: 0, column: 1 })
    expect(performance.now() - ended[0]).toBeGreaterThanOrEqual(115)
  })
})

describe("What's inside's hand: a press applied at once (ticket 0924)", () => {
  afterEach(() => vi.useRealTimers())

  it("presses only once the clock has passed the millisecond it found the control in, waiting on a timer the build can't drop", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
    const root = document.createElement('div')
    const button = document.createElement('button')
    button.dataset.testid = 'confirm'
    const clicked = vi.fn()
    button.addEventListener('click', clicked)
    root.append(button)
    const hand = createHand({
      root,
      shell: {} as ShellFrameContext,
      canvas: {} as CanvasContext,
      ghost: ghostState(),
      instant: true,
      signal: new AbortController().signal,
      moveMs: 0,
      rippleMs: 0,
      pauseMs: 0,
      dragMs: 0,
      dragHoldMs: 0,
      roomPx: 24,
    })
    const pressed = hand.press('confirm')
    // The clock stands still: a press now would be stamped in the millisecond a dialog's button was attached in.
    await vi.advanceTimersByTimeAsync(0)
    expect(clicked).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await pressed
    expect(clicked).toHaveBeenCalledOnce()
  })
})
