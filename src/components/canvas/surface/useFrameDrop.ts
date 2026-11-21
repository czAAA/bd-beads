import { onBeforeUnmount, ref, shallowRef, watch, type Ref, type StyleValue } from 'vue'
import { reducedMotion } from './useSurfaceOverlay'

/** How long Remove frame's drop fades the Frame's sheet off its beads: `--duration-base`. */
const FRAME_DROP_MS = 200

/** What Remove frame's drop plays from: the count of drops, the Frame surface's canvases as they last drew it (its
 * beads, then its sheet and marks over them), the canvas the copy is drawn on and the style that laid the surface. */
export interface FrameDropDeps {
  drops: () => number | undefined
  layers: () => readonly (HTMLCanvasElement | undefined)[]
  copy: Ref<HTMLCanvasElement | undefined>
  style: () => StyleValue
}

/** Remove frame's second motion (ticket 1189), keyed off the confirmation, never the Project: a copy of the Frame's
 * surface, still showing it lined up as the drop comes, fades out over the Canvas that now holds its beads in the same
 * places, over FRAME_DROP_MS. None under reduced motion. */
export function useFrameDrop(deps: FrameDropDeps) {
  const dropping = ref(false)
  /** The copy's opacity: 1 as it is taken, 0 once it fades. */
  const opacity = ref(1)
  /** Where the copy lies: the Frame surface's box as the drop found it. */
  const style = shallowRef<StyleValue>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let frame: number | undefined

  function stop(): void {
    clearTimeout(timer)
    if (frame !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    frame = undefined
    dropping.value = false
  }

  watch(
    deps.drops,
    (count, before) => {
      const copy = deps.copy.value
      const [first] = deps.layers()
      if (count === undefined || count === before || !copy || !first || reducedMotion() || typeof requestAnimationFrame !== 'function') return stop()
      stop()
      copy.width = first.width
      copy.height = first.height
      for (const key of ['left', 'top', 'width', 'height'] as const) copy.style[key] = first.style[key]
      const context = copy.getContext('2d')
      context?.clearRect(0, 0, copy.width, copy.height)
      for (const layer of deps.layers()) if (layer && layer.width > 0 && layer.height > 0) context?.drawImage(layer, 0, 0, copy.width, copy.height)
      style.value = deps.style()
      opacity.value = 1
      dropping.value = true
      // The copy shows as taken for one frame, then fades.
      frame = requestAnimationFrame(() => {
        frame = undefined
        opacity.value = 0
        timer = setTimeout(stop, FRAME_DROP_MS)
      })
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(stop)

  return { dropping, opacity, style }
}
