import { computed, readonly, ref, watch, type Ref } from 'vue'
import { canScroll } from './useSectionInput'

/** What More below needs of the Homepage: the section shown, how many there are, and whether it is drawn for a phone. */
export interface MoreBelowDeps {
  section: Readonly<Ref<number>>
  count: () => number
  /** The section shown, which may scroll further than its room. */
  shown: () => HTMLElement | undefined
  /** On a phone the bar's ↓ and each section's end line say the rest, so it shows only while the section scrolls on. */
  phone: () => boolean
}

/** More below (ticket 0826; Homepage card): on every section that has more, a scroll further or a section after it, and
 * gone on the last once its end shows. Whether the section shown continues (its fade) follows its scroll and size. */
export function useMoreBelow({ section, count, shown, phone }: MoreBelowDeps) {
  const continues = ref(false)
  const measure = () => {
    const room = shown()
    continues.value = !!room && canScroll(room, 1)
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

  const shows = computed(() => continues.value || (!phone() && section.value < count() - 1))
  return { continues: readonly(continues), shows }
}
