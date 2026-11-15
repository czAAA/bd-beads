import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { drawFrameTurn, FRAME_TURN_MS } from '../../../rendering/frameTurn'
import { easeStandard } from '../../../rendering/rowMotion'
import { reducedMotion } from './useSurfaceOverlay'
import type { Box } from '../../../domain/weaveGeometry'

/** What the Frame's turn plays from: the count of Rotate Frame presses, the beads' canvas and the canvas the turn is
 * drawn on, the box the Frame lies in as drawn now, its paper, and what moves the drawing under a copy of it. */
export interface FrameTurnDeps {
  turns: () => number | undefined
  beads: Ref<HTMLCanvasElement | undefined>
  copy: Ref<HTMLCanvasElement | undefined>
  frameBox: () => Box | undefined
  paper: () => string
  view: () => unknown
}

/** Rotate Frame seen turning (ticket 1016): keyed off the press, never off the Project, so Undo, Redo and opening a
 * Project jump. As the press comes the beads' canvas still shows the Frame as it was (it draws on the next frame), so a
 * copy of it is taken then and turned over the new drawing for FRAME_TURN_MS. Under reduced motion nothing plays. */
export function useFrameTurn(deps: FrameTurnDeps) {
  const turning = ref(false)
  /** The Frame's box as the beads' canvas last drew it: what the copy taken at a press shows it at. */
  let shown: Box | undefined
  watch(deps.frameBox, (box) => (shown = box), { immediate: true, flush: 'post' })

  let playing: { image: HTMLCanvasElement; from: Box; start?: number } | undefined
  let frame: number | undefined

  function stop(): void {
    playing = undefined
    turning.value = false
    if (frame !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    frame = undefined
  }

  function step(time: number): void {
    const [beads, copy] = [deps.beads.value, deps.copy.value]
    const context = copy?.getContext('2d')
    if (!playing || !beads || !copy || !context) return stop()
    playing.start ??= time
    const elapsed = time - playing.start
    if (elapsed >= FRAME_TURN_MS) return stop()
    const width = parseFloat(beads.style.width) || beads.clientWidth || beads.width
    drawFrameTurn(context, {
      image: playing.image,
      from: playing.from,
      to: deps.frameBox(),
      paper: deps.paper(),
      progress: easeStandard(elapsed / FRAME_TURN_MS),
      origin: { x: parseFloat(beads.style.left) || 0, y: parseFloat(beads.style.top) || 0 },
      ratio: beads.width / width,
      bitmap: copy,
    })
    frame = requestAnimationFrame(step)
  }

  watch(
    deps.turns,
    (count, before) => {
      const [beads, copy] = [deps.beads.value, deps.copy.value]
      if (count === undefined || count === before || !beads || !copy || !shown || reducedMotion() || typeof requestAnimationFrame !== 'function') return stop()
      const image = document.createElement('canvas')
      image.width = beads.width
      image.height = beads.height
      image.getContext('2d')?.drawImage(beads, 0, 0)
      copy.width = beads.width
      copy.height = beads.height
      for (const key of ['left', 'top', 'width', 'height'] as const) copy.style[key] = beads.style[key]
      playing = { image, from: shown }
      turning.value = true
      frame ??= requestAnimationFrame(step)
    },
    { flush: 'sync' },
  )
  // The copy lies only where the drawing was: a move of the view ends the turn.
  watch(deps.view, stop)
  onBeforeUnmount(stop)

  return { turning }
}
