import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { emptyCanvasPlacement } from './emptyCanvasLook'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'

/** The remainder of `value` over `step`, between 0 and `step`. */
const over = (value: number, step: number) => ((value % step) + step) % step

describe('emptyCanvasPlacement', () => {
  it('repeats a loom tile a bead across and two rows down from the grid origin, at the zoom and against the scroll', () => {
    const surface = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 0.5, scroll: { x: 13, y: 7 }, viewport: { width: 800, height: 600 } })
    expect(emptyCanvasPlacement({ technique: 'loom' }, surface, 0.5)).toEqual({ turn: { a: 1, b: 0, c: 0, d: 1 }, at: { x: -13, y: -7 }, size: { width: 10, height: 20 } })
  })

  it.each<Rotation>([0, 90, 180, 270])('lies on the loom grid at a %s° quarter turn: two rows of a column are one tile (ticket 0717)', (rotation) => {
    const zoom = 0.3
    const surface = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation, zoom, scroll: { x: -41, y: 29 }, viewport: { width: 800, height: 600 } })
    const { at, size } = emptyCanvasPlacement({ technique: 'loom' }, surface, zoom)
    const tile = surface.beadBox({ row: 0, column: 0, rows: 2, columns: 1 }, 'canvas')
    expect(size).toEqual({ width: tile.width, height: tile.height })
    expect([over(tile.x - at.x, size.width), over(tile.y - at.y, size.height)].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([0, 0])
  })

  it.each<[Technique, Rotation]>([
    ['peyote', 0],
    ['peyote', 90],
    ['peyote', 180],
    ['peyote', 270],
    ['brick', 0],
    ['brick', 270],
  ])('starts a tile at the first position for %s at a %s° quarter turn, where the half-shifted rows start', (technique, rotation) => {
    const zoom = 0.3
    const surface = surfaceView({ space: OPEN_SPACE, technique, rotation, zoom, scroll: { x: -41, y: 29 }, viewport: { width: 800, height: 600 } })
    const { at, size } = emptyCanvasPlacement({ technique }, surface, zoom)
    // The first position's centre is half a bead (3 px at 30%) from the tile's edges, on the side its corner is.
    const centre = surface.beadToPoint({ row: 0, column: 0 })
    const fromEdge = (from: number, step: number) => Math.round(Math.min(over(from, step), step - over(from, step)) * 1e6) / 1e6
    expect([fromEdge(centre.x - at.x, size.width), fromEdge(centre.y - at.y, size.height)]).toEqual([3, 3])
  })
})
