import { onBeforeUnmount, onMounted } from 'vue'

/**
 * One table entry per shortcut (ticket 86): `matches` picks it out of a keydown event, an optional `guard` can
 * withhold it beyond the typing check (e.g. Escape deferring to an open confirm modal), and `allowWhileTyping`
 * opts a shortcut — like Escape — out of the default suppression while a form field has focus. Adding a shortcut
 * means adding an entry to the table passed to useKeyboardShortcuts; nothing here has to grow to fit it.
 */
export interface KeyboardShortcut {
  matches: (event: KeyboardEvent) => boolean
  guard?: () => boolean
  allowWhileTyping?: boolean
  action: (event: KeyboardEvent) => void
}

/**
 * Whether a keydown landed in a form field — text/number inputs, a textarea, or anything contenteditable — where it
 * should be left to type normally rather than triggering an editor-wide shortcut. Exported so other window-level
 * keyboard handling outside the table above (e.g. useSpaceDragPan's Space-held tracking, ticket 95) shares the same
 * check rather than re-implementing it.
 */
export function isTypingInFormField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
}

/**
 * Binds a single window `keydown` listener that walks `shortcuts` in order, firing the first entry whose `matches`
 * (and `guard`, if present) both pass — bound to the window rather than a focused element, since the canvas takes
 * no keyboard focus of its own (ticket 24). A shortcut without `allowWhileTyping` is suppressed while the user is
 * typing in a form field, left to the field itself (e.g. a browser's native text-undo) rather than firing the
 * editor-wide one.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  function onKeyDown(event: KeyboardEvent) {
    for (const shortcut of shortcuts) {
      if (!shortcut.matches(event)) {
        continue
      }
      if (shortcut.guard && !shortcut.guard()) {
        continue
      }
      if (!shortcut.allowWhileTyping && isTypingInFormField(event.target)) {
        continue
      }

      shortcut.action(event)
      return
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
