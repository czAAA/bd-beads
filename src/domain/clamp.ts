/** `value` held inside `min` to `max`: the shared clamp, so a range is not written out again (ticket 0612). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
