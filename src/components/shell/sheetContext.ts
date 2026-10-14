import { inject, type InjectionKey } from 'vue'

/** How a control that picks something (a tool, a color) closes the BottomSheet it sits in, once it has picked. */
export const SHEET_CLOSE: InjectionKey<() => void> = Symbol('sheet-close')

/**
 * What a pick control calls after it has emitted its choice: closes the enclosing BottomSheet. Outside a sheet (a control
 * set inline) there is nothing to close and it does nothing, so one control serves both.
 */
export function useCloseSheetOnPick(): () => void {
  return inject(SHEET_CLOSE, () => {})
}
