import { nextTick, reactive } from 'vue'
import type { GridPosition } from '../../domain/grid'
import type { CanvasContext, ShellFrameContext } from '../../composables/shell/useAppShell'

// The ghost's hand (Homepage card, What's inside, ticket 0797): it does what a beader's hand would in the demo editor.
// It presses the editor's own controls, found by their test ids, and draws through the same handlers a press on the
// Canvas reaches, while the ghost pointer moves where that hand would be. Applied at once (a row pressed further
// down, reduced motion) it does the same with no ghost and no waits.

/** The tour stopped mid-row: the run that was playing gives up. */
export class TourStopped extends Error {
  constructor() {
    super('The tour stopped')
  }
}

/** What the ghost pointer draws: where it is in the editor's box, and the ripples its presses left. */
export interface GhostState {
  shown: boolean
  x: number
  y: number
  /** How long its next move takes, in ms. */
  moveMs: number
  ripples: { id: number; x: number; y: number }[]
}

/** The ghost pointer's state, at rest and hidden. */
export function ghostState(): GhostState {
  return reactive({ shown: false, x: 0, y: 0, moveMs: 0, ripples: [] })
}

/** What the hand works on: the demo's box and wiring. */
export interface HandDeps {
  root: HTMLElement
  shell: ShellFrameContext
  canvas: CanvasContext
  ghost: GhostState
  /** Applies at once: no ghost, no waits. */
  instant: boolean
  signal: AbortSignal
  /** `--ghost-move` and `--ghost-ripple`, in ms. */
  moveMs: number
  rippleMs: number
}

/** A control: by its test id, or found some other way. */
export type Target = string | (() => Element | null | undefined)

/** How long the hand looks for a control that its last press is still bringing in. */
const FIND_MS = 3000
/** A bead's move along a stroke, quicker than a move between controls. */
const STROKE_MS = 70
/** The quickest hop, and how a hop's time grows with its length, up to `--ghost-move`. */
const HOP_MS = 140
const HOP_MS_PER_PX = 2.4

/** A hand in the demo; every step throws `TourStopped` once the run is stopped. */
export function createHand(deps: HandDeps) {
  const { root, ghost, instant, signal } = deps
  let rippleId = 0

  function alive(): void {
    if (signal.aborted) throw new TourStopped()
  }

  /** Waits, or only lets the editor render when applied at once. */
  async function wait(ms: number): Promise<void> {
    alive()
    if (instant || ms <= 0) {
      await nextTick()
    } else {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms)
        signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
      })
    }
    alive()
  }

  /** A frame, for what the editor draws after a change. */
  async function frame(): Promise<void> {
    alive()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    alive()
  }

  /** The control, once it is there and enabled: a bar that arms itself a moment after a Selection (ticket 499) is
   * waited for, as a hand would. */
  async function find(target: Target): Promise<HTMLElement> {
    const started = performance.now()
    for (;;) {
      alive()
      const found = typeof target === 'string' ? root.querySelector(`[data-testid="${target}"]`) : target()
      if (found instanceof HTMLElement && found.getAttribute('aria-disabled') !== 'true') return found
      if (performance.now() - started > FIND_MS) throw new Error(`The tour found no ${typeof target === 'string' ? target : 'control'}`)
      await frame()
    }
  }

  /** Moves the ghost to a point on screen: over `--ghost-move`, or a short hop quicker, as a hand would. */
  async function moveTo(point: { x: number; y: number }, ms?: number): Promise<void> {
    alive()
    if (instant) return
    const box = root.getBoundingClientRect()
    const x = point.x - box.left
    const y = point.y - box.top
    const distance = Math.hypot(ghost.x - x, ghost.y - y)
    const moving = ghost.shown && distance > 0.5
    ms ??= Math.round(Math.min(deps.moveMs, Math.max(HOP_MS, distance * HOP_MS_PER_PX)))
    ghost.moveMs = ghost.shown ? ms : 0
    ghost.x = x
    ghost.y = y
    ghost.shown = true
    await wait(moving ? ms : 0)
  }

  /** Where an element's middle is on screen. */
  function middleOf(element: Element): { x: number; y: number } {
    const box = element.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }

  /** Scrolls the scroller in the editor that holds `element` so it shows, at the scroller's top or wherever is nearest;
   * never the page, which turns its sections when it scrolls. */
  function bringIntoView(element: Element, at: 'start' | 'nearest' = 'nearest'): void {
    for (let scroller = element.parentElement; scroller && scroller !== root; scroller = scroller.parentElement) {
      if (scroller.scrollHeight <= scroller.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) continue
      const room = scroller.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      if (at === 'start') scroller.scrollTop += box.top - room.top
      else if (box.top < room.top) scroller.scrollTop -= room.top - box.top
      else if (box.bottom > room.bottom) scroller.scrollTop += box.bottom - room.bottom
      return
    }
  }

  /** A ripple where the ghost pressed. */
  function ripple(): void {
    if (instant) return
    const id = ++rippleId
    ghost.ripples.push({ id, x: ghost.x, y: ghost.y })
    setTimeout(() => {
      const at = ghost.ripples.findIndex((each) => each.id === id)
      if (at >= 0) ghost.ripples.splice(at, 1)
    }, deps.rippleMs)
  }

  /** Moves to a control and presses it. */
  async function press(target: Target): Promise<HTMLElement> {
    const element = await find(target)
    bringIntoView(element)
    await moveTo(middleOf(element))
    ripple()
    element.click()
    await frame()
    return element
  }

  /** Moves to a control and presses it, doing `action` in place of its click: a button that opens the device's file
   * picker, which only a beader may open, hands the ghost's picture to the same flow the picker would. */
  async function pressWith(target: Target, action: () => unknown): Promise<void> {
    const element = await find(target)
    await moveTo(middleOf(element))
    ripple()
    await action()
    await frame()
  }

  /** Scrolls a scroller by `by` px, as a beader's wheel would, over `ms`. */
  async function scroll(target: Target, by: number, ms: number): Promise<void> {
    const element = await find(target)
    if (instant) {
      element.scrollTop += by
      return
    }
    await moveTo(middleOf(element))
    const steps = Math.max(1, Math.round(ms / 50))
    for (let step = 0; step < steps; step++) {
      element.scrollTop += by / steps
      await wait(ms / steps)
    }
  }

  /** Moves to a control, brought into view (at its scroller's top with `at`), and rests on it, its Tooltip shown, for
   * `ms`. */
  async function hover(target: Target, ms: number, at: 'start' | 'nearest' = 'nearest'): Promise<void> {
    const element = await find(target)
    bringIntoView(element, at)
    await moveTo(middleOf(element))
    if (instant) return
    const chain: Element[] = []
    for (let at: Element | null = element; at && at !== root && chain.length < 4; at = at.parentElement) chain.push(at)
    for (const each of chain) each.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await wait(ms)
    for (const each of chain) each.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
  }

  /** Where a bead is on screen, once the surface draws. */
  async function beadAt(position: GridPosition): Promise<{ x: number; y: number }> {
    for (let tries = 0; ; tries++) {
      const point = deps.canvas.surfaceProbe.value?.beadOnScreen(position)
      if (point || tries > 30) return point ?? middleOf(root)
      await frame()
    }
  }

  /** One stroke of the active tool through `cells`, in order: Paint, Fill or Erase as a beader's drag does. */
  async function stroke(cells: readonly GridPosition[]): Promise<void> {
    const [first, ...rest] = cells
    if (!first) return
    await moveTo(await beadAt(first))
    ripple()
    deps.canvas.onCellPrimaryDown(first.row, first.column, first.layer)
    for (const cell of rest) {
      await moveTo(await beadAt(cell), STROKE_MS)
      deps.canvas.onCellPrimaryMove(cell.row, cell.column, cell.layer)
    }
    deps.shell.endStroke()
    await frame()
  }

  /** A drag from one bead to another, as the Select tool's: a Selection, or the Mirror's Area. */
  async function drag(from: GridPosition, to: GridPosition): Promise<void> {
    await moveTo(await beadAt(from))
    ripple()
    deps.canvas.onCellPrimaryDown(from.row, from.column, from.layer)
    await moveTo(await beadAt(to))
    deps.canvas.onCellPrimaryMove(to.row, to.column, to.layer)
    deps.shell.endStroke()
    await frame()
  }

  /** Drags the Frame by its Move bar from one bead to another, as a beader moves it. */
  async function dragFrame(handle: Target, from: GridPosition, to: GridPosition): Promise<void> {
    const bar = await find(handle)
    const start = middleOf(bar)
    await moveTo(start)
    ripple()
    const [a, b] = [await beadAt(from), await beadAt(to)]
    deps.canvas.onFramePress({ kind: 'move' }, from)
    await moveTo({ x: start.x + b.x - a.x, y: start.y + b.y - a.y })
    deps.canvas.onFrameDrag(to)
    deps.canvas.onFrameRelease()
    await frame()
  }

  /** Hides the ghost. */
  function hide(): void {
    ghost.shown = false
  }

  return { instant, wait, frame, find, moveTo, middleOf, press, pressWith, scroll, hover, beadAt, stroke, drag, dragFrame, hide, canvas: deps.canvas, root }
}

/** The ghost's hand in a run of the tour. */
export type Hand = ReturnType<typeof createHand>
