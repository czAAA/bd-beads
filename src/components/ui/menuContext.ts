import type { InjectionKey } from 'vue'

/** How an AppMenuItem closes the AppMenu it sits in, once it has been chosen. */
export const MENU_CLOSE: InjectionKey<() => void> = Symbol('menu-close')
