/** A Tooltip body written from the names of what a button opens: "Set Frame, Rotate, Copy, Paste." */
export function menuTooltipBody(names: readonly string[]): string {
  return `${names.join(', ')}.`
}
