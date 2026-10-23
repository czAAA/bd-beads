import { inject, type InjectionKey } from 'vue'

/** How a control that picks something (a tool, a color) closes the popover it sits in, once it has picked. */
export const PICK_CLOSE: InjectionKey<() => void> = Symbol('pick-close')

/** What a pick control calls after emitting its choice: closes the enclosing popover; outside one it does
 * nothing. */
export function useClosePopoverOnPick(): () => void {
  return inject(PICK_CLOSE, () => {})
}
