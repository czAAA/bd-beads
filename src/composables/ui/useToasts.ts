import { ref } from 'vue'

export type MessageTone = 'success' | 'info' | 'warning' | 'danger'

export interface Toast {
  /** Names the toast, so showing it again replaces it (and starts its clock over) rather than stacking a copy. */
  id: string
  text: string
  tone: MessageTone
  /** A text button after the message (Message card), such as Undo; pressing it runs `run` and closes the toast. */
  action?: { label: string; run: () => void }
  /** Stays until closed or answered, instead of going after a few seconds (a prompt, not a result). */
  persistent?: boolean
  /** Bumped on every show, so a replaced toast is a new one to Vue and its clock starts over. */
  stamp: number
}

/**
 * Short-lived results shown as toasts (ticket 76; Message card): newest last, one per id. How long each stays is the
 * toast region's business (ToastRegion.vue); this only holds what is showing.
 */
export function useToasts() {
  const toasts = ref<Toast[]>([])
  let stamp = 0

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function show(id: string, text: string, tone: MessageTone = 'success', action?: Toast['action'], persistent = false) {
    toasts.value = [...toasts.value.filter((toast) => toast.id !== id), { id, text, tone, action, persistent, stamp: ++stamp }]
  }

  return { toasts, show, dismiss }
}
