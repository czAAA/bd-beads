/**
 * Which pointer draws and which one moves the canvas (ticket 325; CONTEXT.md: Pen mode, Mouse mode). In Pen mode the pen
 * draws and a finger or mouse moves the canvas, so a palm resting on the screen does not paint; in Mouse mode a finger or
 * mouse draws and the pen moves the canvas.
 */
export type InputMode = 'pen' | 'mouse'

export const DEFAULT_INPUT_MODE: InputMode = 'mouse'

/** Whether a pointer of this `PointerEvent.pointerType` draws with the Tool in this mode; the others move the canvas. */
export function pointerDraws(mode: InputMode, pointerType: string): boolean {
  return (pointerType === 'pen') === (mode === 'pen')
}
