import { computed, ref, shallowRef } from 'vue'

/** The App pages that fill the canvas box (ADR 0085): the editor, and Convert image (ADR 0086). */
export type AppPageId = 'editor' | 'convert-image'

/** A page's answer to "may I leave?": it may ask the person first. */
export type LeaveGuard = () => boolean | Promise<boolean>

/** Which App page shows, and the leave guard the current page may register (ADR 0085, ticket 0756). A Menu action that
 * leaves the page awaits `leave()` and knows nothing about which page it is on; with no guard, leaving is at once. */
export function useAppPage() {
  const page = ref<AppPageId>('editor')
  const guard = shallowRef<LeaveGuard>()

  /** Shows `next` in the canvas box. */
  function open(next: AppPageId) {
    page.value = next
  }

  /** The current page's guard, until the returned function is called; one page registers one. */
  function registerLeaveGuard(next: LeaveGuard): () => void {
    guard.value = next
    return () => {
      if (guard.value === next) guard.value = undefined
    }
  }

  /** Leaves the current page for the editor, asking its guard first: true once it has gone (or there was nothing to
   * leave), false when the person stayed. */
  async function leave(): Promise<boolean> {
    if (page.value === 'editor') return true
    if (guard.value && !(await guard.value())) return false
    page.value = 'editor'
    return true
  }

  /** Whether leaving now would ask first: the page holds work it registered a guard for (ticket 0861). */
  const guarded = computed(() => page.value !== 'editor' && !!guard.value)

  return { page, open, registerLeaveGuard, leave, guarded }
}

export type AppPage = ReturnType<typeof useAppPage>
