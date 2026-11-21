import { describe, expect, it } from 'vitest'
import { withPictureTurned } from '../testUtils/layerFields'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { frameOf, heldWeave, withLayer } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import { withFrameLift } from '../domain/frame'
import { withLayers } from '../testUtils/layerFields'
import { LIGHT_THEME, type DrawingContext, type ProjectTheme } from './beadLook'
import { canvasWeave } from '../domain/layerWeave'
import { renderProject } from './projectRenderer'
import { frameOriginPx } from './surfaceView'
import { spaceOf } from './space'

// The Lifted Frame drawn for real (ticket 1177, BeadBoard card, Lifted Frame): a thin white ground and an outline round
// the pieces' outside border, the holes lying on the plate like beads, the shadow falling down the screen.

const PAD = 40
const SIZE = 400
const RATIO = 2
const RED = '#e63746'

type Cell = readonly [column: number, row: number]

function projectOf(cells: readonly Cell[]): Project {
  const made = withPictureTurned(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 12, height: 12, unit: 'beads' } }), 0)
  const project = withLayer(made, 'frame', { weave: heldWeave(made, 'canvas') })
  const framed = withLayers(project, { frame: { ...frameOf(project)!, beads: withColors({}, cells.map(([column, row]) => ({ row, column, color: RED }))) } })
  return withFrameLift(framed, true)
}

/** The Frame alone, drawn with or without its lift, on a surface that has room round it. */
function draw(project: Project, lift: boolean, theme: ProjectTheme = LIGHT_THEME): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE * RATIO
  renderProject(canvas.getContext('2d') as unknown as DrawingContext, { project, space: spaceOf(project, false), region: { x: -PAD, y: -PAD, width: SIZE, height: SIZE }, zoom: 1, pixelRatio: RATIO, theme, rowMarks: false, lift })
  return canvas
}

/** The color at a point in grid px, as read off the canvas. */
function colorAt(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number] {
  const { data } = canvas.getContext('2d')!.getImageData(Math.round((x + PAD) * RATIO), Math.round((y + PAD) * RATIO), 1, 1)
  return [data[0]!, data[1]!, data[2]!]
}
const luma = ([r, g, b]: readonly number[]) => 0.2126 * r! + 0.7152 * g! + 0.0722 * b!

/** A 6 × 6 block of beads. */
const BLOCK: readonly Cell[] = Array.from({ length: 36 }, (_, at): Cell => [Math.floor(at / 6), at % 6])
const RING: readonly Cell[] = Array.from({ length: 49 }, (_, at): Cell => [Math.floor(at / 7), at % 7]).filter(([column, row]) => column === 0 || row === 0 || column === 6 || row === 6)

describe('a lifted Frame', () => {
  it('lies on a ground just outside its beads and an outline outside that, over the flat look', () => {
    const lifted = draw(projectOf(BLOCK), true)
    const flat = draw(projectOf(BLOCK), false)
    // 1.5px outside the body of the first column: the ground, whiter than the board; 3px: the outline, darker.
    expect(luma(colorAt(lifted, -1.5, 60))).toBeGreaterThan(luma(colorAt(flat, -1.5, 60)))
    expect(luma(colorAt(lifted, -3, 60))).toBeLessThan(luma(colorAt(lifted, -1.5, 60)))
    // The beads themselves are as they were.
    expect(colorAt(lifted, 30, 30)).toEqual(colorAt(flat, 30, 30))
  })

  it('casts its shadow down the screen: more of it below the piece than above', () => {
    const lifted = draw(projectOf(BLOCK), true)
    const flat = draw(projectOf(BLOCK), false)
    const dark = (y: number) => luma(colorAt(flat, 60, y)) - luma(colorAt(lifted, 60, y))
    // 7px below the bottom edge (120) and 7px above the top edge (0).
    expect(dark(127)).toBeGreaterThan(dark(-7))
  })

  it('draws nothing past the shadow\'s reach', () => {
    const lifted = draw(projectOf(BLOCK), true)
    const flat = draw(projectOf(BLOCK), false)
    expect(colorAt(lifted, -35, 60)).toEqual(colorAt(flat, -35, 60))
  })

  it('lays a hole closed in on the piece like a bead: its own tile, no ground, no edge', () => {
    const lifted = draw(projectOf(RING), true)
    const flat = draw(projectOf(RING), false)
    // The middle of the 5 × 5 hole, and a point of it a bead's width from the ring.
    expect(colorAt(lifted, 70, 70)).toEqual(colorAt(flat, 70, 70))
    expect(colorAt(lifted, 30, 70)).toEqual(colorAt(flat, 30, 70))
  })

  it('keeps an outline round a bite that opens to the outside', () => {
    const bitten = RING.filter(([column, row]) => !(column === 3 && row === 0))
    const lifted = draw(projectOf(bitten), true)
    const flat = draw(projectOf(bitten), false)
    // 1px into the bite from the bead beside it: ground.
    expect(luma(colorAt(lifted, 61, 10))).toBeGreaterThan(luma(colorAt(flat, 61, 10)))
  })

  it('draws the same on the Canvas with only a band of rows redrawn, no stale shadow left', () => {
    const project = projectOf(BLOCK)
    const { row, column } = frameOf(project)!
    const origin = frameOriginPx(canvasWeave(project), { row, column })
    const region = { x: origin.x - PAD, y: origin.y - PAD, width: SIZE, height: SIZE }
    const input = { space: spaceOf(project, true), region, zoom: 1, pixelRatio: RATIO, theme: LIGHT_THEME, rowMarks: true, opaque: true } as const
    const surface = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = SIZE * RATIO
      return [canvas, canvas.getContext('2d') as unknown as DrawingContext] as const
    }
    const [whole, wholeContext] = surface()
    renderProject(wholeContext, { ...input, project })
    const [band, bandContext] = surface()
    renderProject(bandContext, { ...input, project: projectOf(BLOCK.filter(([, at]) => at !== 5)) })
    renderProject(bandContext, { ...input, project, rows: { first: row + 5, last: row + 5 } })
    const a = whole.getContext('2d')!.getImageData(0, 0, SIZE * RATIO, SIZE * RATIO).data
    const b = band.getContext('2d')!.getImageData(0, 0, SIZE * RATIO, SIZE * RATIO).data
    let off = 0
    for (let at = 0; at < a.length; at += 4) if (Math.abs(a[at]! - b[at]!) + Math.abs(a[at + 1]! - b[at + 1]!) + Math.abs(a[at + 2]! - b[at + 2]!) > 24) off += 1
    expect(off).toBeLessThan(40)
  })
})
