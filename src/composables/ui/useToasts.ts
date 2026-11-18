import { ref } from 'vue'
import type { UpdateSummary } from '../../domain/waitingBuild'

export type MessageTone = 'success' | 'info' | 'warning' | 'danger'

/** A text button in a toast (Message card): pressing it runs `run` and closes the toast. With `href` it is a link to
 * that page instead, which runs `run` as it leaves (ticket 1048, What's new). */
export interface ToastAction {
  label: string
  run: () => void
  href?: string
}

export interface Toast {
  /** Names the toast, so showing it again replaces it (and starts its clock over) rather than stacking a copy. */
  id: string
  text: string
  tone: MessageTone
  /** A text button after the message (Message card), such as Undo; pressing it runs `run` and closes the toast. */
  action?: ToastAction
  /** A second text button after the first (ticket 0935): the two stand on their own line under the text. */
  secondAction?: ToastAction
  /** Stays until closed or answered, instead of going after a few seconds (a prompt, not a result). */
  persistent?: boolean
  /** "Update ready"'s words after `text` (ticket 1048): the waiting Version and what it brings. */
  update?: UpdateSummary
  /** Bumped on every show, so a replaced toast is a new one to Vue and its clock starts over. */
  stamp: number
}

// Short-lived results shown as toasts (ticket 76; Message card): newest last, one per id. How long each stays is
// ToastRegion.vue's business; this only holds what is showing.
export function useToasts() {
  const toasts = ref<Toast[]>([])
  let stamp = 0

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function show(
    id: string,
    text: string,
    tone: MessageTone = 'success',
    action?: Toast['action'],
    options: { persistent?: boolean; secondAction?: ToastAction; update?: UpdateSummary } = {},
  ) {
    const { persistent, secondAction, update } = options
    toasts.value = [...toasts.value.filter((toast) => toast.id !== id), { id, text, tone, action, secondAction, persistent, update, stamp: ++stamp }]
  }

  return { toasts, show, dismiss }
}
