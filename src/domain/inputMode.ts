/** Which pointer draws and which moves the canvas (ticket 325; CONTEXT.md: Pen mode, Mouse mode). In Pen mode only
 * the pen draws, so a resting palm does not paint; in Mouse mode a finger or mouse draws and the pen moves. */
export type InputMode = 'pen' | 'mouse'

export const DEFAULT_INPUT_MODE: InputMode = 'mouse'

/** Which hand holds the pen; the pen's marker stands off the tip away from it. */
export type Handedness = 'right' | 'left'

/** Whether a pointer of this `PointerEvent.pointerType` draws with the Tool in this mode; the others move the
 * canvas. */
export function pointerDraws(mode: InputMode, pointerType: string): boolean {
  return (pointerType === 'pen') === (mode === 'pen')
}
