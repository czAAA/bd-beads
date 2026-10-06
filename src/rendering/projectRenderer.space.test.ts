import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { CELL_SIZE_PX, type Rotation, type Technique } from '../domain/grid'
import { createProject, type Project } from '../domain/project'
import { recordingContext } from '../testUtils/recordingContext'
import { DEFAULT_THEME, finishedColor, type BeadShape } from './beadLook'
import { gridToRegion, renderProject, rowShiftPx, rowTopPx, type Region } from './projectRenderer'
import { spaceOf } from './space'

/** A 3-wide, 4-tall Frame at row 6, column 5, every position painted, with Row progress on and two rows done. */
function framedProject(technique: Technique, rotation: Rotation = 0): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: 3, height: 4, unit: 'beads' } })
  const frame = { row: 6, column: 5, rows: 4, columns: 3 }
  const cells = Array.from({ length: 12 }, (_, index) => ({ row: frame.row + Math.floor(index / 3), column: frame.column + (index % 3), color: '#e63746' }))
  return { ...project, technique, rotation, frame, beads: withColors(project.beads, cells), rowProgress: { enabled: true, direction: 'rows', currentRow: 2, currentColumn: 0 } }
}

const view: Region = { x: 0, y: 0, width: 400, height: 400 }

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

  it('fills the background only on its own; the open canvas stays transparent and is dotted outside the Frame', () => {
    const project = framedProject(technique)
    const onItsOwn = render(project, false)
    const open = render(project, true)

    expect(onItsOwn.named('fillRect').some((call) => call.fillStyle === DEFAULT_THEME.background && call.args[2] === view.width)).toBe(true)
    expect(onItsOwn.named('arc')).toHaveLength(0)
    expect(open.named('fillRect').some((call) => call.fillStyle === DEFAULT_THEME.background)).toBe(false)
    expect(open.named('arc').length).toBeGreaterThan(0)
  })

  it('fades a finished row toward the board on its own and toward the drawing area when open', () => {
    const project = framedProject(technique)
    const fadedOnItsOwn = render(project, false).beads.filter(({ dimmed }) => dimmed)
    const fadedOpen = render(project, true).beads.filter(({ dimmed }) => dimmed)

    // Rows 0 and 1 of the Frame, three beads each.
    expect(fadedOnItsOwn).toHaveLength(6)
    expect(fadedOpen).toHaveLength(6)
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
  it('draws no dots in the margin and no band over it, leaving a flat gap', () => {
    const project = framedProject('loom')
    const { calls } = render({ ...project, frame: { row: 6, column: 6, rows: 4, columns: 3 } }, true, { region: { x: 0, y: 0, width: 300, height: 300 } })

    const dotCells = calls.filter((call) => call.name === 'arc').map(({ args }) => ({ column: Math.floor((args[0] as number) / 20), row: Math.floor((args[1] as number) / 20) }))
    expect(dotCells.length).toBeGreaterThan(0)
    // The Frame is rows 6 to 9 and columns 6 to 8; its margin is 3 round it, rows 3 to 12 and columns 3 to 11.
    expect(dotCells.filter(({ row, column }) => row >= 3 && row <= 12 && column >= 3 && column <= 11)).toEqual([])
  })
})
