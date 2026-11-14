import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { canvasOf } from '../domain/layerRecord'
import { weaveOf } from '../domain/layerWeave'
import type { Technique } from '../domain/weave'
import { withLayers } from '../testUtils/layerFields'
import { recordingContext } from '../testUtils/recordingContext'
import { PRINT_THEME, PROJECT_THEMES } from './beadLook'
import { canvasTheme } from './canvasBackgrounds'
import { CELL_SIZE_PX } from './cellSize'
import { canvasLiftCells, drawLift, LIFT_REACH_PX, liftCollector, liftLookOf, liftRows, paintedOnly } from './liftedPiece'
import { positionBoxPx } from './surfaceView'

const painted = (cells: [number, number][], technique: Technique = 'loom', frame?: { row: number; column: number; rows: number; columns: number }) => {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
  const beads = withColors({}, cells.map(([row, column]) => ({ row, column, color: '#e63746' })))
  return withLayers(project, { technique, beads, frame: frame && { ...weaveOf(canvasOf(project)), technique, ...frame, beads: {} } })
}

const everywhere = { area: { left: -1e5, right: 1e5, top: -1e5, bottom: 1e5 }, margin: 4 }

describe('the Lifted piece\'s colors (BeadBoard card, Lifted piece)', () => {
  it.each([
    ['dark', 1, '#202020', '#8c8c8c', '#2b2b2b'],
    ['light', 1, '#fafafa', '#9a9a9a', '#fefefe'],
  ] as const)('gives the card\'s contour and ground on %s background %i (%s)', (theme, choice, background, contour, ground) => {
    const look = canvasTheme(theme, choice)
    expect(look.canvas).toBe(background)
    expect(liftLookOf(look.canvas)).toMatchObject({ contour, ground })
  })

  it('takes the look a Background is drawn in, a Custom color included: dark shadows on a dark one, light on a light one', () => {
    for (const background of ['#0e0e0e', '#3b3e43', '#2a3b5c']) expect(liftLookOf(background).shadows).toEqual(['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.5)'])
    for (const background of ['#e6e3de', '#cdcac4', '#f0d8c0']) expect(liftLookOf(background).shadows).toEqual(['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.16)'])
    // The contour steps toward white on a dark one, toward black on a light one.
    expect(liftLookOf('#3b3e43').contour > '#3b3e43').toBe(true)
    expect(liftLookOf('#cdcac4').contour < '#cdcac4').toBe(true)
  })

  it('lifts pieces on the screen in light and dark only: high contrast and exports keep the rectangle', () => {
    expect([PROJECT_THEMES.light.liftedPiece, PROJECT_THEMES.dark.liftedPiece, PROJECT_THEMES.contrast.liftedPiece, PRINT_THEME.liftedPiece]).toEqual([true, true, false, false])
  })
})

describe('drawLift', () => {
  const cell = { x: 0, y: 0, width: CELL_SIZE_PX, height: CELL_SIZE_PX }

  it('lays two shadows of the ground\'s shape, then the contour, then the ground over it, without the canvas filter', () => {
    const { context, named } = recordingContext()
    const shadows: { color: string; blur: number; down: number }[] = []
    const watched = new Proxy(context, {
      get: (target, key) => (key === 'fill' ? () => (shadows.push({ color: target.shadowColor, blur: target.shadowBlur, down: target.shadowOffsetY }), target.fill()) : Reflect.get(target, key)),
      set: (target, key, value) => Reflect.set(target, key, value),
    })
    drawLift(watched, [cell], '#202020', 2)
    const fills = named('fill')
    expect(fills.map(({ fillStyle }) => fillStyle)).toEqual(['#8c8c8c', '#8c8c8c', '#8c8c8c', '#2b2b2b'])
    // Blur 9 px and 6 px down, then 2 px and 1.5 px down, in device px at twice: a canvas shadow's blur is two spreads.
    expect(shadows.slice(0, 2)).toEqual([
      { color: 'rgba(0, 0, 0, 0.6)', blur: 36, down: 12 },
      { color: 'rgba(0, 0, 0, 0.5)', blur: 8, down: 3 },
    ])
  })

  it('runs the contour 4px outside the bead\'s body, 1.25px wide, corners 5px', () => {
    const { context, named } = recordingContext()
    drawLift(context, [cell], '#fafafa', 1)
    const [, outer, inner] = named('roundRect').map(({ args }) => args)
    // The body stands half a px in from its cell.
    expect(outer).toEqual([-3.5, -3.5, CELL_SIZE_PX + 7, CELL_SIZE_PX + 7, 5])
    expect(inner).toEqual([-2.25, -2.25, CELL_SIZE_PX + 4.5, CELL_SIZE_PX + 4.5, 3.75])
  })

  it('draws nothing with no bead', () => {
    const { context, calls } = recordingContext()
    drawLift(context, [], '#fafafa', 1)
    expect(calls).toHaveLength(0)
  })
})

describe('canvasLiftCells', () => {
  it('takes a row\'s touching beads as one cell, and a bead apart as its own', () => {
    const project = painted([[0, 0], [0, 1], [0, 2], [0, 4], [1, 1]])
    const box = (row: number, column: number) => positionBoxPx({ technique: 'loom' }, row, column)
    expect(canvasLiftCells(project, everywhere)).toEqual([
      { ...box(0, 0), width: 3 * CELL_SIZE_PX },
      box(0, 4),
      box(1, 1),
    ])
  })

  it('joins a column\'s beads where columns are staggered (peyote)', () => {
    const project = painted([[0, 0], [1, 0], [2, 0], [0, 1]], 'peyote')
    const cells = canvasLiftCells(project, everywhere)
    expect(cells).toHaveLength(2)
    expect(cells[0]!.height).toBeCloseTo(positionBoxPx({ technique: 'peyote' }, 0, 0).height * 3)
  })

  it('takes in only the rows whose pieces reach a redrawn band, and none far out of view', () => {
    const project = painted([[0, 0], [10, 0], [40, 0]])
    const rows = canvasLiftCells(project, { ...everywhere, rows: { first: 10, last: 10 } })
    expect(rows).toHaveLength(1)
    const seen = canvasLiftCells(project, { ...everywhere, area: { left: 0, right: 100, top: 0, bottom: 100 } })
    expect(seen.map(({ y }) => y)).toEqual([0])
    expect(LIFT_REACH_PX).toBeLessThan(10 * CELL_SIZE_PX)
  })

  it('leaves out the beads in the Frame\'s keep-out margin, which are not drawn', () => {
    const project = painted([[0, 0], [0, 1], [0, 2], [0, 3]], 'loom', { row: 10, column: 3, rows: 2, columns: 2 })
    // The margin is 4 positions: rows 6 to 15, columns -1 to 8 are kept out.
    const cells = canvasLiftCells(project, everywhere)
    expect(cells).toEqual([{ ...positionBoxPx({ technique: 'loom' }, 0, 0), width: 4 * CELL_SIZE_PX }])
    const crossed = painted([[8, -3], [8, -2], [8, -1], [8, 0], [8, 9]], 'loom', { row: 10, column: 3, rows: 2, columns: 2 })
    expect(canvasLiftCells(crossed, everywhere).map(({ x, width }) => [x / CELL_SIZE_PX, width / CELL_SIZE_PX])).toEqual([[-3, 2], [9, 1]])
  })
})

describe('the Frame\'s passes', () => {
  it('draws the empty positions and keeps the painted cells, then draws the painted beads only', () => {
    const drawn: (string | null)[] = []
    const draw = (_: unknown, bead: { color: string | null }) => drawn.push(bead.color)
    const { context } = recordingContext()
    const collect = liftCollector(draw, false)
    const bead = { x: 20, y: 0, size: 20, cornerRadius: 0, dimmed: false, deviceScale: 1, theme: PROJECT_THEMES.light }
    collect.drawer(context, { ...bead, color: null })
    collect.drawer(context, { ...bead, color: '#e63746' })
    paintedOnly(draw)(context, { ...bead, color: null })
    paintedOnly(draw)(context, { ...bead, color: '#e63746' })
    expect(drawn).toEqual([null, '#e63746'])
    expect(collect.cells).toEqual([{ x: 20, y: 0, width: 20, height: 20 }])
  })

  it('grows a redrawn band by the rows a piece reaches', () => {
    expect(liftRows(undefined, 20)).toBeUndefined()
    expect(liftRows({ first: 5, last: 6 }, 20)).toEqual({ first: 2, last: 9 })
  })
})
