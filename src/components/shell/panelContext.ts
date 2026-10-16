import type { InjectionKey, Ref } from 'vue'

/** What the panel shell tells the items inside it (ticket 443): whether it is the narrow Top sheet (bigger rows, one choice per line) and the role its items take. */
export interface PanelContext {
  sheet: Ref<boolean>
  itemRole: Ref<'menuitem' | undefined>
  /** Closes the panel; a panel item that opens something else (a dialog, a sheet) calls it first. */
  close: () => void
}

export const PANEL_CONTEXT: InjectionKey<PanelContext> = Symbol('panelContext')
