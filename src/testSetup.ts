import { afterEach, beforeEach, vi } from 'vitest'

// Page tests share one jsdom and module cache per worker (ticket 420): empty the cache first, then import what setup
// shares with tests.
vi.resetModules()
const { disableAutoUnmount, enableAutoUnmount } = await import('@vue/test-utils')
const { browserDevicePreferences } = await import('./services/devicePreferences')
const { installSurfaceLayout } = await import('./testUtils/surfaceLayout')
const { installStrictClock, resetSharedPage } = await import('./testUtils/sharedPage')

// jsdom's PointerEvent inherits getter-only `button`/`buttons` (ticket 60); @vue/test-utils' trigger() only skips read-
// only keys found on the event's own prototype and so throws. Copy the descriptors down onto PointerEvent so it skips
// them; `clientX`/`clientY` likewise (ticket 106).
if (typeof PointerEvent !== 'undefined') {
  for (const key of ['button', 'buttons', 'clientX', 'clientY'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(MouseEvent.prototype, key)
    if (descriptor && !Object.prototype.hasOwnProperty.call(PointerEvent.prototype, key)) {
      Object.defineProperty(PointerEvent.prototype, key, descriptor)
    }
  }
}

// A press swallowed by an overlay (swallowNextClick) waits for its click and would eat one in a later test or file, so
// every test ends with a press that lets it go. Registered before the unmount below so it runs after it (afterEach runs
// last-in first).
afterEach(() => {
  document.dispatchEvent(new Event('pointerdown'))
})
/** Unmount every wrapper after each test: a leaked App's listeners and watchers slow every later test (~26s once). */
// Page tests share one jsdom per worker (ticket 420), so this runs once per file; the library throws on a second
// arming.
disableAutoUnmount()
enableAutoUnmount(afterEach)

// What the file before left on the shared page, its language and its device among it, and a clock fast enough that a
// click made right after mounting is not dropped (ticket 0608).
resetSharedPage()
installStrictClock()

// jsdom has no canvas: getContext logs "not implemented"; silenced here. A test that checks drawing installs
// testUtils/fakeCanvas.ts.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

/** jsdom does no layout; a test that presses a bead needs the surface to have a box (see testUtils/beads.ts). */
beforeEach(() => {
  if (typeof Element !== 'undefined') {
    installSurfaceLayout()
  }
})

// Device preferences are read once and shared; a test seeds localStorage and then mounts, so each starts from what
// storage holds.
beforeEach(() => browserDevicePreferences.forget())

// jsdom has animation frames, so the Drawing surface would wait one before drawing; with none it draws at once. Fake
// rAF with vi.stubGlobal to test waiting.
if (typeof window !== 'undefined') {
  Reflect.deleteProperty(window, 'requestAnimationFrame')
  Reflect.deleteProperty(window, 'cancelAnimationFrame')
}
