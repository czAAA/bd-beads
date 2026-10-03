import { ref } from 'vue'
import type { RulersStore } from '../../services/rulersStore'

/** The Rulers toggle (Rulers card): on by default, kept on the device, flipped by the canvas strip's button and R. */
export function useRulers(store: RulersStore) {
  const showRulers = ref(store.load())

  function setRulers(on: boolean): void {
    showRulers.value = on
    store.save(on)
  }

  return { showRulers, setRulers, toggleRulers: () => setRulers(!showRulers.value) }
}
