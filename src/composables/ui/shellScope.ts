import { hasInjectionContext, inject, provide, type InjectionKey } from 'vue'

/** Where an editor shell lives on the page (ticket 0797). The editor fills the whole page; the Homepage's What's inside
 * holds a second one in a box of its own, which takes keys and presses only inside that box and keeps its overlays in
 * it, so the page around it works as before. */
export interface ShellScope {
  /** The element the shell lives in; none for the whole page. */
  root: () => HTMLElement | null | undefined
  /** Where the shell's popovers are teleported to, as a selector. */
  teleportTo: string
}

/** The room overlays are placed in, in screen coordinates. */
export interface ScopeRoom {
  left: number
  top: number
  right: number
  bottom: number
}

/** The editor's own scope: the whole page, its popovers in the app shell. */
export const PAGE_SCOPE: ShellScope = { root: () => undefined, teleportTo: '.app-shell' }

const shellScopeKey: InjectionKey<ShellScope> = Symbol('shellScope')

/** Makes `scope` the one every shell part below the caller lives in. */
export function provideShellScope(scope: ShellScope): void {
  provide(shellScopeKey, scope)
}

/** The scope of the shell the caller is part of; the whole page outside any. */
export function useShellScope(): ShellScope {
  return (hasInjectionContext() ? inject(shellScopeKey, undefined) : undefined) ?? PAGE_SCOPE
}

/** Whether an event's target is the scope's business: anywhere for the whole page, inside its box for a boxed one. */
export function inScope(scope: ShellScope, target: EventTarget | null): boolean {
  const root = scope.root()
  if (!root) return true
  return target instanceof Node && root.contains(target)
}

/** The room overlays have: the window, or a boxed shell's box. */
export function scopeRoom(scope: ShellScope): ScopeRoom {
  const box = scope.root()?.getBoundingClientRect()
  return box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
}
