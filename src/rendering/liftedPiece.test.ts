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
import { canvasLiftCells, drawLift, joinedUpright, LIFT_REACH_PX, liftCollector, liftLookOf, liftRows, liftsAcross, MOST_PARTS_PER_PATH, paintedOnly } from './liftedPiece'
import { positionBoxPx } from './surfaceView'

const painted = (cells: [number, number][], technique: Technique = 'loom', frame?: { row: number; column: number; rows: number; columns: number }, beadId = 'toho-cube-1.5mm') => {
  const project = createProject({ technique, beadId, size: { width: 3, height: 3, unit: 'beads' } })
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
      get: (target, key) => (key === 'fill' ? (...args: unknown[]) => (shadows.push({ color: target.shadowColor, blur: target.shadowBlur, down: target.shadowOffsetY }), (target.fill as (...args: unknown[]) => void)(...args)) : Reflect.get(target, key)),
      set: (target, key, value) => Reflect.set(target, key, value),
    })
    drawLift(watched, [cell], '#202020', 2)
    const fills = named('fill')
    expect(fills.map(({ fillStyle }) => fillStyle)).toEqual(['#8c8c8c', '#8c8c8c', '#8c8c8c', '#2b2b2b'])
    // Blur 4.5 px and 3 px down, then 1 px and 0.75 px down, in device px at twice: a canvas shadow's blur is two spreads.
    expect(shadows.slice(0, 2)).toEqual([
      { color: 'rgba(0, 0, 0, 0.6)', blur: 18, down: 6 },
      { color: 'rgba(0, 0, 0, 0.5)', blur: 4, down: 1.5 },
    ])
  })

  it('builds the shapes once, in one pass over the cells: the ground\'s 2.75px past each body, corners 3.75px, and the contour\'s 4px past it, corners 5px', () => {
    const { context, named } = recordingContext()
    drawLift(context, [cell, { ...cell, x: 100 }], '#fafafa', 1)
    // The body stands half a px in from its cell.
    expect(named('roundRect').map(({ args }) => args)).toEqual([
      [-2.25, -2.25, CELL_SIZE_PX + 4.5, CELL_SIZE_PX + 4.5, 3.75],
      [-3.5, -3.5, CELL_SIZE_PX + 7, CELL_SIZE_PX + 7, 5],
      [97.75, -2.25, CELL_SIZE_PX + 4.5, CELL_SIZE_PX + 4.5, 3.75],
      [96.5, -3.5, CELL_SIZE_PX + 7, CELL_SIZE_PX + 7, 5],
    ])
  })

  it('fills the contour\'s shape, then the ground\'s over it, and strokes nothing', () => {
    const { context, named } = recordingContext()
    drawLift(context, [cell], '#fafafa', 1)
    const shapes = named('fill').map(({ args }) => args[0])
    // The shadows are cast from the ground, then the contour, then the ground again.
    expect(shapes[2]).not.toBe(shapes[1])
    expect(shapes[3]).toBe(shapes[0])
    expect(named('fill').map(({ fillStyle }) => fillStyle)).toEqual(['#9a9a9a', '#9a9a9a', '#9a9a9a', '#fefefe'])
    expect(named('stroke')).toHaveLength(0)
  })

  it('puts a turned bead\'s cell into the shape by the turn it was drawn at, seen from the context\'s own transform', () => {
    const { context, named } = recordingContext()
    // The context draws at twice; the bead was drawn at twice and a quarter turn, its corner at (10, 0) on the surface.
    const watched = new Proxy(context, { get: (target, key) => (key === 'getTransform' ? () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }) : Reflect.get(target, key)) })
    drawLift(watched, [{ ...cell, transform: { a: 0, b: 2, c: -2, d: 0, e: 10, f: 0 } }], '#fafafa', 2)
    const matrices = named('addPath').map(({ args }) => args[1])
    // base⁻¹ · own: half the scale gone, a quarter turn and the corner at (5, 0) left.
    expect(matrices).toEqual([
      { a: 0, b: 1, c: -1, d: 0, e: 5, f: 0 },
      { a: 0, b: 1, c: -1, d: 0, e: 5, f: 0 },
    ])
  })

  describe('the shadows from the outline\'s edges in view alone (ticket 1034)', () => {
    /** The rows of a piece 60 beads wide, each one run. */
    const runs = (rows: number) => Array.from({ length: rows }, (_, row) => ({ x: 0, y: row * CELL_SIZE_PX, width: 60 * CELL_SIZE_PX, height: CELL_SIZE_PX }))
    /** How many fills cast a shadow, and the rounded rectangles drawn, for a piece of `rows` rows. */
    const shadowed = (rows: number, view?: { left: number; top: number; right: number; bottom: number }) => {
      const { context, named } = recordingContext()
      let blurred = 0
      const watched = new Proxy(context, {
        get: (target, key) => (key === 'fill' ? (...args: unknown[]) => ((blurred += target.shadowBlur > 0 ? 1 : 0), (target.fill as (...args: unknown[]) => void)(...args)) : Reflect.get(target, key)),
        set: (target, key, value) => Reflect.set(target, key, value),
      })
      drawLift(watched, runs(rows), '#fafafa', 2, true, view)
      return { blurred, rects: named('roundRect').map(({ args }) => args as number[]) }
    }

    it('casts none where the piece fills the view, and still lays its contour and ground', () => {
      const { blurred, rects } = shadowed(40, { left: 200, top: 200, right: 800, bottom: 600 })
      expect(blurred).toBe(0)
      // The ground's and the contour's shapes, one each a row.
      expect(rects).toHaveLength(80)
    })

    it('casts the shadow from a piece\'s edges, cut where a row\'s inside lies further from them than a shadow reaches', () => {
      const { rects } = shadowed(40)
      // After the ground's and the contour's 80, the shadow's: the rows near the top and bottom whole, the others cut to their two ends.
      const shadow = rects.slice(80)
      const middle = shadow.filter(([, y]) => y! > 10 * CELL_SIZE_PX && y! < 30 * CELL_SIZE_PX)
      expect(middle.length).toBeGreaterThan(0)
      for (const [x, , width] of middle) expect(x! < 2 * CELL_SIZE_PX || x! + width! > 58 * CELL_SIZE_PX).toBe(true)
      expect(Math.max(...middle.map(([, , width]) => width!))).toBeLessThan(4 * CELL_SIZE_PX)
      const top = shadow.filter(([, y]) => y! < 0)
      expect(top.map(([, , width]) => width)).toEqual([60 * CELL_SIZE_PX + 4.5])
    })

    it('cuts a column\'s run as a row\'s, where the cells are taller than wide (peyote)', () => {
      const { context, named } = recordingContext()
      const columns = Array.from({ length: 40 }, (_, column) => ({ x: column * CELL_SIZE_PX, y: 0, width: CELL_SIZE_PX, height: 60 * CELL_SIZE_PX }))
      drawLift(context, columns, '#fafafa', 2, false)
      // After the ground's and the contour's 80, the shadow's: a column in the middle keeps its two ends alone.
      const middle = named('roundRect').map(({ args }) => args as number[]).slice(80).filter(([x]) => x! > 10 * CELL_SIZE_PX && x! < 30 * CELL_SIZE_PX)
      expect(middle.length).toBeGreaterThan(0)
      expect(Math.max(...middle.map(([, , , height]) => height!))).toBeLessThan(4 * CELL_SIZE_PX)
    })

    it('keeps a turned bead\'s cell whole near an edge and leaves it out far inside the piece', () => {
      const { context, named } = recordingContext()
      // 30 × 30 beads, each put in its place by a transform of its own, as a Custom frame's are.
      const turned = Array.from({ length: 900 }, (_, at) => ({ x: 0, y: 0, width: CELL_SIZE_PX, height: CELL_SIZE_PX, transform: { a: 1, b: 0, c: 0, d: 1, e: (at % 30) * CELL_SIZE_PX, f: Math.floor(at / 30) * CELL_SIZE_PX } }))
      drawLift(context, turned, '#fafafa', 2)
      // After the ground's and the contour's 1800 parts, the shadow's: the beads within a shadow's reach of the outline.
      const cast = named('addPath').slice(1800).map(({ args }) => args[1] as { e: number; f: number })
      expect(cast.length).toBeGreaterThan(0)
      expect(cast.length).toBeLessThan(900)
      const inside = ({ e, f }: { e: number; f: number }) => Math.min(e, f, 29 * CELL_SIZE_PX - e, 29 * CELL_SIZE_PX - f)
      expect(Math.max(...cast.map(inside))).toBeLessThan(3 * CELL_SIZE_PX)
      expect(cast.some((at) => inside(at) === 0)).toBe(true)
    })

    it('casts it from the ground\'s own shape where every cell is near an edge', () => {
      const { context, named } = recordingContext()
      drawLift(context, runs(2), '#fafafa', 2, true, { left: -100, top: -100, right: 2000, bottom: 200 })
      const shapes = named('fill').map(({ args }) => args[0])
      expect(shapes[0]).toBe(shapes.at(-1))
    })
  })

  it('fills a shape of many parts a few parts at a time, never as one path (ticket 1034)', () => {
    const { context, named } = recordingContext()
    // A checkered row: 100 beads apart, each a part of the ground and a part of the contour.
    drawLift(context, Array.from({ length: 100 }, (_, at) => ({ ...cell, x: at * 2 * CELL_SIZE_PX })), '#fafafa', 1)
    const ground = named('fill').filter(({ fillStyle }) => fillStyle === liftLookOf('#fafafa').ground).map(({ args }) => args[0])
    expect(ground).toHaveLength(Math.ceil(100 / MOST_PARTS_PER_PATH))
    expect(new Set(ground).size).toBe(ground.length)
  })

  it('draws nothing with no bead', () => {
    const { context, calls } = recordingContext()
    drawLift(context, [], '#fafafa', 1)
    expect(calls).toHaveLength(0)
  })
})

describe('drawLift of round beads (ticket 1010, Open weave)', () => {
  const round = { x: 0, y: 0, width: CELL_SIZE_PX, height: CELL_SIZE_PX * 1.4, bead: CELL_SIZE_PX }

  it('rounds a round bead\'s cell by its own half circle, grown with the shape: a single bead is a pill', () => {
    const { context, named } = recordingContext()
    drawLift(context, [round], '#fafafa', 1)
    const [ground, contour] = named('roundRect').map(({ args }) => args)
    // The body stands half a px in from its cell and is as wide as the cell less a px, so its end is that wide's half.
    expect(ground).toEqual([-2.25, -2.25, CELL_SIZE_PX + 4.5, round.height + 4.5, CELL_SIZE_PX / 2 + 2.25])
    expect(contour).toEqual([-3.5, -3.5, CELL_SIZE_PX + 7, round.height + 7, CELL_SIZE_PX / 2 + 3.5])
  })

  it('keeps the card\'s corners for a bead whose corner is not a half circle', () => {
    const { context, named } = recordingContext()
    drawLift(context, [{ ...round, bead: undefined }], '#fafafa', 1)
    expect(named('roundRect').map(({ args }) => args[4])).toEqual([3.75, 5])
  })

  const row = (column: number, columns: number, line: number) => ({ ...round, x: column * CELL_SIZE_PX, y: line * round.height, width: columns * CELL_SIZE_PX })

  it('rounds an inner corner where a row reaches further than the row under it, as big as the shape\'s own corner', () => {
    const { context, named } = recordingContext()
    // The long row hangs two beads over the short one on each side: room for the card's whole rounding.
    drawLift(context, [row(0, 6, 0), row(2, 2, 1)], '#fafafa', 1)
    const radii = named('pathArc').map(({ args }) => args[2] as number).sort((a, b) => a - b)
    expect(radii).toEqual([3.75, 3.75, 5, 5])
  })

  it('keeps two roundings that face each other across a gap from passing its middle', () => {
    const { context, named } = recordingContext()
    // Two beads under a row, half a bead apart: the gap is 10, its middle at 25 (the left bead ends at 20).
    drawLift(context, [row(0, 5, 0), row(0, 1, 1), { ...row(0, 1, 1), x: CELL_SIZE_PX * 1.5 }], '#fafafa', 1)
    const centres = named('pathArc').map(({ args }) => args[0] as number).filter((x) => x > CELL_SIZE_PX && x < CELL_SIZE_PX * 1.5)
    // Emitted left bead first (ground, contour), then the right one.
    expect(centres).toHaveLength(4)
    expect(centres.slice(0, 2).every((x) => x <= 25)).toBe(true)
    expect(centres.slice(2).every((x) => x >= 25)).toBe(true)
  })

  it('rounds the one corner of a row that reaches further on one side only, and none between two alike', () => {
    const { context, named } = recordingContext()
    drawLift(context, [row(0, 4, 0), row(0, 2, 1)], '#fafafa', 1)
    expect(named('pathArc')).toHaveLength(2)
    const alike = recordingContext()
    drawLift(alike.context, [row(0, 4, 0), row(0, 4, 1)], '#fafafa', 1)
    expect(alike.named('pathArc')).toHaveLength(0)
  })

  it('rounds none where the step is smaller than the bead\'s own corner leaves room for', () => {
    const { context, named } = recordingContext()
    // A step of half a bead, as in brick stitch: the straight edge ends before the step begins.
    drawLift(context, [{ ...round, width: 4 * CELL_SIZE_PX }, { ...round, x: CELL_SIZE_PX / 2, y: round.height, width: 4 * CELL_SIZE_PX }], '#fafafa', 1)
    expect(named('pathArc')).toHaveLength(0)
  })
})

describe('canvasLiftCells', () => {
  it.each([
    ['toho/round/11-0', true],
    ['miyuki/round/11-0', true],
    ['miyuki/delica/11-0', false],
    ['toho/cube/1.5mm', false],
  ])('gives %s\'s cells the bead\'s width: %s, in every Technique', (beadId, round) => {
    const cells = [[0, 0], [0, 1], [1, 1]] as [number, number][]
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const lifted = canvasLiftCells(painted(cells, technique, undefined, beadId), everywhere)
      expect(lifted.length).toBeGreaterThan(0)
      expect(lifted.every((cell) => ('bead' in cell) === round && (!round || cell.bead === CELL_SIZE_PX))).toBe(true)
    }
  })

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
    // The soft shadow's fall, three spreads of its blur and the contour: the BeadBoard card's 20.5px (ticket 1033).
    expect(LIFT_REACH_PX).toBe(20.5)
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

  it('notes a round bead\'s width on its cell, and a bead whose corner is not a half circle\'s none', () => {
    const { context } = recordingContext()
    const collect = liftCollector(() => {}, false)
    const bead = { x: 0, y: 0, size: 20, width: 20, height: 28, dimmed: false, deviceScale: 1, color: '#e63746', theme: PROJECT_THEMES.light }
    collect.drawer(context, { ...bead, cornerRadius: 10 })
    collect.drawer(context, { ...bead, x: 40, cornerRadius: 2 })
    expect(collect.cells).toEqual([{ x: 0, y: 0, width: 20, height: 28, bead: 20 }, { x: 40, y: 0, width: 20, height: 28 }])
  })

  it('joins a Frame\'s upright beads that touch into one cell as the Canvas does, round or not, and leaves the turned ones', () => {
    const bead = (x: number, y: number) => ({ x, y, width: 20, height: 28, bead: 20 })
    const square = { x: 0, y: 100, width: 20, height: 28 }
    const across = joinedUpright([bead(0, 0), bead(20, 0), bead(60, 0), bead(0, 28), square, { ...square, x: 20 }], true)
    expect(across).toEqual([{ ...bead(0, 0), width: 40 }, bead(60, 0), bead(0, 28), { ...square, width: 40 }])
    const down = joinedUpright([bead(0, 0), bead(0, 28), bead(20, 14)], false)
    expect(down).toEqual([{ ...bead(0, 0), height: 56 }, bead(20, 14)])
    expect(joinedUpright([square, { ...square, y: 128 }, { ...square, x: 20, y: 114 }], false)).toEqual([{ ...square, height: 56 }, { ...square, x: 20, y: 114 }])
    const turned = { ...square, transform: { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 } }
    expect(joinedUpright([square, turned, { ...turned, x: 20 }, { ...square, x: 20 }], true)).toEqual([turned, { ...turned, x: 20 }, { ...square, width: 40 }])
  })

  it('makes one cell a row of a full Frame of square beads, not one a bead (ticket 1030)', () => {
    // One rectangle per bead is 30 030 for this Frame, a shape Safari took 15 s to cast a shadow from; one per row is 231.
    const [columns, rows, side] = [130, 231, 20]
    const cells = Array.from({ length: rows * columns }, (_, at) => ({ x: (at % columns) * side, y: Math.floor(at / columns) * side, width: side, height: side }))
    const joined = joinedUpright(cells, true)
    expect(joined).toHaveLength(rows)
    expect(joined.every((cell) => cell.x === 0 && cell.width === columns * side && cell.height === side)).toBe(true)
  })

  it('lifts runs of a row in loom and brick stitch, of a column in peyote', () => {
    expect([liftsAcross({ technique: 'loom' }), liftsAcross({ technique: 'brick' }), liftsAcross({ technique: 'peyote' })]).toEqual([true, true, false])
  })

  it('grows a redrawn band by the rows a piece reaches', () => {
    expect(liftRows(undefined, 20)).toBeUndefined()
    expect(liftRows({ first: 5, last: 6 }, 20)).toEqual({ first: 2, last: 9 })
  })
})
