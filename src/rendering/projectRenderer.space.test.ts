import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withColors } from '../domain/canvas'
import { type Rotation, type Technique } from '../domain/grid'
import { createProject, type Project } from '../domain/project'
import { recordingContext } from '../testUtils/recordingContext'
import { DEFAULT_THEME, finishedColor, type BeadShape } from './beadLook'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'
import { CELL_SIZE_PX, gridToRegion, rowShiftPx, rowTopPx, type Region } from './surfaceView'

/** A 3-wide, 4-tall Frame at row 6, column 5, every position painted, with Row progress on and two rows done. */
function framedProject(technique: Technique, rotation: Rotation = 0): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: 3, height: 4, unit: 'beads' } })
  const frame = { row: 6, column: 5, rows: 4, columns: 3 }
  const cells = Array.from({ length: 12 }, (_, index) => ({ row: frame.row + Math.floor(index / 3), column: frame.column + (index % 3), color: '#e63746' }))
  return { ...project, technique, rotation, frame, beads: withColors(project.beads, cells), rowProgress: { enabled: true, direction: 'rows', currentRow: 2, currentColumn: 0 } }
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

function render(project: Project, open: boolean, extra: { region?: Region; rows?: { first: number; last: number }; zoom?: number } = {}) {
  const beads: BeadShape[] = []
  const { context, calls, named } = recordingContext()
  renderProject(context, {
    project,
    space: spaceOf(project, open),
    region: extra.region ?? view,
    zoom: extra.zoom ?? 1,
    rows: extra.rows,
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
        return { x: rowShiftPx(technique, row) + column * CELL_SIZE_PX, y: rowTopPx(technique, row) }
      })
      expect(painted.map(({ x, y }) => ({ x, y }))).toEqual(expected)
    })

    it('turns about the right point at a quarter turn: the box round the Frame, or the origin when open', () => {
      const project = framedProject(technique, 90)
      const { named } = render(project, open, { region: { x: 10, y: 20, width: 300, height: 300 }, zoom: 2 })

      expect(named('setTransform').at(-1)!.args).toEqual(gridToRegion(spaceOf(project, open).extent, { x: 10, y: 20, width: 300, height: 300 }, 2, 90))
    })
  })

  it('fills the background only on its own; the open canvas stays transparent and is marked outside the Frame', () => {
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

    it('starts a brick stitch band a pixel higher for a seam only below the Frame\'s first row', () => {
      const seam = technique === 'brick' ? 1 : 0

      expect(topOf(false, 2)[1]).toBe(rowTopPx(technique, 2) - seam)
      expect(topOf(false, 0)[1]).toBe(rowTopPx(technique, 0))
      expect(topOf(true, 8)[1]).toBe(rowTopPx(technique, 8) - seam)
      // The Frame's own first row has no seam above it, on the open canvas either.
      expect(topOf(true, 6)[1]).toBe(rowTopPx(technique, 6))
    })
  })
})

describe('brick seams', () => {
  const seams = (project: Project, open: boolean) =>
    render(project, open).named('fillRect').filter((call) => call.args[3] === 1)

  it('run between two rows of the Frame, across the Frame, in either space', () => {
    const project = framedProject('brick')

    const onItsOwn = seams(project, false).map((call) => call.args)
    const open = seams(project, true).map((call) => call.args)

    expect(onItsOwn).toEqual([1, 2, 3].map((row) => [rowShiftPx('brick', row), rowTopPx('brick', row) - 1, 60, 1]))
    expect(open).toEqual([7, 8, 9].map((row) => [rowShiftPx('brick', row) + 5 * CELL_SIZE_PX, rowTopPx('brick', row) - 1, 60, 1]))
  })

  it('are not drawn on an open canvas with no Frame', () => {
    const project: Project = { ...framedProject('brick'), frame: undefined }

    expect(seams(project, true)).toEqual([])
  })

  it('fade with a finished row even when the Frame does not start at column 0 (regression)', () => {
    const project = framedProject('brick')
    const faded = finishedColor(DEFAULT_THEME.seam, DEFAULT_THEME)
    const fadedOpen = finishedColor(DEFAULT_THEME.seam, { ...DEFAULT_THEME, background: DEFAULT_THEME.canvas })

    // Row progress is at the Frame's row 2: the seam above row 1 is faded, the ones above rows 2 and 3 are not.
    expect(seams(project, false).map((call) => call.fillStyle)).toEqual([faded, DEFAULT_THEME.seam, DEFAULT_THEME.seam])
    expect(seams(project, true).map((call) => call.fillStyle)).toEqual([fadedOpen, DEFAULT_THEME.seam, DEFAULT_THEME.seam])
  })
})

describe('a Project with no Frame whose top bead is on an odd row (regression)', () => {
  it('shifts its rows by their own number, so an export looks like the editor', () => {
    const base = createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } })
    const project: Project = {
      ...base,
      frame: undefined,
      beads: withColors(base.beads, [
        { row: 3, column: 0, color: '#e63746' },
        { row: 4, column: 0, color: '#e63746' },
      ]),
    }

    const painted = (open: boolean) => render(project, open).beads.filter(({ color }) => color !== null)
    const editor = painted(true)
    const exported = painted(false)

    // Row 3 is odd, so it is the shifted one: half a bead right of row 4, which is not.
    expect(editor.map(({ x }) => x)).toEqual([CELL_SIZE_PX / 2, 0])
    expect(exported.map(({ x }) => x)).toEqual([CELL_SIZE_PX / 2, 0])
  })
})

describe('the Frame margin on the open canvas (ticket 276)', () => {
  it('fills no marks in the margin or the Frame, leaving a flat gap', () => {
    const project = framedProject('loom')
    const { named } = render({ ...project, frame: { row: 6, column: 6, rows: 4, columns: 3 } }, true, { region: { x: 0, y: 0, width: 300, height: 300 } })

    const fills = markFills(named)
    expect(fills.length).toBeGreaterThan(0)
    // The Frame is rows 6 to 9 and columns 6 to 8; its margin is 3 round it, rows 3 to 12 and columns 3 to 11: x 60 to 240, y 60 to 260 (the marks' own edge sits 5 in from it).
    const touchesMargin = fills.filter(({ left, right, top, bottom }) => left < 245 && right > 65 && top < 260 && bottom > 60)
    expect(touchesMargin).toEqual([])
  })
})

describe('Position marks cost one pattern fill, however far out', () => {
  it.each<Technique>(['loom', 'peyote', 'brick'])('is the same number of fills at the Zoom floor and at 100% (%s)', (technique) => {
    const project = { ...framedProject(technique), frame: undefined }
    const wide: Region = { x: 0, y: 0, width: 1600, height: 1000 }

    const floor = render(project, true, { region: wide, zoom: 0.1 })
    const full = render(project, true, { region: wide, zoom: 1 })

    expect(markFills(floor.named)).toHaveLength(1)
    expect(markFills(full.named)).toHaveLength(1)
    expect(floor.named('arc')).toHaveLength(0)
  })

  it('draws only the Frame\'s cells and the painted beads in view, whatever the zoom', () => {
    const project: Project = { ...framedProject('loom'), beads: withColors(framedProject('loom').beads, [{ row: 40, column: 40, color: '#00f' }, { row: 5000, column: 5000, color: '#00f' }]) }
    const wide: Region = { x: 0, y: 0, width: 1600, height: 1000 }

    const { beads } = render(project, true, { region: wide, zoom: 0.1 })

    // 12 Frame cells and the one painted bead in view; the other is a thousand beads out of sight.
    expect(beads).toHaveLength(13)
  })

  it.each<{ technique: Technique; rotation: Rotation }>(
    (['loom', 'peyote', 'brick'] as const).flatMap((technique) => ([0, 90, 180, 270] as const).map((rotation) => ({ technique, rotation }))),
  )('draws the Frame\'s cells and the beads outside it once each: $technique at $rotation°', ({ technique, rotation }) => {
    const base = framedProject(technique, rotation)
    const project: Project = { ...base, beads: withColors(base.beads, [{ row: 0, column: 0, color: '#00f' }, { row: 14, column: 12, color: '#00f' }]) }

    const { beads } = render(project, true, { region: { x: -1000, y: -1000, width: 2000, height: 2000 } })

    // The Frame's 12 cells, and the two beads outside it.
    expect(beads).toHaveLength(14)
  })
})

describe('Position marks tile styles', () => {
  function tileCalls(style: 'dots' | 'squares', technique: Technique) {
    const tile = recordingContext()
    // A tile is made on a canvas of its own (one per style and Technique): hand it the one that records.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(tile.context as unknown as CanvasRenderingContext2D)
    const project = { ...framedProject(technique), frame: undefined }
    const { context } = recordingContext()
    renderProject(context, { project, space: spaceOf(project, true), region: view, zoom: 1.5 + (style === 'squares' ? 0.01 : 0), positionMarks: style })
    return tile
  }

  it('draws dots as arcs and no outlines', () => {
    const { named } = tileCalls('dots', 'loom')
    expect(named('arc').length).toBeGreaterThan(0)
    expect(named('stroke')).toHaveLength(0)
  })

  it('draws squares as outlines with the Technique\'s corner radius and no arcs', () => {
    const loom = tileCalls('squares', 'loom')
    expect(loom.named('arc')).toHaveLength(0)
    expect(loom.named('stroke').length).toBeGreaterThan(0)
    // Loom beads are square: the corner arcs have no radius.
    expect(loom.named('arcTo').every((call) => call.args[4] === 0)).toBe(true)

    const peyote = tileCalls('squares', 'peyote')
    expect(peyote.named('arcTo').some((call) => (call.args[4] as number) > 0)).toBe(true)
  })
})
