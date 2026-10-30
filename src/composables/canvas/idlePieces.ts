import { ref } from 'vue'
import type { BeadMap } from '../../domain/canvas'
import type { GridPosition } from '../../domain/grid'
import { numericKey, piecesInSteps, type WalkedPieces } from '../../domain/pieces'
import { rowCycle, type Weave } from '../../domain/weave'

// The Pieces of a layer too big to walk on open or in a press (ticket 0716), walked a step at a time in idle moments:
// the Saved Projects list's count and the rulers' Piece boxes come in once a walk is done.

/** Bumped when a walk is done, so a computed that asked re-runs. */
const finished = ref(0)

interface Walk {
  beads: BeadMap
  cycle: number
  anchors: string
  steps: Generator<undefined, WalkedPieces>
}

/** What each set of beads walked to, with the cycle and anchors it was walked for. */
const walked = new WeakMap<BeadMap, { cycle: number; anchors: string; result: WalkedPieces }>()
/** The walk each asker is waiting for; a later ask of the same asker replaces it (an edit made new beads). */
const waiting = new Map<string, Walk>()
let scheduled = false

/** The most one idle moment walks for, whatever the browser offers, so a press right after never waits on a walk. */
const SLICE_MS = 8
const FALLBACK_DELAY_MS = 50
/** How long the asking must have stopped (an edit asks again with its new beads) before a walk starts: edits in a row
 * walk nothing until the person pauses. */
const QUIET_MS = 1000
let quietUntil = 0

function whenIdle(work: (timeLeft: () => number) => void): void {
  const sliced = (offered: () => number) => {
    const until = performance.now() + SLICE_MS
    work(() => Math.min(offered(), until - performance.now()))
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback((deadline) => sliced(() => deadline.timeRemaining()))
  } else {
    setTimeout(() => sliced(() => Infinity), FALLBACK_DELAY_MS)
  }
}

function runSome(timeLeft: () => number): void {
  scheduled = false
  const wait = quietUntil - performance.now()
  if (wait > 0) {
    scheduled = true
    setTimeout(() => whenIdle(runSome), wait)
    return
  }
  // At least one step a moment, so a browser that reports no time left still gets through.
  let stepped = false
  for (const [asker, walk] of waiting) {
    while (!stepped || timeLeft() > 1) {
      stepped = true
      const step = walk.steps.next()
      if (!step.done) continue
      walked.set(walk.beads, { cycle: walk.cycle, anchors: walk.anchors, result: step.value })
      waiting.delete(asker)
      finished.value += 1
      break
    }
    if (timeLeft() <= 1) break
  }
  schedule()
}

function schedule(): void {
  if (scheduled || waiting.size === 0) return
  scheduled = true
  whenIdle(runSome)
}

/** The Pieces of `beads`, and the Piece each of `anchors` lies on, once walked; undefined until then, a walk started
 * in idle time for `asker` (one walk at a time per asker). Read in a computed, it re-runs once the walk is done. */
export function piecesWhenIdle(asker: string, beads: BeadMap, weave: Weave, anchors: readonly GridPosition[] = []): WalkedPieces | undefined {
  void finished.value
  const cycle = rowCycle(weave)
  const anchorKey = anchors.map(numericKey).join(',')
  const known = walked.get(beads)
  if (known && known.cycle === cycle && known.anchors === anchorKey) return known.result
  const current = waiting.get(asker)
  if (!current || current.beads !== beads || current.cycle !== cycle || current.anchors !== anchorKey) {
    waiting.set(asker, { beads, cycle, anchors: anchorKey, steps: piecesInSteps(beads, weave, anchors) })
    quietUntil = performance.now() + QUIET_MS
    schedule()
  }
  return undefined
}
