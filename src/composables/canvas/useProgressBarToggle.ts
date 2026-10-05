import { ref } from 'vue'
import type { ProgressBarStore } from '../../services/progressBarStore'

/** The Zoom pill's Row progress toggle (ticket 296): shows or hides the Progress bar under 1024px, on by default and kept on the device. */
export function useProgressBarToggle(store: ProgressBarStore) {
  const showProgressBar = ref(store.load())

  function toggleProgressBar(): void {
    showProgressBar.value = !showProgressBar.value
    store.save(showProgressBar.value)
  }

  return { showProgressBar, toggleProgressBar }
}
