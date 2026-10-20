import { inject, type InjectionKey } from 'vue'

/** How a control that picks something (a tool, a color) closes the popover it sits in, once it has picked. */
export const SHEET_CLOSE: InjectionKey<() => void> = Symbol('sheet-close')

/** What a pick control calls after emitting its choice: closes the enclosing popover; outside one it does
 * nothing. */
export function useCloseSheetOnPick(): () => void {
  return inject(SHEET_CLOSE, () => {})
}
