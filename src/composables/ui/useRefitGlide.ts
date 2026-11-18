import { nextTick } from 'vue'
import { ownLength } from './cssZoom'

/** Where no design value loads: `--duration-base` and `--ease-out`. */
const FALLBACK = { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' }

function motion(): { duration: number; easing: string } {
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : undefined
  const duration = Number.parseFloat(style?.getPropertyValue('--duration-base') ?? '')
  const easing = style?.getPropertyValue('--ease-out').trim()
  return { duration: Number.isFinite(duration) ? duration : FALLBACK.duration, easing: easing || FALLBACK.easing }
}

/** Glides boxes from where they stood to where a re-fit puts them (ticket 0967: the converter's beads beside a tall
 * popover): `refit` changes the room, and each box moves and scales there by `transform` alone in `--duration-base` on
 * `--ease-out`, so it is laid out and drawn once. A jump under reduced motion. */
export function useRefitGlide(boxes: () => HTMLElement[]): (refit: () => void) => Promise<void> {
  const running = new Map<HTMLElement, Animation>()

  return async function glide(refit) {
    // Measured mid-glide, then stopped: a refit while one runs starts where the beads stand.
    const from = boxes().map((box) => ({ box, rect: box.getBoundingClientRect() }))
    for (const animation of running.values()) animation.cancel()
    running.clear()
    refit()
    await nextTick()
    const still = typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still) return
    const { duration, easing } = motion()
    for (const { box, rect } of from) {
      const to = box.getBoundingClientRect()
      if (!box.isConnected || typeof box.animate !== 'function' || to.width === 0) continue
      const scale = rect.width / to.width
      // Measured on screen, moved by a transform in the box's own px (ticket 1071).
      const [x, y] = [ownLength(box, rect.left - to.left), ownLength(box, rect.top - to.top)]
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(scale - 1) < 0.001) continue
      const start = { transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${scale})` }
      const animation = box.animate([start, { transformOrigin: '0 0', transform: 'none' }], { duration, easing })
      running.set(box, animation)
      animation.onfinish = () => running.delete(box)
    }
  }
}
