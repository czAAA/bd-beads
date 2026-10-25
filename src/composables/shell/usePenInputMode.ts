import { computed, onBeforeUnmount, onMounted } from 'vue'
import { DEFAULT_INPUT_MODE, type WritingHand, type InputMode } from '../../domain/inputMode'
import type { DevicePreferences } from '../../services/devicePreferences'

// The input mode (tickets 325, 326, 443): which pointer draws and which moves the canvas. A browser can't tell a pen
// exists until it touches the screen, so the Menu's Input row appears only once a pen event is seen (kept on the
// device); the first pen switches to Pen mode unless the person already chose a mode.
export function usePenInputMode(preferences: DevicePreferences) {
  const chosen = preferences.get('inputMode')
  const penSeen = preferences.get('penSeen')
  const writingHand = preferences.get('writingHand')

  const inputMode = computed<InputMode>(() => chosen.value ?? (penSeen.value ? 'pen' : DEFAULT_INPUT_MODE))
  /** The Menu's Input row picks one of the two; the choice is kept on the device. */
  const setInputMode = (mode: InputMode) => void (chosen.value = mode)
  /** Until a pen is seen every pointer draws, so the stroke that reveals the toggle still draws. */
  const surfaceInputMode = computed(() => (penSeen.value ? inputMode.value : undefined))

  /** The Menu's Writing hand row picks one of the two; the choice is kept on the device. */
  const setWritingHand = (hand: WritingHand) => void (writingHand.value = hand)

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

  return { inputMode, inputModeAvailable: penSeen, setInputMode, surfaceInputMode, writingHand, setWritingHand }
}
