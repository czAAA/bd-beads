/** How the Selection bar fits the canvas box (ContextBar card, Fits the box): how many of its items show, the rest
 * going under "…", counting every gap, every divider and the "…" button itself. Pure, in px. */
export interface BarFitInput {
  /** The canvas box's width less the bar's edge margins: the most the bar may be wide. */
  room: number
  /** A button's width (the bar's height). */
  button: number
  /** The flex gap between two neighbours, and the bar's padding at each side. */
  gap: number
  side: number
  /** A divider's own width with its margins. */
  divider: number
  /** The widths of what leads the items (the move grip, the readout), in order. */
  lead: number[]
  /** Each item's group; a divider stands before the first item and wherever the group changes. */
  groups: number[]
}

function widthWith(input: BarFitInput, shown: number): number {
  const parts = [...input.lead]
  for (let i = 0; i < shown; i++) {
    if (i === 0 || input.groups[i] !== input.groups[i - 1]) parts.push(input.divider)
    parts.push(input.button)
  }
  if (shown < input.groups.length) parts.push(input.divider, input.button)
  return 2 * input.side + parts.reduce((sum, part) => sum + part, 0) + input.gap * Math.max(0, parts.length - 1)
}

/** The most items that show with the rest folded; all of them when they fit with no "…"; none when not even one does. */
export function fitItems(input: BarFitInput): number {
  for (let shown = input.groups.length; shown > 0; shown--) if (widthWith(input, shown) <= input.room) return shown
  return 0
}
