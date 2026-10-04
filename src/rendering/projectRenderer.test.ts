import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordingContext } from '../testUtils/recordingContext'
import { createProject, withFrameGrid, type Grid, type Project, type Technique } from '../domain/project'
import { blendOver, DARK_THEME, DEFAULT_THEME, drawFlatBead, fadeOver, finishedColor, greyscale, type BeadDrawer, type BeadShape } from './beadLook'
import {
  displayedExtentPx,
  projectExtentPx,
  renderProject,
  rowPitchPx,
  rowShiftPx,
  rowTopPx,
  visibleBeads,
  type Region,
} from './projectRenderer'

/** A bead drawer that draws nothing, to leave only what the renderer itself draws. */
const noBead: BeadDrawer = () => undefined

/** Renders with a bead drawer that only takes note of each bead it is asked for. */
function beadsDrawn(project: Project, region: Region, zoom = 1): BeadShape[] {
  const beads: BeadShape[] = []
  const drawBead: BeadDrawer = (_context, bead) => beads.push(bead)
  renderProject(recordingContext().context, { project, region, zoom, drawBead })
  return beads
}

function projectOf(technique: Technique, columns: number, rows: number, extra: Partial<Project> & { grid?: Grid } = {}): Project {
  const { grid, ...rest } = extra
  const project = { ...createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } }), ...rest }
  return grid ? withFrameGrid(project, grid) : project
}

const whole = (project: Project, zoom = 1): Region => {
  const { width, height } = displayedExtentPx(project.technique, project.frame!.columns, project.frame!.rows, zoom, project.rotation)
  return { x: 0, y: 0, width, height }
}

describe('Technique geometry', () => {
  it('stacks loom rows a bead apart and never shifts them', () => {
    expect(rowPitchPx('loom')).toBe(20)
    expect(rowTopPx('loom', 3)).toBe(60)
    expect([0, 1, 2, 3].map((row) => rowShiftPx('loom', row))).toEqual([0, 0, 0, 0])
    expect(projectExtentPx('loom', 4, 3)).toEqual({ width: 80, height: 60 })
  })

  it('nests peyote rows and shifts every other one half a bead', () => {
    expect(rowPitchPx('peyote')).toBe(15)
    expect(rowTopPx('peyote', 2)).toBe(30)
    expect([0, 1, 2, 3].map((row) => rowShiftPx('peyote', row))).toEqual([0, 10, 0, 10])
    expect(projectExtentPx('peyote', 4, 3)).toEqual({ width: 90, height: 50 })
  })

  it('puts a seam between brick stitch rows, which makes each row a pixel further from the last', () => {
    expect(rowPitchPx('brick')).toBe(21)
    expect(rowTopPx('brick', 2)).toBe(42)
    expect([0, 1, 2, 3].map((row) => rowShiftPx('brick', row))).toEqual([0, 10, 0, 10])
    expect(projectExtentPx('brick', 4, 3)).toEqual({ width: 90, height: 62 })
  })

  it('swaps the displayed width and height at a quarter turn either way, and scales them by the zoom', () => {
    expect(displayedExtentPx('loom', 4, 3, 2, 0)).toEqual({ width: 160, height: 120 })
    expect(displayedExtentPx('loom', 4, 3, 2, 90)).toEqual({ width: 120, height: 160 })
    expect(displayedExtentPx('loom', 4, 3, 2, 270)).toEqual({ width: 120, height: 160 })
  })

  it('leaves the displayed width and height as they are upside down (180°, ticket 171)', () => {
    expect(displayedExtentPx('loom', 4, 3, 2, 180)).toEqual({ width: 160, height: 120 })
  })
})

describe('renderProject', () => {
  it('places loom beads on a straight 20px grid, square', () => {
    const project = projectOf('loom', 3, 2)

    const beads = beadsDrawn(project, whole(project))

    expect(beads.map(({ x, y }) => [x, y])).toEqual([[0, 0], [20, 0], [40, 0], [0, 20], [20, 20], [40, 20]])
    expect(beads.every(({ size, cornerRadius }) => size === 20 && cornerRadius === 0)).toBe(true)
  })

  it('places peyote beads with the half-bead stagger, the tighter row packing and rounded corners', () => {
    const project = projectOf('peyote', 2, 3)

    const beads = beadsDrawn(project, whole(project))

    expect(beads.map(({ x, y }) => [x, y])).toEqual([[0, 0], [20, 0], [10, 15], [30, 15], [0, 30], [20, 30]])
    expect(beads.every(({ cornerRadius }) => Math.abs(cornerRadius - 4.4) < 1e-9)).toBe(true)
  })

  it('places brick stitch beads with the stagger and a seam between rows, square', () => {
    const project = projectOf('brick', 2, 3)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1, drawBead: noBead })

    // One seam above each row after the first, as wide as the row's own beads and shifted with them.
    const seams = named('fillRect').slice(1).map((call) => call.args)
    expect(seams).toEqual([[10, 20, 40, 1], [0, 41, 40, 1]])
    expect(beadsDrawn(project, whole(project)).map(({ x, y }) => [x, y])).toEqual([[0, 0], [20, 0], [10, 21], [30, 21], [0, 42], [20, 42]])
  })

  it('draws no seams for the other Techniques', () => {
    for (const technique of ['loom', 'peyote'] as const) {
      const project = projectOf(technique, 2, 3)
      const { context, named } = recordingContext()

      renderProject(context, { project, region: whole(project), zoom: 1, drawBead: noBead })

      expect(named('fillRect')).toHaveLength(1) // just the background
    }
  })

  it('draws an unpainted Project as empty beads', () => {
    const project = projectOf('loom', 2, 2)

    const beads = beadsDrawn(project, whole(project))

    expect(beads).toHaveLength(4)
    expect(beads.every(({ color, dimmed }) => color === null && !dimmed)).toBe(true)
  })

  it('draws each painted bead in its color', () => {
    const grid: Grid = [
      [{ color: '#e63746' }, { color: null }],
      [{ color: '#2f6fed' }, { color: '#1a1a1a' }],
    ]
    const project = projectOf('loom', 2, 2, { grid })

    expect(beadsDrawn(project, whole(project)).map(({ color }) => color)).toEqual(['#e63746', null, '#2f6fed', '#1a1a1a'])
  })

  it('draws only the beads in a region that shows part of a Project taller and wider than it', () => {
    const project = projectOf('loom', 100, 100)

    // 65 × 45 px at 1:1, from (30, 50): columns 1 to 4 (20–100px … the bead at 20 reaches 40) and rows 2 to 4.
    const beads = beadsDrawn(project, { x: 30, y: 50, width: 65, height: 45 })

    const columns = [...new Set(beads.map(({ x }) => x / 20))]
    const rows = [...new Set(beads.map(({ y }) => y / 20))]
    expect(columns).toEqual([1, 2, 3, 4])
    expect(rows).toEqual([2, 3, 4])
  })

  it('does not draw more as the Project grows: the same region costs the same beads', () => {
    const region = { x: 0, y: 0, width: 200, height: 100 }

    const small = beadsDrawn(projectOf('loom', 20, 20), region)
    const large = beadsDrawn(projectOf('loom', 250, 250), region)

    expect(large).toHaveLength(small.length)
  })

  it('follows the zoom: a region covers fewer beads when zoomed in, and the transform scales by it', () => {
    const project = projectOf('loom', 100, 100)
    const region = { x: 0, y: 0, width: 200, height: 100 }
    const { context, named } = recordingContext()

    renderProject(context, { project, region, zoom: 2 })

    expect(named('setTransform').at(-1)!.args).toEqual([2, 0, 0, 2, -0, -0])
    // 200 × 100 px at 2× is 100 × 50 px of the Project: 5 beads across (one more touches the edge), 3 down.
    expect(beadsDrawn(project, region, 2).length).toBeLessThan(beadsDrawn(project, region, 1).length)
  })

  it('moves the region to the origin, so a surface covering part of the Project draws it at its own top-left', () => {
    const project = projectOf('loom', 100, 100)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: { x: 300, y: 120, width: 100, height: 100 }, zoom: 1 })

    expect(named('setTransform').at(-1)!.args).toEqual([1, 0, 0, 1, -300, -120])
  })

  it('draws bead bitmaps unsmoothed, so they are blitted as they are and never blurred', () => {
    const project = projectOf('peyote', 2, 2)
    const { context } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1 })

    expect(context.imageSmoothingEnabled).toBe(false)
  })

  it('tells the bead drawer how big a bead is on the screen: the zoom times the pixel ratio', () => {
    const project = projectOf('loom', 1, 1)

    const [shape] = (() => {
      const seen: BeadShape[] = []
      renderProject(recordingContext().context, { project, region: whole(project, 1.5), zoom: 1.5, pixelRatio: 2, drawBead: (_c, b) => seen.push(b) })
      return seen
    })()

    expect(shape!.deviceScale).toBe(3)
  })

  it('scales everything by the pixel ratio for a high-density screen, clearing the whole backing store', () => {
    const project = projectOf('loom', 4, 4)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: { x: 0, y: 0, width: 80, height: 80 }, zoom: 1, pixelRatio: 2 })

    expect(named('clearRect')[0]!.args).toEqual([0, 0, 160, 160])
    expect(named('setTransform').at(-1)!.args).toEqual([2, 0, 0, 2, -0, -0])
  })

  describe('rotated a quarter clockwise (90°)', () => {
    // 3 columns × 2 rows loom, turned on its side: displayed 40 wide × 60 tall.
    const project = projectOf('loom', 3, 2, {
      rotation: 90,
      grid: [
        [{ color: '#111111' }, { color: '#222222' }, { color: '#333333' }],
        [{ color: '#444444' }, { color: '#555555' }, { color: '#666666' }],
      ],
    })

    it('turns the Project a quarter clockwise', () => {
      const { context, named } = recordingContext()

      renderProject(context, { project, region: whole(project), zoom: 1 })

      // Grid (x, y) → (height − y, x): the grid's top-left bead ends up at the displayed top-right.
      expect(named('setTransform').at(-1)!.args).toEqual([0, 1, -1, 0, 40, -0])
    })

    it('shows the grid\'s bottom-left corner at the displayed top-left', () => {
      // A region the size of one bead at the displayed top-left holds the grid's last row, first column.
      const beads = beadsDrawn(project, { x: 0, y: 0, width: 19, height: 19 })

      expect(beads.map(({ color }) => color)).toEqual(['#444444'])
    })

    it('shows the grid\'s top-left corner at the displayed top-right', () => {
      const beads = beadsDrawn(project, { x: 22, y: 0, width: 18, height: 18 })

      expect(beads.map(({ color }) => color)).toEqual(['#111111'])
    })

    it('draws all the same beads as the unrotated Project', () => {
      const upright = { ...project, rotation: 0 as const }

      expect(beadsDrawn(project, whole(project))).toHaveLength(beadsDrawn(upright, whole(upright)).length)
    })
  })

  describe('upside down (180°, ticket 171)', () => {
    // 3 columns × 2 rows loom, turned upside down: displayed 60 wide × 40 tall, same as unrotated.
    const project = projectOf('loom', 3, 2, {
      rotation: 180,
      grid: [
        [{ color: '#111111' }, { color: '#222222' }, { color: '#333333' }],
        [{ color: '#444444' }, { color: '#555555' }, { color: '#666666' }],
      ],
    })

    it('reverses both axes without swapping them', () => {
      const { context, named } = recordingContext()

      renderProject(context, { project, region: whole(project), zoom: 1 })

      // Grid (x, y) → (width − x, height − y): the grid's top-left bead ends up at the displayed bottom-right.
      expect(named('setTransform').at(-1)!.args).toEqual([-1, 0, 0, -1, 60, 40])
    })

    it('shows the grid\'s top-left corner at the displayed bottom-right', () => {
      const beads = beadsDrawn(project, { x: 43, y: 23, width: 14, height: 14 })

      expect(beads.map(({ color }) => color)).toEqual(['#111111'])
    })

    it('draws all the same beads as the unrotated Project', () => {
      const upright = { ...project, rotation: 0 as const }

      expect(beadsDrawn(project, whole(project))).toHaveLength(beadsDrawn(upright, whole(upright)).length)
    })
  })

  describe('rotated a quarter counterclockwise (270°, ticket 171)', () => {
    // 3 columns × 2 rows loom, turned the other way on its side: displayed 40 wide × 60 tall.
    const project = projectOf('loom', 3, 2, {
      rotation: 270,
      grid: [
        [{ color: '#111111' }, { color: '#222222' }, { color: '#333333' }],
        [{ color: '#444444' }, { color: '#555555' }, { color: '#666666' }],
      ],
    })

    it('turns the Project a quarter counterclockwise', () => {
      const { context, named } = recordingContext()

      renderProject(context, { project, region: whole(project), zoom: 1 })

      // Grid (x, y) → (y, width − x): the grid's top-left bead ends up at the displayed bottom-left.
      expect(named('setTransform').at(-1)!.args).toEqual([0, -1, 1, 0, -0, 60])
    })

    it('shows the grid\'s top-left corner at the displayed bottom-left', () => {
      const beads = beadsDrawn(project, { x: 0, y: 43, width: 14, height: 14 })

      expect(beads.map(({ color }) => color)).toEqual(['#111111'])
    })

    it('draws all the same beads as the unrotated Project', () => {
      const upright = { ...project, rotation: 0 as const }

      expect(beadsDrawn(project, whole(project))).toHaveLength(beadsDrawn(upright, whole(upright)).length)
    })
  })

  describe('finished rows', () => {
    const progress = (direction: 'rows' | 'columns') => ({
      enabled: true,
      direction,
      currentRow: 1,
      currentColumn: 2,
    })

    it('fades the beads in rows before the current one, when rows run along the grid\'s rows', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: progress('rows') })

      const dimmed = beadsDrawn(project, whole(project)).map(({ dimmed }) => dimmed)

      expect(dimmed).toEqual([true, true, true, false, false, false, false, false, false])
    })

    it('fades the beads in columns before the current one, when rows run down the grid\'s columns', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: progress('columns') })

      const dimmed = beadsDrawn(project, whole(project)).map(({ dimmed }) => dimmed)

      expect(dimmed).toEqual([true, true, false, true, true, false, true, true, false])
    })

    it('fades nothing while the pointer is still on the first row, the row being woven', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: { ...progress('rows'), currentRow: 0, currentColumn: 0 } })

      expect(beadsDrawn(project, whole(project)).some(({ dimmed }) => dimmed)).toBe(false)
    })

    it('fades nothing while Row progress is off', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: { ...progress('rows'), enabled: false } })

      expect(beadsDrawn(project, whole(project)).some(({ dimmed }) => dimmed)).toBe(false)
    })

    it('fades a finished row\'s brick seam with the row, but not a column-wise one\'s', () => {
      const seamAlpha = (direction: 'rows' | 'columns') => {
        const project = projectOf('brick', 2, 3, { rowProgress: { ...progress(direction), currentRow: 2, currentColumn: 0 } })
        const { context, named } = recordingContext()
        renderProject(context, { project, region: whole(project), zoom: 1, drawBead: noBead })
        return named('fillRect').slice(1).map((call) => call.fillStyle)
      }

      // Rows 1 and 2 have seams above them; only row 1 is before the current row (2): faded toward the board, opaque.
      const faded = finishedColor(DEFAULT_THEME.seam, DEFAULT_THEME)
      expect(seamAlpha('rows')).toEqual([faded, DEFAULT_THEME.seam])
      expect(seamAlpha('columns')).toEqual([DEFAULT_THEME.seam, DEFAULT_THEME.seam])
    })
  })

  it('leaves what a bead looks like to the bead drawer, and draws nothing of its own but the background and seams', () => {
    const project = projectOf('loom', 2, 2)
    const drawBead = vi.fn()
    const { context, calls } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1, drawBead })

    expect(drawBead).toHaveBeenCalledTimes(4)
    expect(calls.map((call) => call.name)).toEqual(['setTransform', 'clearRect', 'fillRect', 'setTransform'])
  })

  it('hands the drawer the theme it was given', () => {
    const project = projectOf('loom', 1, 1)
    const theme = { ...DEFAULT_THEME, emptyBead: '#123456' }
    const seen: BeadShape[] = []

    renderProject(recordingContext().context, { project, region: whole(project), zoom: 1, theme, drawBead: (_c, bead) => seen.push(bead) })

    expect(seen[0]!.theme.emptyBead).toBe('#123456')
  })
})

describe('drawing only some rows again', () => {
  it('cuts the drawing to the band those rows occupy, clears it and paints its background', () => {
    const project = projectOf('loom', 4, 10)
    const { context, named, calls } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1, rows: { first: 3, last: 4 } })

    // Rows 3 and 4 are y 60 to 100, across the whole 80px width.
    expect(named('rect').map((call) => call.args)).toEqual([[0, 60, 80, 40]])
    expect(named('clip')).toHaveLength(1)
    expect(named('clearRect')[0]!.args).toEqual([0, 60, 80, 40])
    expect(named('fillRect')[0]!.args).toEqual([0, 60, 80, 40])
    // The clip is put on before anything is drawn and taken off again after.
    expect(calls.findIndex((call) => call.name === 'clip')).toBeLessThan(calls.findIndex((call) => call.name === 'clearRect'))
  })

  it('draws the rows either side of the band too, since they touch it', () => {
    const project = projectOf('loom', 4, 10)

    const beads = beadsDrawn(project, whole(project), 1)
    const bandBeads: BeadShape[] = []
    renderProject(recordingContext().context, { project, region: whole(project), zoom: 1, rows: { first: 3, last: 4 }, drawBead: (_c, b) => bandBeads.push(b) })

    expect(beads).toHaveLength(40)
    // Rows 2 to 5, four beads each.
    expect([...new Set(bandBeads.map(({ y }) => y / 20))]).toEqual([2, 3, 4, 5])
    expect(bandBeads).toHaveLength(16)
  })

  it('draws a band the way the whole surface draws those rows: same beads, same places', () => {
    const grid: Grid = Array.from({ length: 6 }, (_row, row) => Array.from({ length: 5 }, (_cell, column) => ({ color: (row + column) % 2 ? '#e63746' : null })))
    const project = projectOf('peyote', 5, 6, { grid })
    const all: BeadShape[] = []
    const some: BeadShape[] = []
    renderProject(recordingContext().context, { project, region: whole(project), zoom: 1, drawBead: (_c, b) => all.push(b) })
    renderProject(recordingContext().context, { project, region: whole(project), zoom: 1, rows: { first: 2, last: 3 }, drawBead: (_c, b) => some.push(b) })

    const key = (b: BeadShape) => `${b.x},${b.y},${b.color}`
    expect(some.map(key)).toEqual(all.filter(({ y }) => y >= 15 && y < 60 + 15).map(key))
  })

  it('includes brick stitch\'s seam above the first row of the band, and no more of the rows above', () => {
    const project = projectOf('brick', 4, 6)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1, rows: { first: 2, last: 2 } })

    // Row 2 is y 42 to 62, with its seam at 41.
    expect(named('rect')[0]!.args).toEqual([0, 41, 90, 21])
  })

  it('turns the band with the Project: rows are columns of the surface when it is rotated', () => {
    const project = projectOf('loom', 4, 10, { rotation: 90 })
    const { context, named } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1, rows: { first: 3, last: 4 } })

    // Displayed 200 wide and 80 tall; rows count from the right, so rows 3 and 4 are x 100 to 140 (200 − 100, 200 − 60).
    expect(named('rect')[0]!.args).toEqual([100, 0, 40, 80])
  })

  it('scales the band with the zoom and the pixel ratio, out to whole device pixels', () => {
    const project = projectOf('loom', 4, 10)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: whole(project, 1.5), zoom: 1.5, pixelRatio: 2, rows: { first: 1, last: 1 } })

    // Row 1 is y 20 to 40, ×1.5 ×2 = 60 to 120; the Project is 80 × 1.5 × 2 = 240 wide.
    expect(named('rect')[0]!.args).toEqual([0, 60, 240, 60])
  })

  it('draws the whole surface when it is not told to draw a band', () => {
    const project = projectOf('loom', 4, 4)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1 })

    expect(named('clip')).toHaveLength(0)
    expect(named('clearRect')[0]!.args).toEqual([0, 0, 80, 80])
  })
})

describe('visibleBeads', () => {
  it('finds no rows for an empty Project', () => {
    const { firstRow, lastRow } = visibleBeads('loom', 5, 0, { left: 0, right: 100, top: 0, bottom: 100 })

    expect(lastRow).toBeLessThan(firstRow)
  })

  it('includes a peyote row whose top is inside the region but whose nested beads overlap the row above', () => {
    // Rows sit 15px apart: a region over the top 10px still meets row 0 and (at 15px) not yet row 1; 16px meets both.
    expect(visibleBeads('peyote', 5, 10, { left: 0, right: 100, top: 0, bottom: 10 }).lastRow).toBe(0)
    expect(visibleBeads('peyote', 5, 10, { left: 0, right: 100, top: 0, bottom: 16 }).lastRow).toBe(1)
  })

  it('takes the stagger into account for a shifted row\'s columns', () => {
    const { columnsOf } = visibleBeads('peyote', 10, 4, { left: 0, right: 25, top: 0, bottom: 100 })

    // Row 0's beads sit at 0 and 20 (the second reaches 25); row 1's are shifted to 10 and 30, so 30 is out of reach.
    expect(columnsOf(0)).toEqual({ first: 0, last: 1 })
    expect(columnsOf(1)).toEqual({ first: 0, last: 0 })
  })
})

describe('the bead look', () => {
  it('greys a color with the weights CSS grayscale() uses', () => {
    expect(greyscale('#ff0000')).toBe('rgb(54, 54, 54)')
    expect(greyscale('#00ff00')).toBe('rgb(182, 182, 182)')
    expect(greyscale('#0000ff')).toBe('rgb(18, 18, 18)')
    expect(greyscale('#fff')).toBe('rgb(255, 255, 255)')
  })

  it('leaves a color it cannot read alone rather than guessing a grey', () => {
    expect(greyscale('rebeccapurple')).toBe('rebeccapurple')
  })

  const bead = (overrides: Partial<BeadShape> = {}): BeadShape => ({
    x: 40,
    y: 20,
    size: 20,
    cornerRadius: 0,
    color: '#e63746',
    dimmed: false,
    deviceScale: 1,
    theme: DEFAULT_THEME,
    ...overrides,
  })

  it('draws a square bead a pixel in from its cell, its faint rim and, inside that, its color: two rectangles', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead())

    expect(named('fillRect').map((call) => [call.fillStyle, ...call.args])).toEqual([
      [blendOver(DEFAULT_THEME.rim!, '#e63746'), 41, 21, 18, 18],
      ['#e63746', 41.75, 21.75, 16.5, 16.5],
    ])
    expect(named('fill')).toHaveLength(0)
  })

  it('draws no rim in dark: the bead alone, a pixel in from its cell', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ theme: DARK_THEME }))

    expect(named('fillRect').map((call) => [call.fillStyle, ...call.args])).toEqual([['#e63746', 41, 21, 18, 18]])
  })

  it('blends the translucent rim over the bead color into one opaque color', () => {
    expect(blendOver('rgba(20,20,19,.12)', '#ffffff')).toBe('rgb(227, 227, 227)')
    expect(blendOver('#123456', '#ffffff')).toBe('#123456')
  })

  it('draws a rounded bead as its rim\'s shape and, inside it a pixel tighter, its color', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ cornerRadius: 6 }))

    expect(named('roundRect').map((call) => call.args)).toEqual([
      [41, 21, 18, 18, 5],
      [41.75, 21.75, 16.5, 16.5, 4.25],
    ])
    expect(named('fill').map((call) => call.fillStyle)).toEqual([blendOver(DEFAULT_THEME.rim!, '#e63746'), '#e63746'])
  })

  it('draws a rounded bead from arcs where the browser has no roundRect', () => {
    const { context, named } = recordingContext()
    ;(context as unknown as { roundRect: undefined }).roundRect = undefined

    drawFlatBead(context, bead({ cornerRadius: 6 }))

    expect(named('arcTo').map((call) => call.args[4])).toEqual([5, 5, 5, 5, 4.25, 4.25, 4.25, 4.25])
  })

  it('draws an empty bead in the empty tint', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ color: null }))

    expect(named('fillRect')[1]!.fillStyle).toBe(DEFAULT_THEME.emptyBead)
  })

  it('draws a finished bead in light as its own color at 28% over the board, opaque', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ dimmed: true }))

    const faded = fadeOver('#e63746', DEFAULT_THEME.background, 0.28)
    expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha])).toEqual([
      [blendOver(DEFAULT_THEME.rim!, faded), 1],
      [faded, 1],
    ])
  })

  it('draws a finished bead in dark as its grey at 45% over the board', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ dimmed: true, theme: DARK_THEME }))

    expect(named('fillRect').map((call) => call.fillStyle)).toEqual([fadeOver(greyscale('#e63746'), DARK_THEME.background, 0.45)])
  })

  it('leaves the context as it found it', () => {
    const { context } = recordingContext()

    drawFlatBead(context, bead({ dimmed: true }))

    expect(context.globalAlpha).toBe(1)
  })

  describe('with a canvas to keep bead bitmaps on', () => {
    /** Canvases whose contexts are recorded, standing in for the real ones a browser makes. */
    function withSpriteCanvas() {
      const sprite = recordingContext()
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(sprite.context as unknown as CanvasRenderingContext2D)
      return { sprite, getContext }
    }

    afterEach(() => vi.restoreAllMocks())

    it('makes a rounded bead\'s bitmap once and blits it for every bead that looks the same', () => {
      const { sprite, getContext } = withSpriteCanvas()
      const main = recordingContext()
      const roundedRed = bead({ cornerRadius: 6, color: '#123457' })

      drawFlatBead(main.context, { ...roundedRed, x: 0 })
      drawFlatBead(main.context, { ...roundedRed, x: 20 })
      drawFlatBead(main.context, { ...roundedRed, x: 40 })

      expect(getContext).toHaveBeenCalledTimes(1)
      expect(sprite.named('roundRect')).toHaveLength(2)
      expect(main.named('drawImage').map((call) => call.args.slice(1))).toEqual([[0, 20, 20, 20], [20, 20, 20, 20], [40, 20, 20, 20]])
      // Nothing was filled on the Project's own context: the shapes were filled once, on the bitmap.
      expect(main.named('fill')).toHaveLength(0)
    })

    it('makes a bitmap for each look: another color, another size on the screen, faded', () => {
      const { getContext } = withSpriteCanvas()
      const main = recordingContext()
      const base = bead({ cornerRadius: 6, color: '#123458' })

      drawFlatBead(main.context, base)
      drawFlatBead(main.context, { ...base, color: '#123459' })
      drawFlatBead(main.context, { ...base, deviceScale: 2 })
      drawFlatBead(main.context, { ...base, dimmed: true })
      drawFlatBead(main.context, base)

      expect(getContext).toHaveBeenCalledTimes(4)
    })

    it('makes the bitmap as many pixels across as the bead is on the screen', () => {
      withSpriteCanvas()
      const created: HTMLCanvasElement[] = []
      const createElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const element = createElement(tag)
        if (tag === 'canvas') {
          created.push(element as HTMLCanvasElement)
        }
        return element
      })

      drawFlatBead(recordingContext().context, bead({ cornerRadius: 6, color: '#12345a', deviceScale: 1.5 }))

      expect([created[0]!.width, created[0]!.height]).toEqual([30, 30])
    })

    it('blits a finished square bead as a bitmap too, and draws a live square bead with rectangles', () => {
      withSpriteCanvas()
      const main = recordingContext()

      drawFlatBead(main.context, bead({ color: '#12345b', dimmed: true }))
      drawFlatBead(main.context, bead({ color: '#12345b' }))

      expect(main.named('drawImage')).toHaveLength(1)
      expect(main.named('fillRect')).toHaveLength(2)
    })
  })

  describe('faded over a known backdrop', () => {
    it('is drawn as opaque pieces already blended with it, so it covers what is under it', () => {
      const { context, named } = recordingContext()

      drawFlatBead(context, bead({ dimmed: true, backdrop: '#ffffff' }))

      const faded = fadeOver('#e63746', '#ffffff', 0.28)
      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([
        [blendOver(DEFAULT_THEME.rim!, faded), 1, 41, 21, 18, 18],
        [faded, 1, 41.75, 21.75, 16.5, 16.5],
      ])
      expect(named('fill')).toHaveLength(0)
    })

    it('makes a bitmap of its own, apart from the same bead faded over nothing in particular', async () => {
      const sprite = recordingContext()
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(sprite.context as unknown as CanvasRenderingContext2D)
      const main = recordingContext()
      const rounded = bead({ cornerRadius: 6, dimmed: true, color: '#12345d' })

      drawFlatBead(main.context, rounded)
      drawFlatBead(main.context, { ...rounded, backdrop: '#ffffff' })
      drawFlatBead(main.context, { ...rounded, backdrop: '#ffffff' })

      expect(getContext).toHaveBeenCalledTimes(2)
      expect(main.named('drawImage')).toHaveLength(3)
      vi.restoreAllMocks()
    })
  })

  describe('fadeOver', () => {
    it('is a color mixed with what it sits over, at the fraction given', () => {
      expect(fadeOver('#000000', '#ffffff', 0.35)).toBe('rgb(166, 166, 166)')
      expect(fadeOver('#ff0000', '#000000', 0.5)).toBe('rgb(128, 0, 0)')
    })

    it('reads the greys greyscale() makes, so a faded bead is grey over the backdrop, pale for a light backdrop', () => {
      // #e63746 is 93 as a grey, and 35% of that over white is 35% × 93 + 65% × 255 = 198.
      expect(fadeOver(greyscale('#e63746'), '#ffffff', 0.35)).toBe('rgb(198, 198, 198)')
    })

    it('leaves a color it cannot read alone', () => {
      expect(fadeOver('rebeccapurple', '#ffffff', 0.35)).toBe('rebeccapurple')
    })
  })

  it('keeps to drawing the shapes itself where no canvas can be made to keep bitmaps on', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ cornerRadius: 6, color: '#12345c' }))

    expect(named('drawImage')).toHaveLength(0)
    expect(named('roundRect')).toHaveLength(2)
  })
})
