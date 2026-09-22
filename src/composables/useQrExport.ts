import { computed, ref, toRaw, type ComputedRef, type Ref } from 'vue'
import type { Pattern } from '../domain/pattern'
import { patternQrMatrix, type QrMatrix } from '../domain/qrExport'

export interface QrExport {
  /** The open Pattern's code, or undefined when there is no Pattern or it doesn't fit a single QR code (ADR 0015). */
  matrix: ComputedRef<QrMatrix | undefined>
  /** A Pattern is open but too large for a code: the control turns itself off and says why, instead of offering a dead end. */
  tooLarge: ComputedRef<boolean>
  /** Whether the QR panel is showing: asked for, and the Pattern still has a code to show. */
  panelOpen: ComputedRef<boolean>
  open: () => void
  close: () => void
}

/** Where this app is being served right now, minus any query or fragment: what a scanned code's link has to open for the scanning device to get the same app. */
function currentAppUrl(): string {
  return window.location.origin + window.location.pathname
}

/**
 * QR export (ticket 68, ADR 0015; lifted out of the retired Export and import box by ticket 116): the code for the open Pattern and
 * whether its panel is open. The Toolbox's Edit group opens the panel while App shows it, so the state can't belong to
 * either — it lives here, where both can reach it.
 *
 * The code is worked out ahead of the click rather than at it, so the control can be disabled for a Pattern that can't
 * be exported (the Pattern file export is the way out for those). The panel shows the current code, so it follows the
 * Pattern — and closes itself if an edit makes it too large — rather than freezing what it was opened with.
 */
export function useQrExport(pattern: () => Pattern | undefined): QrExport {
  const matrix = computed(() => {
    const open = pattern()
    // Read as the Pattern itself: the code reads every bead, and through the library's reactive wrapper that is a proxy
    // per bead. It depends on the Pattern's identity alone, which every edit changes.
    return open ? patternQrMatrix(toRaw(open), currentAppUrl()) : undefined
  })
  const tooLarge = computed(() => pattern() !== undefined && matrix.value === undefined)

  const requested: Ref<boolean> = ref(false)
  const panelOpen = computed(() => requested.value && matrix.value !== undefined)

  return {
    matrix,
    tooLarge,
    panelOpen,
    open: () => {
      requested.value = true
    },
    close: () => {
      requested.value = false
    },
  }
}
