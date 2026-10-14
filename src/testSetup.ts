import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Page tests share one jsdom and one module cache per worker (ticket 420), so a file would otherwise start from the
 * modules the last one imported, mocks and module state included. Empty the cache first, and import what this file's
 * setup shares with its tests only afterwards, so both hold the same instance.
 */
vi.resetModules()
const { disableAutoUnmount, enableAutoUnmount } = await import('@vue/test-utils')
const { browserDevicePreferences } = await import('./services/devicePreferences')
const { installSurfaceLayout } = await import('./testUtils/surfaceLayout')

/**
 * jsdom's PointerEvent doesn't redeclare `button`/`buttons` on its own prototype -- they're inherited, getter-only,
 * from MouseEvent.prototype (ticket 60). @vue/test-utils' `trigger(type, options)` re-assigns every option key onto
 * the constructed event afterwards, but only skips a key when `Object.getOwnPropertyDescriptor` finds a read-only
 * descriptor *directly on the event's own prototype* -- an inherited one doesn't count, so it doesn't realize
 * `button`/`buttons` are read-only and throws trying to set them. Copying the descriptors down as PointerEvent's own
 * makes @vue/test-utils see them and skip the (redundant -- the constructor already set them from `options`)
 * reassignment. `clientX`/`clientY` are the same (tests that press a Project at a point, ticket 106, set them).
 */
if (typeof PointerEvent !== 'undefined') {
  for (const key of ['button', 'buttons', 'clientX', 'clientY'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(MouseEvent.prototype, key)
    if (descriptor && !Object.prototype.hasOwnProperty.call(PointerEvent.prototype, key)) {
      Object.defineProperty(PointerEvent.prototype, key, descriptor)
    }
  }
}

/**
 * Unmount every wrapper after each test. A leaked App keeps its window keydown listeners and reactive watchers
 * alive, so each later test in the same file pays for every earlier one (App.test.ts went from ~26s to a fraction).
 */
// Page tests share one jsdom per worker (ticket 420), so this runs once per file; the library throws on a second arming.
disableAutoUnmount()
enableAutoUnmount(afterEach)

/** What the file before left on the shared page: its mounted elements, its storage, its title and its classes. */
if (typeof document !== 'undefined') {
  document.body.replaceChildren()
  document.head.querySelectorAll('style').forEach((node) => node.remove())
  document.documentElement.removeAttribute('class')
  document.documentElement.removeAttribute('style')
  document.title = ''
  window.localStorage.clear()
  window.sessionStorage.clear()
}

/**
 * jsdom has no canvas: getContext logs "not implemented" and hands back nothing. A component that draws on one (the
 * Project renderer's surfaces) carries on without a context, so this only keeps that from being logged on every mount.
 * A test that wants to see what is drawn installs a fake instead (see testUtils/fakeCanvas.ts).
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

/** jsdom does no layout; a test that presses a bead needs the surface to have a box (see testUtils/beads.ts). */
beforeEach(() => {
  if (typeof Element !== 'undefined') {
    installSurfaceLayout()
  }
})

/**
 * jsdom has no matchMedia at all (ticket 168's useMediaQuery, currently only Drawer.vue): every query answers false
 * and never changes, so a component that reads one carries on rather than throwing. A test that cares installs
 * testUtils/fakeMatchMedia.ts over it instead, with vi.stubGlobal('matchMedia', ...) and its own vi.unstubAllGlobals()
 * in afterEach -- the same project useElementSize.test.ts's FakeResizeObserver uses for ResizeObserver.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

/** Device preferences are read once and shared; a test seeds localStorage and then mounts, so each starts from what storage holds. */
beforeEach(() => browserDevicePreferences.forget())

/**
 * jsdom pretends to paint, so it has animation frames, and the Drawing surface waits for one before it draws (at most
 * once per frame). A test would then have to wait a frame after every change; with none, the surface draws at once. A
 * test of the waiting installs a fake with vi.stubGlobal('requestAnimationFrame', ...) and unstubs it afterwards.
 */
if (typeof window !== 'undefined') {
  Reflect.deleteProperty(window, 'requestAnimationFrame')
  Reflect.deleteProperty(window, 'cancelAnimationFrame')
}
