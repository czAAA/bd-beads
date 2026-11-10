import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface ElementSize {
  width: Ref<number>
  height: Ref<number>
}

// The live content-box size (px) of a template-ref'd element via ResizeObserver (ticket 27), or with `border-box` its
// outer size, for an element placed by its edge (ticket 0833). 0 until the observer's first callback. jsdom has none:
// tests install src/testUtils/fakeResizeObserver.ts before mounting.
export function useElementSize(target: Ref<HTMLElement | null | undefined>, { box = 'content-box' }: { box?: 'content-box' | 'border-box' } = {}): ElementSize {
  const width = ref(0)
  const height = ref(0)
  let observer: ResizeObserver | undefined

  watch(
    target,
    (el) => {
      observer?.disconnect()
      observer = undefined
      width.value = 0
      height.value = 0

      if (!el || typeof ResizeObserver === 'undefined') {
        return
      }

      observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        const outer = box === 'border-box' ? entry?.borderBoxSize?.[0] : undefined
        const size = outer ? { width: outer.inlineSize, height: outer.blockSize } : entry?.contentRect
        if (size) {
          width.value = size.width
          height.value = size.height
        }
      })
      observer.observe(el, { box })
    },
    { immediate: true },
  )

  onBeforeUnmount(() => observer?.disconnect())

  return { width, height }
}
