import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface ElementSize {
  width: Ref<number>
  height: Ref<number>
}

// The live content-box size (px) of a template-ref'd element via ResizeObserver, so layout (the fit-to-screen zoom,
// ticket 27) tracks the real viewport. Reports 0 until the observer's first async callback. jsdom has no
// ResizeObserver: tests install the fake in src/testUtils/fakeResizeObserver.ts before mounting.
export function useElementSize(target: Ref<HTMLElement | null | undefined>): ElementSize {
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
        const rect = entries[0]?.contentRect
        if (rect) {
          width.value = rect.width
          height.value = rect.height
        }
      })
      observer.observe(el)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => observer?.disconnect())

  return { width, height }
}
