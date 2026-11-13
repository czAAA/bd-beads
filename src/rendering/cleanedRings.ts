import type { GridPosition } from '../domain/grid'

/** What the rings round the beads Clean up changed need (ConvertImage card DS-3, ticket 0906), in CSS px of the view. */
export interface CleanedRings {
  /** 1 marks a changed bead of the Frame, row by row. */
  changed: Uint8Array
  columns: number
  /** A Frame bead's centre in the view. */
  centre: (position: GridPosition) => { x: number; y: number }
  /** A bead's size on screen and its corner's share of its width. */
  bead: { width: number; height: number; roundness: number }
  /** The ring's line and its gap from the bead, and its color. */
  ring: number
  gap: number
  color: string
  pixelRatio: number
}

/** Rings every bead Clean up changed while its popover is open: a `ring` line `gap` outside the bead, following its
 * shape, all in one path so a large Frame strokes once. */
export function drawCleanedRings(context: CanvasRenderingContext2D, { changed, columns, centre, bead, ring, gap, color, pixelRatio }: CleanedRings): void {
  const out = gap + ring / 2
  const width = (bead.width + out * 2) * pixelRatio
  const height = (bead.height + out * 2) * pixelRatio
  const radius = (bead.roundness * bead.width + out) * pixelRatio
  const path = new Path2D()
  for (let at = 0; at < changed.length; at += 1) {
    if (!changed[at]) continue
    const { x, y } = centre({ row: Math.floor(at / columns), column: at % columns })
    const left = x * pixelRatio - width / 2
    const top = y * pixelRatio - height / 2
    path.roundRect(left, top, width, height, radius)
  }
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.strokeStyle = color
  context.lineWidth = ring * pixelRatio
  context.stroke(path)
}
