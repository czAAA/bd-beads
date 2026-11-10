import { CONTROLS, chordMatches, type ControlAction, type ControlDeps } from './controlRegistry'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'

/** What the shortcut table needs from the app shell: the control registry's deps. */
export type AppShortcutTableDeps = ControlDeps

/** Ticket 94: Enter/Shift+Enter move the Row progress pointer, except on a focused Progress bar button, or Tab+Enter
 * would do both. */
function isFocusedOnProgressBarButton(event: KeyboardEvent): boolean {
  const target = event.target
  return (
    target instanceof HTMLElement &&
    target.tagName === 'BUTTON' &&
    target.closest('[data-testid="progress-bar"]') !== null
  )
}

/** The app's keyboard shortcuts (ADR 0035, ticket 329): the table for useKeyboardShortcuts (its only caller), built
 * from the control registry. Deps are lazy. */
export function useAppShortcutTable(deps: AppShortcutTableDeps) {
  /** Withholds a shortcut while a menu or a dialog (anyDialogOpen) is open — same precedence Escape gives those
   * modals. */
  function noModalOpen(): boolean {
    return !deps.hasOpenLayer() && !deps.anyDialogOpen()
  }

  function toShortcut(control: ControlAction): KeyboardShortcut {
    const modals = control.modals ?? 'block'
    const givesWay = (event: KeyboardEvent) => !!control.givesWayToFocusedButton && isFocusedOnProgressBarButton(event)
    const isRepeatOfHeldKey = (event: KeyboardEvent) => !!control.actsOnce && event.repeat
    return {
      // A focused button gives way to its native press, except for a held key's repeats, which that press must not
      // take either (ticket 0835).
      matches: (event) =>
        control.chords.some((chord) => chordMatches(chord, event)) && (!givesWay(event) || isRepeatOfHeldKey(event)),
      guard: () => (modals !== 'block' || noModalOpen()) && (!control.needsProject || !!deps.activeProject()),
      allowWhileTyping: control.allowWhileTyping,
      action: (event) => {
        if (isRepeatOfHeldKey(event)) {
          if (givesWay(event)) event.preventDefault()
          return
        }
        if (control.preventDefault) event.preventDefault()
        // Claimed from the browser everywhere (Canvas zoom, ADR 0034), but only run when nothing is open.
        if (modals === 'claim' && !noModalOpen()) return
        control.run?.(deps, event)
      },
    }
  }

  useKeyboardShortcuts(CONTROLS.filter((control) => control.chords.length > 0).map(toShortcut))
}
