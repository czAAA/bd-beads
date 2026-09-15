/**
 * A controllable stand-in for ResizeObserver (jsdom has no real one, and real browser layout isn't available in
 * tests anyway): `observe()` just remembers the target and callback, and `trigger()` fires that callback with a
 * synthetic entry, so a test can simulate "the container is now this wide/tall" deterministically.
 *
 * Install with `vi.stubGlobal('ResizeObserver', FakeResizeObserver)` before mounting, read the instance a component
 * created off `FakeResizeObserver.instances`, and call `FakeResizeObserver.reset()` in afterEach/beforeEach so
 * instances don't leak between tests.
 */
export class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = []

  private target: Element | undefined
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }

  observe(target: Element): void {
    this.target = target
  }

  unobserve(): void {
    this.target = undefined
  }

  disconnect(): void {
    this.target = undefined
  }

  /** Fires the observed callback as if `target` resized to (width, height); a no-op before observe() is called. */
  trigger(width: number, height: number): void {
    if (!this.target) {
      return
    }

    const rect = { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 } as DOMRectReadOnly
    const entry: ResizeObserverEntry = {
      target: this.target,
      contentRect: rect,
      borderBoxSize: [{ inlineSize: width, blockSize: height }] as unknown as ReadonlyArray<ResizeObserverSize>,
      contentBoxSize: [{ inlineSize: width, blockSize: height }] as unknown as ReadonlyArray<ResizeObserverSize>,
      devicePixelContentBoxSize: [] as unknown as ReadonlyArray<ResizeObserverSize>,
    }
    this.callback([entry], this)
  }

  static reset(): void {
    FakeResizeObserver.instances = []
  }
}
