import { readonly, ref, watch } from 'vue'
import { canScroll } from './useSectionInput'

/** What More below needs of the Homepage: the section shown. */
export interface MoreBelowDeps {
  /** The section shown, which may scroll further than its room. */
  shown: () => HTMLElement | undefined
}

/** More below (tickets 0826, 0870; Homepage card): shows only while the section shown has more to scroll to, on every
 * device. A section that fits whole has no more below; Next says what comes after it. Follows its scroll and size. */
export function useMoreBelow({ shown }: MoreBelowDeps) {
  const shows = ref(false)
  const measure = () => {
    const room = shown()
    shows.value = !!room && canScroll(room, 1)
  }

  watch(
    shown,
    (room, _, onCleanup) => {
      measure()
      if (!room) return
      room.addEventListener('scroll', measure, { passive: true })
      // What the section holds grows and shrinks (the free list, a language, the zoom) as well as the room itself.
      const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
      for (const el of [room, ...room.children]) observer?.observe(el)
      onCleanup(() => {
        room.removeEventListener('scroll', measure)
        observer?.disconnect()
      })
    },
    { immediate: true, flush: 'post' },
  )

  return { shows: readonly(shows) }
}
