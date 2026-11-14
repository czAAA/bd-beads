import { nextTick, reactive } from 'vue'
import type { GridPosition } from '../../domain/grid'
import type { CanvasContext, ShellFrameContext } from '../../composables/shell/useAppShell'
import { easeStandard } from '../../rendering/rowMotion'

// The ghost's hand (Homepage card, What's inside, ticket 0797): it presses the demo editor's own controls and draws
// through the handlers a press on the Canvas reaches, the ghost pointer moving where a beader's hand would. Applied at
// once (a row pressed further down, reduced motion) it does the same with no ghost and no waits.

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
  /** While its click is being dispatched: the press is the ghost's, not the beader's (ticket 0841). */
  pressing: boolean
}

/** The ghost pointer's state, at rest and hidden. */
export function ghostState(): GhostState {
  return reactive({ shown: false, x: 0, y: 0, moveMs: 0, ripples: [], pressing: false })
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
  /** `--ghost-pause`, `--ghost-drag` and `--ghost-drag-hold`, in ms, and `--ghost-room`, in px (ticket 0820). */
  pauseMs: number
  dragMs: number
  dragHoldMs: number
  roomPx: number
}

/** A control: by its test id, or found some other way. */
export type Target = string | (() => Element | null | undefined)

/** How long the hand looks for a control that its last press is still bringing in. */
const FIND_MS = 3000
/** A bead's move along a stroke, quicker than a move between controls. The ghost's pace is twice its first (ticket 0802),
 * as `--ghost-move` is. */
const STROKE_MS = 140
/** How far up from a control its Tooltip's trigger may sit. */
const TOOLTIP_DEPTH = 4
/** The quickest hop, and how a hop's time grows with its length, up to `--ghost-move`. */
const HOP_MS = 280
const HOP_MS_PER_PX = 4.8
/** What counts as a panel, popover, menu or dialog: on a control in one the ghost rests `--ghost-pause` before it
 * presses, so the beader sees what is pressed. */
const PANEL = '.app-panel, .color-popover, .margin-sheet, .convert-page__step, [role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]'
/** A scroll that brings a control into view, eased as `--ease-standard`: its time grows with its length, within these. */
const SCROLL_MS = { least: 200, most: 450, perPx: 1.2 }
/** How many times the hand follows a control that moved under it before it presses, and how far it may be off it. */
const AIM_TRIES = 4
const AIM_SLACK_PX = 3
/** The most frames the hand waits for a control to stop moving. */
const STEADY_FRAMES = 45
/** How near a scroller's top a sticky header counts as stuck there, in px. */
const STUCK_SLACK_PX = 2

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

  /** After a press or a stroke: a frame while the ghost plays, so the beader sees each change; applied at once only the
   * render, since a control that needs time to appear is waited for where it is looked for (ticket 0802). */
  async function settle(): Promise<void> {
    if (!instant) return frame()
    alive()
    await nextTick()
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

  /** Lets the clock pass the millisecond the control was found in: Vue drops an event stamped no later than its
   * listener was attached, so a press on a dialog's button the moment it appeared was lost (ticket 0924). It waits on a
   * timer: the build drops an empty busy loop, and with it the wait. */
  async function pastTheMillisecond(): Promise<void> {
    const found = Date.now()
    do await new Promise<void>((resolve) => setTimeout(resolve, 1))
    while (Date.now() <= found)
    alive()
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

  /** The middle of the part of an element that shows: inside every scroller or clip round it, and the demo's box. */
  function visibleMiddleOf(element: Element): { x: number; y: number } {
    const box = element.getBoundingClientRect()
    let [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom]
    // A menu or picker in the top layer is clipped by none of its ancestors, only by the demo's box the ghost is drawn in.
    let lifted = false
    for (let up = element.parentElement; up; up = up.parentElement) {
      const style = getComputedStyle(up)
      if (up === root || (!lifted && /(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY))) {
        const clip = up.getBoundingClientRect()
        ;[left, top, right, bottom] = [Math.max(left, clip.left), Math.max(top, clip.top), Math.min(right, clip.right), Math.min(bottom, clip.bottom)]
        if (!lifted && up !== root) top = belowStuck(up, element, top)
      }
      if (up === root) break
      lifted ||= up.matches(':popover-open')
    }
    return right > left && bottom > top ? { x: (left + right) / 2, y: (top + bottom) / 2 } : middleOf(element)
  }

  /** The top of a scroller's room past any sticky header stuck across `top` (one not round `element`). */
  function belowStuck(scroller: Element, element: Element, top: number): number {
    for (const header of scroller.querySelectorAll('*')) {
      if (header.contains(element) || getComputedStyle(header).position !== 'sticky') continue
      const edge = header.getBoundingClientRect()
      if (edge.top <= top + STUCK_SLACK_PX && edge.bottom > top) top = edge.bottom
    }
    return top
  }

  /** The bottom of a scroller's room above any sticky foot stuck across `bottom` (the converter's Create Project foot). */
  function aboveStuck(scroller: Element, element: Element, bottom: number): number {
    for (const foot of scroller.querySelectorAll('*')) {
      if (foot.contains(element) || getComputedStyle(foot).position !== 'sticky') continue
      const edge = foot.getBoundingClientRect()
      if (edge.bottom >= bottom - STUCK_SLACK_PX && edge.top < bottom) bottom = edge.top
    }
    return bottom
  }

  /** Waits until an element stops moving (a bar or a panel still sliding in), a few frames at most. */
  async function steady(element: Element): Promise<void> {
    if (instant) return
    let last = ''
    for (let frames = 0; frames < STEADY_FRAMES; frames++) {
      const box = element.getBoundingClientRect()
      const now = [box.left, box.top, box.width, box.height].map(Math.round).join()
      if (now === last) return
      last = now
      await frame()
      await frame()
    }
  }

  /** Scrolls each scroller in the editor round `element`, innermost first, so all of it shows, `--ghost-room` clear where
   * there is room, between sticky headers and feet: at the top with `at` or when taller than the room, else nearest. Smoothly while
   * the ghost plays; never the page, which turns its sections when it scrolls. */
  async function bringIntoView(element: Element, at: 'start' | 'nearest' = 'nearest'): Promise<void> {
    for (let scroller = element.parentElement; scroller && scroller !== root; scroller = scroller.parentElement) {
      if (scroller.scrollHeight > scroller.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) await scrollToShow(scroller, element, at)
    }
  }

  /** One scroller's part of `bringIntoView`. */
  async function scrollToShow(scroller: Element, element: Element, at: 'start' | 'nearest'): Promise<void> {
    // Twice: a sticky header sticks only once the scroll has passed it, and may then cover the control's top.
    for (let pass = 0; pass < 2; pass++) {
      const room = scroller.getBoundingClientRect()
      const box = root.getBoundingClientRect()
      const top = belowStuck(scroller, element, Math.max(room.top, box.top))
      const bottom = aboveStuck(scroller, element, Math.min(room.bottom, box.bottom))
      const target = element.getBoundingClientRect()
      const margin = Math.min(deps.roomPx, Math.max(0, (bottom - top - target.height) / 2))
      let by = 0
      if (at === 'start' || target.height > bottom - top || target.top < top + margin) by = target.top - (top + margin)
      else if (target.bottom > bottom - margin) by = target.bottom - (bottom - margin)
      const from = scroller.scrollTop
      const to = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, from + by))
      if (Math.abs(to - from) < 1) return
      if (instant) {
        scroller.scrollTop = to
        continue
      }
      const ms = Math.min(SCROLL_MS.most, Math.max(SCROLL_MS.least, Math.abs(to - from) * SCROLL_MS.perPx))
      const started = performance.now()
      for (let done = 0; done < 1; ) {
        done = Math.min(1, (performance.now() - started) / ms)
        scroller.scrollTop = from + (to - from) * easeStandard(done)
        if (done < 1) await frame()
      }
      await frame()
    }
  }

  /** Brings a control into view and moves the ghost onto the part of it that shows, once it has stopped moving; rests a
   * moment on one in a panel; follows it if it moved meanwhile, so what is pressed is always under the ghost. */
  async function aimAt(element: Element, at: 'start' | 'nearest' = 'nearest'): Promise<void> {
    await steady(element)
    await bringIntoView(element, at)
    await steady(element)
    await moveTo(visibleMiddleOf(element))
    if (instant) return
    if (element.closest(PANEL)) await wait(deps.pauseMs)
    for (let tries = 0; tries < AIM_TRIES; tries++) {
      await steady(element)
      const box = root.getBoundingClientRect()
      const middle = visibleMiddleOf(element)
      if (Math.hypot(middle.x - (box.left + ghost.x), middle.y - (box.top + ghost.y)) <= AIM_SLACK_PX) return
      await bringIntoView(element, at)
      await moveTo(visibleMiddleOf(element))
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
    await aimAt(element)
    ripple()
    if (instant) await pastTheMillisecond()
    ghost.pressing = true
    try {
      element.click()
    } finally {
      ghost.pressing = false
    }
    await settle()
    return element
  }

  /** Moves to a control and presses it, doing `action` in place of its click: a button that opens the device's file
   * picker, which only a beader may open, hands the ghost's picture to the same flow the picker would. */
  async function pressWith(target: Target, action: () => unknown): Promise<void> {
    const element = await find(target)
    await aimAt(element)
    ripple()
    await action()
    await settle()
  }

  /** Scrolls a scroller by `by` px, as a beader's wheel would, over `ms`. */
  async function scroll(target: Target, by: number, ms: number): Promise<void> {
    const element = await find(target)
    if (instant) {
      element.scrollTop += by
      return
    }
    await steady(element)
    await moveTo(visibleMiddleOf(element))
    const steps = Math.max(1, Math.round(ms / 50))
    for (let step = 0; step < steps; step++) {
      element.scrollTop += by / steps
      await wait(ms / steps)
    }
  }

  /** Moves to a control, brought into view (at its scroller's top with `at`), and rests on it, its Tooltip shown, for
   * `ms`. */
  async function hover(target: Target, ms: number, at: 'start' | 'nearest' = 'nearest'): Promise<void> {
    // Applied at once a rest shows nothing, so nothing is waited for.
    if (instant) return alive()
    const element = await find(target)
    await aimAt(element, at)
    // The Tooltip's own element is the control or one of its nearest wrappers.
    const chain: Element[] = []
    for (let up: Element | null = element; up && up !== root && chain.length < TOOLTIP_DEPTH; up = up.parentElement) chain.push(up)
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

  /** Moves the ghost over a bead; applied at once there is no ghost, so the bead isn't looked for. */
  async function moveToBead(position: GridPosition, ms?: number): Promise<void> {
    alive()
    if (!instant) await moveTo(await beadAt(position), ms)
  }

  /** One stroke of the active tool through `cells`, in order: Paint, Fill or Erase as a beader's drag does, `ms` from a
   * bead to the next. */
  async function stroke(cells: readonly GridPosition[], ms = STROKE_MS): Promise<void> {
    const [first, ...rest] = cells
    if (!first) return
    await moveToBead(first)
    ripple()
    deps.canvas.onCellPrimaryDown(first.row, first.column, first.layer)
    for (const cell of rest) {
      await moveToBead(cell, ms)
      deps.canvas.onCellPrimaryMove(cell.row, cell.column, cell.layer)
    }
    deps.shell.endStroke()
    await settle()
  }

  /** One stroke of the active tool through `cells` with no ghost move and no wait, the ghost resting where it is: what a
   * row lets appear at once rather than draws (ticket 0949). */
  function lay(cells: readonly GridPosition[]): void {
    alive()
    const [first, ...rest] = cells
    if (!first) return
    deps.canvas.onCellPrimaryDown(first.row, first.column, first.layer)
    for (const cell of rest) deps.canvas.onCellPrimaryMove(cell.row, cell.column, cell.layer)
    deps.shell.endStroke()
  }

  /** A drag from one bead to another, as the Select tool's: a Selection, or the Mirror's Area. The ghost rests on the
   * first bead, then the Selection grows bead by bead behind it, and rests whole a moment, so the beader sees what is
   * selected. */
  async function drag(from: GridPosition, to: GridPosition): Promise<void> {
    await moveToBead(from)
    await wait(deps.pauseMs)
    ripple()
    deps.canvas.onCellPrimaryDown(from.row, from.column, from.layer)
    if (instant) {
      deps.canvas.onCellPrimaryMove(to.row, to.column, to.layer)
    } else {
      const steps = Math.max(1, Math.abs(to.row - from.row), Math.abs(to.column - from.column))
      for (let step = 1; step <= steps; step++) {
        const at = { ...to, row: Math.round(from.row + ((to.row - from.row) * step) / steps), column: Math.round(from.column + ((to.column - from.column) * step) / steps) }
        await moveToBead(at, Math.round(deps.dragMs / steps))
        deps.canvas.onCellPrimaryMove(at.row, at.column, at.layer)
      }
    }
    deps.shell.endStroke()
    await settle()
    await wait(deps.dragHoldMs)
  }

  /** Drags the Frame by its Move bar from one bead to another, as a beader moves it. */
  async function dragFrame(handle: Target, from: GridPosition, to: GridPosition): Promise<void> {
    const bar = await find(handle)
    await aimAt(bar)
    const start = visibleMiddleOf(bar)
    ripple()
    deps.canvas.onFramePress({ kind: 'move' }, from)
    if (!instant) {
      const [a, b] = [await beadAt(from), await beadAt(to)]
      await moveTo({ x: start.x + b.x - a.x, y: start.y + b.y - a.y })
    }
    deps.canvas.onFrameDrag(to)
    deps.canvas.onFrameRelease()
    await settle()
  }

  /** Hides the ghost. */
  function hide(): void {
    ghost.shown = false
  }

  return { instant, wait, frame, find, moveTo, middleOf, press, pressWith, scroll, hover, beadAt, stroke, lay, drag, dragFrame, hide, canvas: deps.canvas, root }
}

/** The ghost's hand in a run of the tour. */
export type Hand = ReturnType<typeof createHand>
