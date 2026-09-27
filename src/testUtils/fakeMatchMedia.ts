/**
 * A stand-in for window.matchMedia whose answers a test can change, firing 'change' like a resize or an OS setting
 * would (the same shape src/theme/theme.test.ts's own fakeDevice uses, generalized to any query rather than just the
 * two theme ones).
 */
export function fakeMatchMedia(initial: Record<string, boolean> = {}) {
  const state = new Map<string, boolean>(Object.entries(initial))
  const listeners = new Map<string, Set<() => void>>()

  function matchMedia(query: string): MediaQueryList {
    const set = listeners.get(query) ?? new Set()
    listeners.set(query, set)
    return {
      get matches() {
        return state.get(query) ?? false
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => set.add(listener),
      removeEventListener: (_: string, listener: () => void) => set.delete(listener),
    } as unknown as MediaQueryList
  }

  function set(query: string, matches: boolean) {
    state.set(query, matches)
    for (const listener of listeners.get(query) ?? []) listener()
  }

  return { matchMedia, set }
}
