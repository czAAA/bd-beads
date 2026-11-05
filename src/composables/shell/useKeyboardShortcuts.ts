import { onBeforeUnmount, onMounted } from 'vue'
import { inScope, useShellScope } from '../ui/shellScope'

/** One table entry per shortcut (ticket 86): `matches` picks the keydown, `guard` can withhold it,
 * `allowWhileTyping` opts out of suppression in form fields (like Escape). */
export interface KeyboardShortcut {
  matches: (event: KeyboardEvent) => boolean
  guard?: () => boolean
  allowWhileTyping?: boolean
  action: (event: KeyboardEvent) => void
}

/** Whether a keydown landed in a form field, where it should type normally; exported so other window-level handling
 * (useSpaceDragPan, ticket 95) shares the check. */
export function isTypingInFormField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
}

// Binds one window `keydown` listener firing the first entry whose `matches` and `guard` pass; on the window since the
// canvas takes no focus (ticket 24). Shortcuts without `allowWhileTyping` are suppressed in form fields, leaving e.g.
// native text-undo to the field. A boxed shell (ticket 0797) takes only the keys pressed while the focus is in its box.
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const scope = useShellScope()
  function onKeyDown(event: KeyboardEvent) {
    if (!inScope(scope, event.target)) return
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
