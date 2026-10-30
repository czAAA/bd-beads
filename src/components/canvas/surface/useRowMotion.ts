import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import type { Project } from '../../../domain/project'
import { rowProgressPosition } from '../../../domain/rowProgress'
import type { RowPress } from '../../../composables/project/useRowOps'
import type { RowMotion } from '../../../rendering/overlayRenderer'
import { PATTERN_DONE_MS, ROW_MOTION, easeOut } from '../../../rendering/rowMotion'
import { reducedMotion } from './useSurfaceOverlay'

/** A press being played, and the frame time it started at: the first frame's own, as rAF's clock is not always
 * performance.now()'s. */
interface Playing {
  press: RowPress
  start?: number
}

/** The longest a pass glints: its last bead starts within the span. */
const GLINT_MS = ROW_MOTION.glintSpan + ROW_MOTION.glint

/** How long a press moves something: its glint, the marker's glide, and Pattern done. */
function playsFor({ done, patternDone }: RowPress): number {
  const glint = done ? GLINT_MS : 0
  return Math.max(glint, ROW_MOTION.glide, patternDone ? ROW_MOTION.patternDoneDelay + PATTERN_DONE_MS : 0)
}

/** When the finished passes start back to full color after the press that marks the last one. */
const RESTORE_AT = ROW_MOTION.patternDoneDelay + ROW_MOTION.restoreDelay

/** What the Pattern plays after a press of Row done or Row not done (ticket 0730; Motion section, Row progress):
 * everything here keys off `rowPress`, never off the pointer, so opening a Project, Undo or Redo play nothing. A frame
 * loop runs while something moves and stops when nothing does; under reduced motion nothing plays. */
export function useRowMotion(deps: {
  props: { project: Project; rowPress?: RowPress }
  /** The beads' canvas, and the one its dimmed look is copied to while Pattern done brings the finished passes back. */
  beads: Ref<HTMLCanvasElement | undefined>
  fade: Ref<HTMLCanvasElement | undefined>
  /** What moves the drawing under a copy of it: the view and its size. */
  view: () => unknown
}) {
  const { props } = deps
  const playing = shallowRef<readonly Playing[]>([])
  /** The frame time of the last frame drawn. */
  const now = ref(0)
  let frame: number | undefined

  function stop(): void {
    playing.value = []
    if (frame !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    frame = undefined
  }

  function step(time: number): void {
    for (const item of playing.value) item.start ??= time
    now.value = time
    const left = playing.value.filter((item) => time - item.start! < playsFor(item.press))
    if (left.length !== playing.value.length) playing.value = left
    frame = left.length > 0 ? requestAnimationFrame(step) : undefined
  }

  watch(
    () => props.rowPress,
    (press) => {
      if (!press || reducedMotion() || typeof requestAnimationFrame !== 'function') {
        stop()
        return
      }
      // Row done's glints still going play on under the next; Row not done ends them and Pattern done.
      playing.value = [...(press.done ? playing.value.filter((item) => item.press.done && !item.press.patternDone) : []), { press }]
      frame ??= requestAnimationFrame(step)
    },
  )
  onBeforeUnmount(stop)

  /** The ms since a press started playing; none before its first frame. The clock is read first: a start is set by the
   * frame that also moves it, so what reads this follows both. */
  const since = (item: Playing) => {
    const time = now.value
    return item.start === undefined ? undefined : time - item.start
  }
  const latest = computed(() => playing.value.at(-1))

  /** The glints and the marker's glide, for the overlay. */
  const rowMotion = computed<RowMotion | undefined>(() => {
    const glints = playing.value.flatMap((item) => {
      const elapsed = since(item)
      return item.press.done && elapsed !== undefined && elapsed < GLINT_MS ? [{ pass: item.press.from, elapsed }] : []
    })
    const last = latest.value
    const elapsed = last && since(last)
    const glide = elapsed !== undefined && elapsed < ROW_MOTION.glide ? { from: last!.press.from, elapsed } : undefined
    // Nothing to draw leaves it unchanged, so Pattern done's long tail doesn't redraw the overlay each frame.
    return glints.length > 0 || glide ? { glints, glide } : undefined
  })

  /** Which press Pattern done is playing for, from its start to its end, so a second one starts afresh; none else. */
  const patternDone = computed(() => {
    const last = latest.value
    const elapsed = last?.press.patternDone ? since(last) : undefined
    if (elapsed === undefined) return undefined
    const own = elapsed - ROW_MOTION.patternDoneDelay
    return own >= 0 && own < PATTERN_DONE_MS ? last!.press.id : undefined
  })

  /** Whether the finished passes keep the finished look though every pass is done: until Pattern done's shimmer. */
  const holdingDim = computed(() => {
    const last = latest.value
    if (!last?.press.patternDone) return false
    const elapsed = since(last)
    return elapsed === undefined || elapsed < RESTORE_AT
  })

  /** Whether every pass is done: the finished passes are then at full color (Motion section), Pattern done or not. */
  const allDone = computed(() => {
    const { current, total } = rowProgressPosition(props.project)
    return total > 0 && current >= total
  })

  // As the shimmer starts the beads are drawn at full color; a copy of them as they were, dimmed, fades out over them.
  const copied = ref(false)
  watch(
    holdingDim,
    (holding, held) => {
      const [beads, fade] = [deps.beads.value, deps.fade.value]
      if (holding || !held || !beads || !fade || playing.value.length === 0) return
      fade.width = beads.width
      fade.height = beads.height
      // Laid where the beads' canvas lies, past the drawing area in the draft look or moved by a zoom.
      for (const key of ['left', 'top', 'width', 'height', 'transform', 'transformOrigin'] as const) fade.style[key] = beads.style[key]
      fade.getContext('2d')?.drawImage(beads, 0, 0)
      copied.value = true
    },
    { flush: 'sync' },
  )
  // The copy lies only where the drawing was: a move of the view takes it away.
  watch(deps.view, () => (copied.value = false))
  watch(playing, (now) => {
    if (now.length === 0) copied.value = false
  })
  /** How much of the dimmed copy still shows over the restored beads. */
  const fadeOpacity = computed(() => {
    const last = latest.value
    const elapsed = last && since(last)
    if (!copied.value || elapsed === undefined) return 0
    return 1 - easeOut(Math.min(1, (elapsed - RESTORE_AT) / ROW_MOTION.restore))
  })

  return { rowMotion, patternDone, finishedRestored: computed(() => allDone.value && !holdingDim.value), fadeOpacity }
}
