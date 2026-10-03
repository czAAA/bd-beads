import { CELL_SIZE_PX, isOffsetTechnique, type Rotation, type Technique } from '../domain/grid'
import type { Frame } from '../domain/canvas'
import { rowTopPx, type Region } from './patternRenderer'

/**
 * The geometry of looking at an open canvas through a viewport (ADR 0026): where a rectangle of beads lands on screen,
 * how to centre or fit it, and how a zoom keeps the point under the pointer still. A viewport is described the way the
 * renderer takes it: `scroll` is the displayed-space position (turned, zoomed, measured from the bead at row 0,
 * column 0) of the viewport's top-left corner.
 */
export interface Scroll {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** A point in grid space (px at zoom 1) carried to displayed space at a zoom: turned about the origin by the Pattern's rotation, then scaled. */
export function gridToDisplayed(rotation: Rotation, x: number, y: number, zoom: number): [number, number] {
  switch (rotation) {
    case 90:
      return [-y * zoom, x * zoom]
    case 180:
      return [-x * zoom, -y * zoom]
    case 270:
      return [y * zoom, -x * zoom]
    default:
      return [x * zoom, y * zoom]
  }
}

/** The rectangle of grid space that a block of beads covers, with the half bead an offset technique's shifted rows add on the right. */
export function beadBoxPx(technique: Technique, box: Frame): Region {
  const bottom = rowTopPx(technique, box.row + box.rows - 1) + CELL_SIZE_PX
  const top = rowTopPx(technique, box.row)
  return {
    x: box.column * CELL_SIZE_PX,
    y: top,
    width: box.columns * CELL_SIZE_PX + (isOffsetTechnique(technique) ? CELL_SIZE_PX / 2 : 0),
    height: bottom - top,
  }
}

/** Where a block of beads lies in displayed space: its rectangle once turned and zoomed. */
export function displayedBox(technique: Technique, rotation: Rotation, box: Frame, zoom: number): Region {
  const grid = beadBoxPx(technique, box)
  const [ax, ay] = gridToDisplayed(rotation, grid.x, grid.y, zoom)
  const [bx, by] = gridToDisplayed(rotation, grid.x + grid.width, grid.y + grid.height, zoom)
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) }
}

/** The scroll that puts the middle of a displayed rectangle in the middle of a viewport. */
export function scrollToCentre(rect: Region, viewport: Size): Scroll {
  return { x: rect.x + rect.width / 2 - viewport.width / 2, y: rect.y + rect.height / 2 - viewport.height / 2 }
}

/**
 * The scroll after the zoom changes from `from` to `to`, keeping the displayed point under `anchor` (a position in the
 * viewport) where it was: the centre of the viewport for the zoom buttons, the pointer for a wheel or a pinch.
 */
export function scrollAfterZoom(scroll: Scroll, anchor: Scroll, from: number, to: number): Scroll {
  const ratio = to / from
  return { x: (scroll.x + anchor.x) * ratio - anchor.x, y: (scroll.y + anchor.y) * ratio - anchor.y }
}

/** The largest zoom, never past 100%, at which a block of beads leaves `margin` px clear on every side of a viewport; whole percent, rounded down. */
export function zoomToFit(technique: Technique, rotation: Rotation, box: Frame, viewport: Size, margin: Size): number {
  const shown = displayedBox(technique, rotation, box, 1)
  const across = shown.width > 0 ? (viewport.width - margin.width * 2) / shown.width : Infinity
  const down = shown.height > 0 ? (viewport.height - margin.height * 2) / shown.height : Infinity
  return Math.floor(Math.min(1, across, down) * 100) / 100
}

