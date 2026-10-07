import { CONTROLS, chordMatches, type ControlAction, type ControlDeps } from './controlRegistry'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'

/** What the shortcut table needs from the app shell: the control registry's deps. */
export type AppShortcutTableDeps = ControlDeps

/**
 * Ticket 94: Enter/Shift+Enter move the Row progress pointer, except when a Toolbox or Progress bar button has
 * focus — otherwise Tab+Enter would both click that button and move the row. Progress bar (ticket 124) moved
 * Previous/Next onto the canvas, outside the Toolbox, so this checks both containers.
 */
function isFocusedOnToolboxButton(event: KeyboardEvent): boolean {
  const target = event.target
  return (
    target instanceof HTMLElement &&
    target.tagName === 'BUTTON' &&
    target.closest('[data-testid="toolbox"], [data-testid="progress-bar"]') !== null
  )
}

/**
 * The app's keyboard shortcuts (ADR 0035, ticket 329): the table handed to the generic useKeyboardShortcuts, the only
 * place that composable is called, built from the control registry so a key runs the action its button runs. Deps are
 * read lazily.
 */
export function useAppShortcutTable(deps: AppShortcutTableDeps) {
  /** Withholds a shortcut while a menu or a dialog (anyDialogOpen) is open — same precedence Escape gives those modals. */
  function noModalOpen(): boolean {
    return !deps.hasOpenLayer() && !deps.anyDialogOpen()
  }

  function toShortcut(control: ControlAction): KeyboardShortcut {
    const modals = control.modals ?? 'block'
    return {
      matches: (event) =>
        control.chords.some((chord) => chordMatches(chord, event)) &&
        !(control.givesWayToFocusedButton && isFocusedOnToolboxButton(event)),
      guard: () => (modals !== 'block' || noModalOpen()) && (!control.needsProject || !!deps.activeProject()),
      allowWhileTyping: control.allowWhileTyping,
      action: (event) => {
        if (control.preventDefault) event.preventDefault()
        // Claimed from the browser everywhere (Canvas zoom, ADR 0034), but only run when nothing is open.
        if (modals === 'claim' && !noModalOpen()) return
        control.run(deps, event)
      },
    }
  }

  useKeyboardShortcuts(CONTROLS.filter((control) => control.chords.length > 0).map(toShortcut))
}
