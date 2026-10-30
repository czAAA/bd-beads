import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withColors } from '../domain/canvas'
import { type Rotation } from '../domain/grid'
import { type Technique } from '../domain/weave'
import { createProject } from '../domain/createProject'
import { findBead } from '../domain/beads'
import { replaceBead } from '../domain/projectBead'
import { canvasWeave, weaveOf } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { recordingContext } from '../testUtils/recordingContext'
import { BEAD_GAP_PX, DEFAULT_THEME, PROJECT_THEMES, type BeadShape, type ProjectTheme } from './beadLook'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { CELL_SIZE_PX } from './cellSize'
import { gridToRegion, positionBoxPx, type Region } from './surfaceView'
import { beadsOfLayer, canvasOf, frameOf, withLayer } from '../domain/layerRecord'
import { withLayers } from '../testUtils/layerFields'
import { changeFrame } from '../domain/changeFrame'

/** A 3-wide, 4-tall Frame at row 6, column 5, every position painted, with Row progress on and two rows done. */
function framedProject(technique: Technique, rotation: Rotation = 0): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: 3, height: 4, unit: 'beads' } })
  const cells = Array.from({ length: 12 }, (_, index) => ({ row: Math.floor(index / 3), column: index % 3, color: '#e63746' }))
  const frame = { ...weaveOf(canvasOf(project)), technique, row: 6, column: 5, rows: 4, columns: 3, beads: withColors({}, cells) }
  return withLayers(project, { technique, orientation: rotation, frame, rowProgress: { direction: 'rows', currentRow: 2, currentColumn: 0 } })
}

const view: Region = { x: 0, y: 0, width: 400, height: 400 }

// jsdom has no canvas to make the Position marks' tile on: hand it one that records.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingContext().context as unknown as CanvasRenderingContext2D)
})
afterEach(() => {
  vi.restoreAllMocks()
})

/** The rectangles filled with the Position marks' pattern (an object; everything else is filled with a color). */
const markFills = (named: (name: string) => { args: unknown[]; fillStyle: unknown }[]) =>
  named('fillRect')
    .filter((call) => typeof call.fillStyle === 'object')
    .map(({ args: [x, y, width, height] }) => ({ left: x as number, top: y as number, right: (x as number) + (width as number), bottom: (y as number) + (height as number) }))

function render(project: Project, open: boolean, extra: { region?: Region; rows?: { first: number; last: number }; zoom?: number; theme?: ProjectTheme; frameTheme?: ProjectTheme } = {}) {
  const beads: BeadShape[] = []
  const { context, calls, named } = recordingContext()
  renderProject(context, {
    project,
    space: spaceOf(project, open),
    region: extra.region ?? view,
    zoom: extra.zoom ?? 1,
    rows: extra.rows,
    theme: extra.theme,
    frameTheme: extra.frameTheme,
    drawBead: (_c, bead) => beads.push(bead),
  })
  return { beads, calls, named, context }
}

describe.each<Technique>(['loom', 'peyote', 'brick'])('renderProject, %s', (technique) => {
  describe.each([
    { space: 'open', open: true, origin: { row: 6, column: 5 } },
    { space: 'Frame-only', open: false, origin: { row: 0, column: 0 } },
  ])('in $space space', ({ open, origin }) => {
    it('puts every bead of the Frame where its row and column say, shifted by the bead\'s own row', () => {
      const project = framedProject(technique)

      const painted = render(project, open).beads.filter(({ color }) => color !== null)

      const expected = Array.from({ length: 12 }, (_, index) => {
        const row = origin.row + Math.floor(index / 3)
        const column = origin.column + (index % 3)
        // The Frame starts on an even row, so a row's shift is the same numbered in the space or in the Project.
        const { x, y } = positionBoxPx({ technique }, row, column)
        return { x, y }
      })
      expect(painted.map(({ x, y }) => ({ x, y }))).toEqual(expected)
    })

    it('turns about the right point at a quarter turn: the box round the Frame, or the origin when open', () => {
      const project = framedProject(technique, 90)
      const { named } = render(project, open, { region: { x: 10, y: 20, width: 300, height: 300 }, zoom: 2 })

      expect(named('setTransform').at(-1)!.args).toEqual(gridToRegion(spaceOf(project, open).extent, { x: 10, y: 20, width: 300, height: 300 }, 2, 90))
    })
  })

  it('fills the background only on its own; the Canvas stays transparent and is marked outside the Frame', () => {
    const project = framedProject(technique)
    const onItsOwn = render(project, false)
    const open = render(project, true)

    expect(onItsOwn.named('fillRect').some((call) => call.fillStyle === DEFAULT_THEME.background && call.args[2] === view.width)).toBe(true)
    expect(markFills(onItsOwn.named)).toEqual([])
    expect(open.named('fillRect').some((call) => call.fillStyle === DEFAULT_THEME.background)).toBe(false)
    expect(markFills(open.named).length).toBeGreaterThan(0)
    expect(open.named('arc')).toHaveLength(0)
  })

  it('fades a finished row toward the board on its own and toward the drawing area when open', () => {
    const project = framedProject(technique)
    const fadedOnItsOwn = render(project, false).beads.filter(({ dimmed }) => dimmed)
    const fadedOpen = render(project, true).beads.filter(({ dimmed }) => dimmed)

    // Rows 0 and 1 of the Frame, three beads each; on peyote pass 2 has row 0 whole and row 1's beads 0 and 2 finished (ticket 347).
    const finished = technique === 'peyote' ? 5 : 6
    expect(fadedOnItsOwn).toHaveLength(finished)
    expect(fadedOpen).toHaveLength(finished)
    expect(fadedOnItsOwn.every(({ theme }) => theme.background === DEFAULT_THEME.background)).toBe(true)
    expect(fadedOpen.every(({ theme }) => theme.background === DEFAULT_THEME.canvas)).toBe(true)
  })

  describe('drawing only some rows again', () => {
    const topOf = (open: boolean, row: number) => {
      const project = framedProject(technique)
      const { named } = render(project, open, { rows: { first: row, last: row } })
      return named('rect')[0]!.args as number[]
    }

    it('clears a band across the Frame on its own, and across the viewport when open', () => {
      const [x, , width] = topOf(false, 2)
      const [openX, , openWidth] = topOf(true, 8)
      const extentWidth = spaceOf(framedProject(technique), false).extent.width

      expect([x, width]).toEqual([0, extentWidth])
      expect([openX, openWidth]).toEqual([0, view.width])
    })

    it('starts a band at the top of its first row, with no seam above it', () => {
      expect(topOf(false, 2)[1]).toBe(positionBoxPx({ technique }, 2, 0).y)
      expect(topOf(false, 0)[1]).toBe(positionBoxPx({ technique }, 0, 0).y)
      expect(topOf(true, 8)[1]).toBe(positionBoxPx({ technique }, 8, 0).y)
    })
  })
})

describe('the Frame on its own background (ticket 0666)', () => {
  const canvasLook = PROJECT_THEMES.light
  const frameLook: ProjectTheme = { ...PROJECT_THEMES.dark, canvas: '#3b3e43', background: '#3b3e43', positionMark: '#50545a', emptyBead: '#50545a' }
  const whole = { x: -1000, y: -1000, width: 2000, height: 2000 }

  it('fills the Frame\'s box in its background on the Canvas and draws its beads and marks in its look', () => {
    const project = withLayers(framedProject('loom'), { beads: {} })
    const { named, beads } = render(project, true, { region: whole, theme: canvasLook, frameTheme: frameLook })

    const fills = named('fillRect').filter((call) => call.fillStyle === frameLook.canvas)
    expect(fills).toHaveLength(1)
    const [x, y, width, height] = fills[0]!.args as number[]
    const corner = positionBoxPx({ technique: 'loom' }, 6, 5)
    expect([x, y]).toEqual([corner.x - BEAD_GAP_PX / 2, corner.y - BEAD_GAP_PX / 2])
    expect([width, height]).toEqual([3 * CELL_SIZE_PX + BEAD_GAP_PX, 4 * CELL_SIZE_PX + BEAD_GAP_PX])
    expect(beads.every(({ theme }) => theme.emptyBead === frameLook.emptyBead && theme.background === frameLook.canvas)).toBe(true)
    // Four strips round the margin's box in the Canvas's marks, and a fifth over the Frame in its own.
    expect(markFills(named)).toHaveLength(5)
  })

  it('fills nothing more where the Frame is on the Canvas\'s background, and on its own fills its board', () => {
    const project = framedProject('loom')
    const alike = render(project, true, { region: whole, theme: canvasLook, frameTheme: { ...canvasLook } })
    expect(alike.named('fillRect').filter((call) => typeof call.fillStyle === 'string')).toHaveLength(0)

    const alone = render(project, false, { theme: canvasLook, frameTheme: frameLook })
    expect(alone.named('fillRect').some((call) => call.fillStyle === frameLook.background && call.args[2] === view.width)).toBe(true)
    expect(alone.beads.every(({ theme }) => theme.emptyBead === frameLook.emptyBead)).toBe(true)
  })

  it('fills the box a Frame in another Bead draws, at its own size (ticket 0665)', () => {
    const project = withLayer(withLayers(framedProject('loom'), { beads: {} }), 'frame', { bead: findBead('miyuki-delica-11-0')! })
    const { named, beads } = render(project, true, { region: whole, theme: canvasLook, frameTheme: frameLook })

    const fills = named('fillRect').filter((call) => call.fillStyle === frameLook.canvas)
    expect(fills).toHaveLength(1)
    const [, , width, height] = fills[0]!.args as number[]
    expect([width, height]).not.toEqual([3 * CELL_SIZE_PX + BEAD_GAP_PX, 4 * CELL_SIZE_PX + BEAD_GAP_PX])
    expect(beads.every(({ theme }) => theme.emptyBead === frameLook.emptyBead)).toBe(true)
  })

  it('draws a Custom frame\'s Off-shape in the Frame\'s background', () => {
    const plain = createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } })
    const shaped = changeFrame(plain, { custom: { shape: 'triangle', size: 5, centre: { row: 10, column: 10 } } })
    if (shaped.kind !== 'changed') throw new Error('expected a Triangle')
    const { named } = render(shaped.project, true, { region: whole, theme: canvasLook, frameTheme: frameLook })
    expect(named('fillRect').filter((call) => call.fillStyle === frameLook.canvas)).toHaveLength(1)
    // Its Off-shape holds no position, so the box has no marks of its own.
    expect(markFills(named)).toHaveLength(4)
  })
})

describe('brick stitch inside a Frame', () => {
  it('draws no seam line between two rows, in either space', () => {
    const project = framedProject('brick')

    for (const open of [false, true]) {
      expect(render(project, open).named('fillRect').filter((call) => call.args[3] === 1)).toEqual([])
    }
  })
})

describe('the Frame margin on the Canvas (ticket 276)', () => {
  it('fills no marks in the margin outside the Frame, leaving a flat gap, and runs them right up to the margin', () => {
    const project = framedProject('loom')
    const { named } = render(withLayers(project, { frame: { technique: 'loom' as const, row: 10, column: 10, rows: 4, columns: 3, beads: {} } }), true, { region: { x: 0, y: 0, width: 500, height: 500 } })

    const fills = markFills(named)
    expect(fills.length).toBeGreaterThan(0)
    // The Frame is rows 10 to 13 and columns 10 to 12; its margin is 4 round it, rows 6 to 17 and columns 6 to 16: x 120 to 340, y 120 to 360 (the marks' own edge sits 5 in from it).
    // The one fill over the Frame itself (its cells' outlines, ticket 458) is the Frame's own columns, 200 to 260, half a gap out.
    const touchesMargin = fills.filter(({ left, right, top, bottom }) => left < 345 && right > 125 && top < 360 && bottom > 120 && !(left === 199.5 && right === 260.5))
    expect(touchesMargin).toEqual([])
    expect(fills.some(({ right, top, bottom }) => right === 125 && top < 360 && bottom > 120)).toBe(true)
  })

  describe('as a sheet of drafting paper (ticket 0656, MarginSheet card)', () => {
    const theme: ProjectTheme = { ...DEFAULT_THEME, margin: { fill: '#123456', line: '#abcdef', edge: '#fedcba', edgeWidth: 2, ruler: '#000000', rulerStrong: '#000000' } }
    // The Frame is rows 10 to 13 and columns 10 to 12, its margin rows 6 to 17 and columns 6 to 16: x 120 to 340, y 120 to 360.
    const frame = { technique: 'loom' as const, row: 10, column: 10, rows: 4, columns: 3, beads: {} }
    const drawn = (open: boolean, zoom = 1, withFrame = true) => {
      const project = framedProject('loom')
      return render(withLayers(project, { frame: withFrame ? frame : undefined }), open, { region: { x: 0, y: 0, width: 800, height: 800 }, zoom, theme })
    }
    const strokedIn = (calls: ReturnType<typeof drawn>['calls'], color: string) => calls.filter((call) => call.name === 'stroke' && call.strokeStyle === color)
    const roundRects = (calls: ReturnType<typeof drawn>['calls']) => calls.filter((call) => call.name === 'roundRect').map(({ args }) => args)

    /** Whether a drawn rectangle is at these grid px, within a rounding. */
    const near = (rects: unknown[][], wanted: number[]) => rects.some((rect) => wanted.every((value, index) => Math.abs(Number(rect[index]) - value) < 1e-6))

    // At 100% the band is 4 beads of 20px: 80px, the drafting sheet's 72px at a scale of 80 / 72 (ticket 0698).
    it('fills the band in the margin color, its corners rounded 12px at the sheet\'s scale, leaving the Frame\'s footprint out', () => {
      const { calls } = drawn(true)
      const fill = calls.find((call) => call.name === 'fill' && call.fillStyle === '#123456')
      expect(fill?.args).toEqual(['evenodd'])
      expect(near(roundRects(calls), [120, 120, 220, 240, 12 * (80 / 72)])).toBe(true)
    })

    it('draws its edge and its inner border 10px in, radius 6, at the sheet\'s scale, in the margin line', () => {
      const { calls } = drawn(true)
      const inset = 10 * (80 / 72)
      expect(strokedIn(calls, '#fedcba')).toHaveLength(1)
      expect(strokedIn(calls, '#abcdef')).toHaveLength(1)
      expect(near(roundRects(calls), [120 + inset, 120 + inset, 220 - 2 * inset, 240 - 2 * inset, 6 * (80 / 72)])).toBe(true)
    })

    it('scales its inset and corners with the band up to 1.5 (ticket 0698)', () => {
      // At 200% the band is 160px: the scale is held at 1.5, so 15 screen px in, 7.5 grid px.
      const { calls } = drawn(true, 2)
      expect(near(roundRects(calls), [120, 120, 220, 240, 9])).toBe(true)
      expect(near(roundRects(calls), [127.5, 127.5, 205, 225, 4.5])).toBe(true)
    })

    it('draws the compact form\'s inner border 6px in and corners of 10px at the smallest scale, and none once the sheet folds (tickets 0658, 0698)', () => {
      // At 40% the band is 32px: under 0.6 of the full form's 68px, so compact at 0.6: 3.6px in, 9 grid px; corners 6px, 15 grid px.
      const compact = roundRects(drawn(true, 0.4).calls)
      expect(near(compact, [129, 129, 202, 222, 6 * 0.6 / 0.4])).toBe(true)
      expect(near(compact, [120, 120, 220, 240, 15])).toBe(true)
      // At 25% the band is 20px, folded: the paper keeps its color and its edge, with no inner border.
      expect(strokedIn(drawn(true, 0.25).calls, '#abcdef')).toHaveLength(0)
      expect(strokedIn(drawn(true, 0.25).calls, '#fedcba')).toHaveLength(1)
    })

    it('is not drawn at all under 0.6 of the folded row\'s 31px, where only its Move bar is left (tickets 0682, 0698)', () => {
      // At 23% the band is 18.4px: no paper, no edge, no inner border.
      for (const zoom of [0.23, 0.2, 0.1]) {
        const { calls } = drawn(true, zoom)
        expect(calls.some((call) => call.fillStyle === '#123456' || call.strokeStyle === '#fedcba' || call.strokeStyle === '#abcdef'), `${zoom}`).toBe(false)
      }
      expect(drawn(true, 0.24).calls.some((call) => call.name === 'fill' && call.fillStyle === '#123456')).toBe(true)
    })

    it('is never drawn in an export, which draws the Frame on its own, nor with no Frame', () => {
      expect(drawn(false).calls.some((call) => call.fillStyle === '#123456' || call.strokeStyle === '#abcdef')).toBe(false)
      expect(drawn(true, 1, false).calls.some((call) => call.fillStyle === '#123456' || call.strokeStyle === '#abcdef')).toBe(false)
    })

    it('is white with a black edge in high contrast', () => {
      const project = framedProject('loom')
      const { calls } = render(withLayers(project, { frame }), true, { region: { x: 0, y: 0, width: 800, height: 800 }, theme: PROJECT_THEMES.contrast })
      expect(calls.some((call) => call.name === 'fill' && call.fillStyle === '#ffffff')).toBe(true)
      expect(strokedIn(calls, '#000000').length).toBeGreaterThan(0)
    })
  })
})

describe('Position marks cost one pattern fill, however far out', () => {
  it.each<Technique>(['loom', 'peyote', 'brick'])('is the same number of fills at the Zoom floor and at 100% (%s)', (technique) => {
    const project = withLayers(framedProject(technique), { frame: undefined })
    const wide: Region = { x: 0, y: 0, width: 1600, height: 1000 }

    const floor = render(project, true, { region: wide, zoom: 0.1 })
    const full = render(project, true, { region: wide, zoom: 1 })

    expect(markFills(floor.named)).toHaveLength(1)
    expect(markFills(full.named)).toHaveLength(1)
    expect(floor.named('arc')).toHaveLength(0)
  })

  it('draws only the Frame\'s cells and the painted beads in view, whatever the zoom', () => {
    const project: Project = withLayers(framedProject('loom'), { beads: withColors(beadsOfLayer(framedProject('loom'), 'canvas'), [{ row: 40, column: 40, color: '#00f' }, { row: 5000, column: 5000, color: '#00f' }]) })
    const wide: Region = { x: 0, y: 0, width: 1600, height: 1000 }

    const { beads } = render(project, true, { region: wide, zoom: 0.1 })

    // 12 Frame cells and the one painted bead in view; the other is a thousand beads out of sight.
    expect(beads).toHaveLength(13)
  })

  it.each<{ technique: Technique; rotation: Rotation }>(
    (['loom', 'peyote', 'brick'] as const).flatMap((technique) => ([0, 90, 180, 270] as const).map((rotation) => ({ technique, rotation }))),
  )('draws the Frame\'s cells and the beads outside it once each: $technique at $rotation°', ({ technique, rotation }) => {
    const base = framedProject(technique, rotation)
    const project: Project = withLayers(base, { beads: withColors(beadsOfLayer(base, 'canvas'), [{ row: 30, column: 30, color: '#00f' }, { row: 20, column: 2, color: '#00f' }]) })

    const { beads } = render(project, true, { region: { x: -1000, y: -1000, width: 2000, height: 2000 } })

    // The Frame's 12 cells, and the two beads outside it.
    expect(beads).toHaveLength(14)
  })
})

describe('Position marks tile', () => {
  function tileCalls(technique: Technique) {
    const tile = recordingContext()
    // A tile is made on a canvas of its own (one per Technique): hand it the one that records.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(tile.context as unknown as CanvasRenderingContext2D)
    // A Bead this device does not know draws the Technique's own cell, the one these marks are about.
    const project = withLayers(framedProject(technique), { frame: undefined, bead: undefined })
    const { context } = recordingContext()
    renderProject(context, { project, space: spaceOf(project, true), region: view, zoom: 1.51 })
    return tile
  }

  it('draws squares as outlines with the Technique\'s corner radius and no arcs', () => {
    const loom = tileCalls('loom')
    expect(loom.named('arc')).toHaveLength(0)
    expect(loom.named('stroke').length).toBeGreaterThan(0)
    // Loom beads are square: the corner arcs have no radius.
    expect(loom.named('arcTo').every((call) => call.args[4] === 0)).toBe(true)

    const peyote = tileCalls('peyote')
    expect(peyote.named('arcTo').some((call) => (call.args[4] as number) > 0)).toBe(true)
  })

  it('draws one shared 1px line on each cell\'s edge, and clears the bead inside it', () => {
    // A technique of its own, as a tile is kept per Technique.
    const { named } = tileCalls('brick')
    // The outline sits on the cell's edge (a neighbour's is the same line), the clearing is the bead, half a gap in.
    const rights = named('arcTo').map((call) => call.args[0] as number)
    expect(rights).toContain(CELL_SIZE_PX)
    expect(rights).toContain(CELL_SIZE_PX - BEAD_GAP_PX / 2)
  })

  it('fills the marks over the Frame\'s own positions too', () => {
    const project = framedProject('loom')
    const { named } = render(project, true, { region: { x: -1000, y: -1000, width: 2000, height: 2000 } })
    // Four strips round the margin's box, and a fifth over the Frame itself.
    expect(markFills(named)).toHaveLength(5)
  })

  it('leaves a bead in the keep-out margin undrawn, still held by the Project', () => {
    const base = framedProject('loom')
    const project: Project = withLayers(base, { beads: withColors(beadsOfLayer(base, 'canvas'), [{ row: 2, column: 1, color: '#00f' }, { row: 13, column: 11, color: '#00f' }]) })

    const { beads } = render(project, true, { region: { x: -1000, y: -1000, width: 2000, height: 2000 } })

    expect(beads).toHaveLength(12)
    expect(beadsOfLayer(project, 'canvas')[2]?.[1]).toBe('#00f')
  })
})

/** The Frame woven in `frame` over a Canvas woven in `canvas`: 3 across, 4 down, at row 6, column 5, every position painted. */
function mixedProject(canvas: Technique, frame: Technique): Project {
  const base = framedProject(canvas)
  return withLayers(base, { technique: canvas, frame: { ...frameOf(base)!, technique: frame } })
}

describe.each<{ canvas: Technique; frame: Technique }>([
  { canvas: 'loom', frame: 'peyote' },
  { canvas: 'peyote', frame: 'loom' },
  { canvas: 'loom', frame: 'brick' },
])('a $frame Frame over a $canvas Canvas (ticket 492)', ({ canvas, frame }) => {
  const origin = positionBoxPx({ technique: canvas }, 6, 5)

  it('draws the Frame\'s beads in its own Weave from the corner of the Canvas position it lies on, its first row straight', () => {
    const painted = render(mixedProject(canvas, frame), true).beads.filter(({ color }) => color !== null)

    expect(painted.map(({ x, y }) => ({ x, y }))).toEqual(
      Array.from({ length: 12 }, (_, index) => {
        const row = Math.floor(index / 3)
        const own = positionBoxPx({ technique: frame }, row, index % 3)
        return { x: origin.x + own.x, y: origin.y + own.y }
      }),
    )
  })

  it('draws it exactly as the Frame alone, only moved', () => {
    const own = render(mixedProject(canvas, frame), false).beads.filter(({ color }) => color !== null)
    const open = render(mixedProject(canvas, frame), true).beads.filter(({ color }) => color !== null)

    expect(open.map(({ x, y }) => ({ x: x - origin.x, y: y - origin.y }))).toEqual(own.map(({ x, y }) => ({ x, y })))
  })

  it('counts Row progress in the Frame\'s Weave', () => {
    const dimmed = render(mixedProject(canvas, frame), true).beads.filter(({ dimmed: faded }) => faded)

    // Two passes done: whole rows 0 and 1 on loom and brick stitch; on peyote row 0 and the even beads of row 1.
    expect(dimmed).toHaveLength(frame === 'peyote' ? 5 : 6)
  })

  it('hides the Canvas bead lying under the Frame, and draws the one beside it', () => {
    const base = mixedProject(canvas, frame)
    const project = withLayers(base, { beads: withColors({}, [{ row: 6, column: 5, color: '#111111' }, { row: 6, column: 20, color: '#222222' }]) })

    const colors = render(project, true).beads.map(({ color }) => color)

    expect(colors).not.toContain('#111111')
    expect(colors).toContain('#222222')
  })
})

describe('a Frame in a Bead of its own over the Canvas (ticket 0665)', () => {
  /** The 3 by 4 loom Frame at row 6, column 5, in TOHO 15/0 over a TOHO 8/0 Canvas: half as wide. */
  function halfSize(): Project {
    const base = createProject({ technique: 'loom', beadId: 'toho/round/8-0', size: { width: 3, height: 4, unit: 'beads' } })
    const framed = withLayers(base, { frame: { ...frameOf(framedProject('loom'))!, beadId: base.layers[0].beadId } })
    return replaceBead(framed, findBead('toho/round/15-0')!)
  }

  it('draws the Frame from its corner at its own Bead\'s size: its beads at their own place, scaled by it', () => {
    const { beads, named } = render(halfSize(), true)
    const origin = positionBoxPx(canvasWeave(halfSize()), 6, 5)
    expect(named('translate').map(({ args }) => args)).toContainEqual([origin.x, origin.y])
    expect(named('scale').map(({ args }) => args)).toEqual([[0.5, 0.5]])
    expect(beads.filter(({ color }) => color !== null).slice(0, 2).map(({ x, y }) => ({ x, y }))).toEqual([{ x: 0, y: 0 }, { x: CELL_SIZE_PX, y: 0 }])
  })

  it('makes its bead bitmaps at the size they are on screen', () => {
    const { beads } = render(halfSize(), true, { zoom: 2 })
    expect(beads.find(({ color }) => color !== null)!.deviceScale).toBe(1)
  })

  it('draws it unscaled on its own, as an export does', () => {
    expect(render(halfSize(), false).named('scale')).toEqual([])
  })
})
