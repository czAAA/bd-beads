/**
 * jsdom's PointerEvent doesn't redeclare `button`/`buttons` on its own prototype -- they're inherited, getter-only,
 * from MouseEvent.prototype (ticket 60). @vue/test-utils' `trigger(type, options)` re-assigns every option key onto
 * the constructed event afterwards, but only skips a key when `Object.getOwnPropertyDescriptor` finds a read-only
 * descriptor *directly on the event's own prototype* -- an inherited one doesn't count, so it doesn't realize
 * `button`/`buttons` are read-only and throws trying to set them. Copying the descriptors down as PointerEvent's own
 * makes @vue/test-utils see them and skip the (redundant -- the constructor already set them from `options`)
 * reassignment.
 */
if (typeof PointerEvent !== 'undefined') {
  for (const key of ['button', 'buttons'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(MouseEvent.prototype, key)
    if (descriptor && !Object.prototype.hasOwnProperty.call(PointerEvent.prototype, key)) {
      Object.defineProperty(PointerEvent.prototype, key, descriptor)
    }
  }
}
