import { computed, onBeforeUnmount, onMounted } from 'vue'
import { DEFAULT_INPUT_MODE, type InputMode } from '../../domain/inputMode'
import type { DevicePreferences } from '../../services/devicePreferences'

/**
 * The input mode toggle (tickets 325, 326): which pointer draws and which one moves the canvas. A browser cannot say
 * whether a pen exists until it touches the screen, so the toggle is offered only once a pen event has been seen, and
 * that first pen switches to Pen mode unless the person already chose a mode. "A pen has been seen" is kept on the device.
 */
export function usePenInputMode(preferences: DevicePreferences) {
  const chosen = preferences.get('inputMode')
  const penSeen = preferences.get('penSeen')

  const inputMode = computed<InputMode>(() => chosen.value ?? (penSeen.value ? 'pen' : DEFAULT_INPUT_MODE))
  const toggleInputMode = () => void (chosen.value = inputMode.value === 'pen' ? 'mouse' : 'pen')
  /** Until a pen is seen every pointer draws, so the stroke that reveals the toggle still draws. */
  const surfaceInputMode = computed(() => (penSeen.value ? inputMode.value : undefined))

  function onPointer(event: PointerEvent): void {
    if (event.pointerType === 'pen' && !penSeen.value) penSeen.value = true
  }
  onMounted(() => {
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('pointermove', onPointer, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onPointer, true)
    window.removeEventListener('pointermove', onPointer, true)
  })

  return { inputMode, inputModeAvailable: penSeen, toggleInputMode, surfaceInputMode }
}
