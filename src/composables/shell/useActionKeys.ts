import { chordMatches, controlAction } from './controlRegistry'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

/** Runs registry actions' keys on a surface's own handlers while it is mounted (ADR 0035, ticket 0650): the Convert image
 * preview zooms itself with the Canvas's zoom keys, which the shortcut table claims but leaves unrun while a dialog is
 * open. The keys and their rules (claimed from the browser, run while typing) stay the registry's. */
export function useActionKeys(handlers: Readonly<Record<string, () => void>>, active: () => boolean = () => true) {
  useKeyboardShortcuts(
    Object.entries(handlers).map(([id, run]) => {
      const action = controlAction(id)
      return {
        matches: (event) => action.chords.some((chord) => chordMatches(chord, event)),
        guard: active,
        allowWhileTyping: action.allowWhileTyping,
        action: (event) => {
          if (action.preventDefault) event.preventDefault()
          run()
        },
      }
    }),
  )
}
