import type { InjectionKey, Ref } from 'vue'

/** What the panel shell tells the items inside it (ticket 443): the role its items take. */
export interface PanelContext {
  itemRole: Ref<'menuitem' | undefined>
  /** Closes the panel; a panel item that opens something else (a dialog, a sheet) calls it first. */
  close: () => void
  /** Pushes a sub-view over the current one, under its title (the panel's `subTitle` when none) and a Back arrow (spec 0478, ticket 493); the opener's row keeps focus to return to. */
  openSub: (title?: string) => void
}

/** What the panel shell shares with the Menu and Project panels below it (ticket 443). */
export const PANEL_CONTEXT: InjectionKey<PanelContext> = Symbol('panelContext')
