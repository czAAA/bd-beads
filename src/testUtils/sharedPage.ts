/** What a page test file leaves on the page the next one shares (ticket 420): its mounted elements, its styles, the
 * attributes on `<html>` (`lang` among them), its title, its storage and a `matchMedia` it assigned. `src/testSetup.ts`
 * empties it before every file, so each starts as if it ran first: in English, on a desk with a mouse (ticket 0608). */
export function resetSharedPage(): void {
  document.body.replaceChildren()
  document.head.querySelectorAll('style').forEach((node) => node.remove())
  for (const name of ['class', 'style', 'lang']) document.documentElement.removeAttribute(name)
  document.title = ''
  window.localStorage.clear()
  window.sessionStorage.clear()
  // jsdom has no matchMedia (ticket 168's useMediaQuery): every query answers false so components carry on. A test that
  // cares installs testUtils/fakeMatchMedia.ts with vi.stubGlobal('matchMedia', ...) and vi.unstubAllGlobals() in
  // afterEach.
  window.matchMedia = ((query: string) =>
    ({
      // A desk with a mouse, so hotkey chips show unless a test says otherwise (ticket 438).
      matches: query.includes('any-pointer: fine'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

/** A clock that reads `read` but never the same twice: while `read` stands still it moves on a millisecond a read. */
export function strictlyIncreasing(read: () => number): () => number {
  let last = -Infinity
  return () => {
    last = Math.max(read(), last + 1)
    return last
  }
}

// Shared by every file's copy of this module, so the clock is wrapped once per worker.
const STRICT = Symbol.for('bd-beads.strictClock')

/** Makes `Date.now` never read the same twice. Vue drops an event stamped no later than its listener was attached, and
 * a warm worker mounts and clicks within one millisecond (ticket 0608). */
export function installStrictClock(): void {
  if (STRICT in Date.now) return
  Date.now = Object.assign(strictlyIncreasing(Date.now.bind(Date)), { [STRICT]: true })
}
