/** Whether this device has a touch screen (ticket 325): it reports touch points, or a coarse pointer among its pointers. */
export function touchCapable(): boolean {
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true
  return typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches
}
