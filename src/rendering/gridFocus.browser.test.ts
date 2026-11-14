import { describe, expect, it } from 'vitest'
import { channelsOf } from '../domain/color'
import { bareProject } from '../testUtils/layerFields'
import type { DrawingContext } from './beadLook'
import { canvasTheme } from './canvasBackgrounds'
import { emptyCanvasLook } from './emptyCanvasLook'
import { cellSizePx } from './cellSize'
import { farGapOf } from './gridFocus'
import { renderProject } from './projectRenderer'
import { OPEN_SPACE, spaceOf } from './space'
import { surfaceView } from './surfaceView'
import { tileColorOf } from './tonalTiles'
import { workBoxesOf } from './workBoxes'

// Grid focus drawn for real (ticket 1002, BeadBoard card): with no canvas `filter`, the gap eases from the Background
// near the work to the far gap away from it, and the tiles over it keep one color from edge to edge.

const PIXEL_RATIO = 4
const REGION = { x: -100, y: -100, width: 800, height: 240 }

/** The color at a grid px of the open Canvas, drawn on Night round one bead at the origin. The Lifted piece (ticket
 * 1004) is off: its shadow darkens the gap beside the bead, and only Grid focus is measured here. */
function drawn(gridFocus: boolean, region = REGION): (x: number, y: number) => string {
  const project = bareProject({ beads: { 0: { 0: '#ff0000' } }, technique: 'loom' })
  const canvas = document.createElement('canvas')
  canvas.width = REGION.width * PIXEL_RATIO
  canvas.height = REGION.height * PIXEL_RATIO
  const context = canvas.getContext('2d')! as unknown as DrawingContext
  const theme = { ...canvasTheme('dark', 1), liftedPiece: false }
  renderProject(context, {
    project, space: spaceOf(project, true), region, zoom: 1, pixelRatio: PIXEL_RATIO, theme, opaque: true, rowMarks: false,
    drawBead: () => undefined, ...(gridFocus ? { gridFocus: workBoxesOf(project) } : {}),
  })
  return (x, y) => {
    const { data } = (context as unknown as CanvasRenderingContext2D).getImageData(Math.round((x - region.x) * PIXEL_RATIO), Math.round((y - region.y) * PIXEL_RATIO), 1, 1)
    return `${data[0]},${data[1]},${data[2]}`
  }
}

/** A color as the "r,g,b" the canvas reads back. */
const rgb = (hex: string) => Object.values(channelsOf(hex)).join(',')

describe('Grid focus on the open Canvas', () => {
  const cell = cellSizePx('loom')
  const [near, far] = [2, 30].map((column) => column * cell.width)
  const middle = cell.height / 2

  it('keeps the full gap near the work and the far gap away from it, never the tile', () => {
    const at = drawn(true)
    expect(at(near!, middle)).toBe(rgb('#202020'))
    expect(at(far!, middle)).toBe(rgb(farGapOf('#202020')))
    expect(at(far!, middle)).not.toBe(rgb(tileColorOf('#202020')))
  })

  it('leaves the tiles one color, near the work and far from it', () => {
    const at = drawn(true)
    expect(at(near! + cell.width / 2, middle)).toBe(rgb(tileColorOf('#202020')))
    expect(at(far! + cell.width / 2, middle)).toBe(at(near! + cell.width / 2, middle))
  })

  it('keeps the easing on the grid as the view pans, the field made for the first view reused', () => {
    drawn(true)
    const at = drawn(true, { ...REGION, x: REGION.x + 37, y: REGION.y + 3 })
    expect(at(near!, middle)).toBe(rgb('#202020'))
    expect(at(far!, middle)).toBe(rgb(farGapOf('#202020')))
  })

  it('eases with no seam: along a gap the far gap only grows away from the work', () => {
    const at = drawn(true)
    const along = Array.from({ length: (600 - 20) * PIXEL_RATIO }, (_, x) => Number(at(20 + x / PIXEL_RATIO, cell.height).split(',')[0]))
    // A faint far gap is stored premultiplied, so it may come back a level under the Background.
    for (let x = 1; x < along.length; x += 1) expect(along[x]!, `${x / PIXEL_RATIO} px`).toBeGreaterThanOrEqual(along[x - 1]! - 1)
    expect(along.at(-1)).toBeGreaterThan(along[0]!)
  })

  it('keeps the full gap everywhere while it is off', () => {
    const at = drawn(false)
    expect(at(far!, middle)).toBe(rgb('#202020'))
  })
})

describe('the empty Canvas laid under the drawing', () => {
  const surface = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, scroll: { x: 0, y: 0 }, viewport: { width: 800, height: 600 } })
  const look = (farGap: boolean, tileZoom = 1) =>
    emptyCanvasLook({ weave: { technique: 'loom' }, theme: canvasTheme('dark', 1), surface, zoom: 1, tileZoom, pixelRatio: 1, reach: 400, farGap })

  it('lies on the far gap while Grid focus is on, so a pan never uncovers a bare patch of the full gap', () => {
    expect(look(true)?.['--empty-gap']).toBe(farGapOf('#202020'))
    expect(look(false)?.['--empty-gap']).toBeUndefined()
  })

  it('keeps the draft look as it was', () => {
    expect(look(true, 0.2)?.['--empty-gap']).toBeUndefined()
  })
})
