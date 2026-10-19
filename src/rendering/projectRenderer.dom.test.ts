import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordingContext } from '../testUtils/recordingContext'
import { withColors } from '../domain/canvas'
import { createProject, weaveOf, withFrameGrid, type Grid, type Project, type Technique } from '../domain/project'
import { blendOver, brighten, DARK_THEME, DEFAULT_THEME, drawFlatBead, fadeOver, greyscale, PROJECT_THEMES, type BeadDrawer, type BeadShape } from './beadLook'
import { renderProject as renderInSpace, visibleBeads, type RenderInput } from './projectRenderer'
import { spaceOf, type Space } from './space'
import { displayedExtentPx, projectExtentPx, rowPitchPx, rowShiftPx, rowTopPx, type Region } from './surfaceView'

/** Renders a Project on its own (Frame-only space) unless a space is given. */
function renderProject(context: Parameters<typeof renderInSpace>[0], input: Omit<RenderInput, 'space'> & { space?: Space }): void {
  renderInSpace(context, { space: spaceOf(input.project, false), rowMarks: false, ...input })
}

/** A bead drawer that draws nothing, to leave only what the renderer itself draws. */
const noBead: BeadDrawer = () => undefined

/** Renders with a bead drawer that only takes note of each bead it is asked for. */
function beadsDrawn(project: Project, region: Region, zoom = 1, showFinished = false, rowMarks = false): BeadShape[] {
  const beads: BeadShape[] = []
  const drawBead: BeadDrawer = (_context, bead) => beads.push(bead)
  renderProject(recordingContext().context, { project, region, zoom, showFinished, rowMarks, drawBead })
  return beads
}

function projectOf(technique: Technique, columns: number, rows: number, extra: Partial<Project> & { grid?: Grid } = {}): Project {
  const { grid, ...rest } = extra
  // Row marks are off here unless a test asks for them with `rowMarks` (a Frame turns Row progress on in the app).
  const made = { ...createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } }), ...rest }
  // The Frame is woven as the Project is made, whatever the test overrides (ticket 492).
  const project = made.frame && !rest.frame ? { ...made, frame: { ...made.frame, ...weaveOf(made) } } : made
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
    expect([0, 1, 2, 3].map((row) => rowShiftPx({ technique: 'loom' }, row))).toEqual([0, 0, 0, 0])
    expect(projectExtentPx('loom', 4, 3)).toEqual({ width: 80, height: 60 })
  })

  it('nests peyote rows and shifts every other one half a bead', () => {
    expect(rowPitchPx('peyote')).toBe(15)
    expect(rowTopPx('peyote', 2)).toBe(30)
    expect([0, 1, 2, 3].map((row) => rowShiftPx({ technique: 'peyote' }, row))).toEqual([0, 10, 0, 10])
    expect(projectExtentPx('peyote', 4, 3)).toEqual({ width: 90, height: 50 })
  })

  it('stacks brick stitch rows a bead apart, with no seam between them', () => {
    expect(rowPitchPx('brick')).toBe(20)
    expect(rowTopPx('brick', 2)).toBe(40)
    expect([0, 1, 2, 3].map((row) => rowShiftPx({ technique: 'brick' }, row))).toEqual([0, 10, 0, 10])
    expect(projectExtentPx('brick', 4, 3)).toEqual({ width: 90, height: 60 })
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

describe('Right-angle weave (ticket 482)', () => {
  // Two Units across and one down: three lines, 2 + 3 + 2 beads. A bead is 20 long and 14 across, so a Unit is 34.
  const project = () => projectOf('rightAngle', 2, 1)

  it('measures a Unit as a bead length plus a bead width, and a block as its Units plus one bead width', () => {
    expect(projectExtentPx('rightAngle', 3, 3)).toEqual({ width: 2 * 34 + 14, height: 34 + 14 })
  })

  it('draws horizontal beads lying along their line and vertical beads upright, each at its own place', () => {
    const beads = beadsDrawn(project(), whole(project()))

    expect(beads.map(({ x, y, width, height }) => [x, y, width, height])).toEqual([
      [14, 0, 20, 14],
      [48, 0, 20, 14],
      [0, 14, 14, 20],
      [34, 14, 14, 20],
      [68, 14, 14, 20],
      [14, 34, 20, 14],
      [48, 34, 20, 14],
    ])
  })

  it('paints each bead on its own', () => {
    const base = projectOf('rightAngle', 2, 1)
    const colored = { ...base, frame: { ...base.frame!, beads: { 1: { 2: '#e63746' }, 0: { 1: '#2f6fed' } } } }

    const colors = beadsDrawn(colored, whole(colored)).map(({ color }) => color)

    expect(colors).toEqual([null, '#2f6fed', null, null, '#e63746', null, null])
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

  it('places brick stitch beads with the stagger and no seam between rows, square', () => {
    const project = projectOf('brick', 2, 3)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1, drawBead: noBead })

    expect(named('fillRect')).toHaveLength(1) // just the background
    expect(beadsDrawn(project, whole(project)).map(({ x, y }) => [x, y])).toEqual([[0, 0], [20, 0], [10, 20], [30, 20], [0, 40], [20, 40]])
  })

  it('draws brick stitch rows in blocks of the Brick block, N straight then N shifted (ticket 477)', () => {
    const project = projectOf('brick', 2, 5, { brickBlock: 2 })

    expect(beadsDrawn(project, whole(project)).map(({ x, y }) => [x, y])).toEqual([
      [0, 0], [20, 0], [0, 20], [20, 20], [10, 40], [30, 40], [10, 60], [30, 60], [0, 80], [20, 80],
    ])
    expect(rowShiftPx({ technique: 'brick', brickBlock: 2 }, 2)).toBe(10)
  })

  it('draws no seams in any Technique', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
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
      direction,
      currentRow: 1,
      currentColumn: 2,
    })

    it('fades the beads in rows before the current one, when rows run along the grid\'s rows', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: progress('rows') })

      const dimmed = beadsDrawn(project, whole(project), 1, false, true).map(({ dimmed }) => dimmed)

      expect(dimmed).toEqual([true, true, true, false, false, false, false, false, false])
    })

    it('fades the beads in columns before the current one, when rows run down the grid\'s columns', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: progress('columns') })

      const dimmed = beadsDrawn(project, whole(project), 1, false, true).map(({ dimmed }) => dimmed)

      expect(dimmed).toEqual([true, true, false, true, true, false, true, true, false])
    })

    it('fades nothing while the pointer is still on the first row, the row being woven', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: { ...progress('rows'), currentRow: 0, currentColumn: 0 } })

      expect(beadsDrawn(project, whole(project), 1, false, true).some(({ dimmed }) => dimmed)).toBe(false)
    })

    it('draws finished rows at their normal color while they are shown (hover or a tap, ticket 352)', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: progress('rows') })
      const { context } = recordingContext()
      const beads: BeadShape[] = []

      renderProject(context, { project, region: whole(project), zoom: 1, showFinished: true, rowMarks: true, drawBead: (_context, bead) => beads.push(bead) })

      expect(beads.some(({ dimmed }) => dimmed)).toBe(false)
    })


    /** Every cell of a Frame at the origin holds a red bead. */
    const filled = (project: Project): Project => {
      const frame = project.frame!
      const beads: Project['beads'] = {}
      for (let row = 0; row < frame.rows; row += 1) {
        beads[row] = Object.fromEntries(Array.from({ length: frame.columns }, (_, column) => [column, '#e63746']))
      }
      return { ...project, frame: { ...frame, beads } }
    }

    it('draws the current row 10% brighter than the todo rows, shown or dimmed, in either direction (ticket 352)', () => {
      const colors = (direction: 'rows' | 'columns', showFinished: boolean) => {
        const project = filled(projectOf('loom', 3, 3, { rowProgress: progress(direction) }))
        return beadsDrawn(project, whole(project), 1, showFinished, true).map(({ color }) => color)
      }
      const red = '#e63746'
      const lit = brighten(red, 0.1)
      expect(lit).not.toBe(red)

      for (const showFinished of [false, true]) {
        // The finished and todo beads keep their own color; the current row's are lifted.
        expect(colors('rows', showFinished)).toEqual([red, red, red, lit, lit, lit, red, red, red])
        expect(colors('columns', showFinished)).toEqual([red, red, lit, red, red, lit, red, red, lit])
      }
    })

    it('brightens only the pass on peyote, not the whole line', () => {
      const project = filled(projectOf('peyote', 4, 3, { rowProgress: { ...progress('rows'), currentRow: 1 } }))

      const lit = beadsDrawn(project, whole(project), 1, false, true).filter(({ color }) => color === brighten('#e63746', 0.1)).length

      expect(lit).toBe(2)
    })

    it('leaves an empty cell of the current row as it is: no brightening where there is no bead (ticket 411)', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: progress('rows') })

      expect(beadsDrawn(project, whole(project), 1, false, true).every(({ color }) => color === null)).toBe(true)
    })

    it('fades nothing while the renderer is told to draw no row marks (an export)', () => {
      const project = projectOf('loom', 3, 3, { rowProgress: progress('rows') })

      expect(beadsDrawn(project, whole(project)).some(({ dimmed }) => dimmed)).toBe(false)
    })

  })

  it('leaves what a bead looks like to the bead drawer, and draws nothing of its own but the background', () => {
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

  it('starts a brick stitch band at the top of its first row, and no more of the rows above', () => {
    const project = projectOf('brick', 4, 6)
    const { context, named } = recordingContext()

    renderProject(context, { project, region: whole(project), zoom: 1, rows: { first: 2, last: 2 } })

    // Row 2 is y 40 to 60.
    expect(named('rect')[0]!.args).toEqual([0, 40, 90, 20])
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
    const { firstRow, lastRow } = visibleBeads({ technique: 'loom' }, 5, 0, { left: 0, right: 100, top: 0, bottom: 100 })

    expect(lastRow).toBeLessThan(firstRow)
  })

  it('includes a peyote row whose top is inside the region but whose nested beads overlap the row above', () => {
    // Rows sit 15px apart: a region over the top 10px still meets row 0 and (at 15px) not yet row 1; 16px meets both.
    expect(visibleBeads({ technique: 'peyote' }, 5, 10, { left: 0, right: 100, top: 0, bottom: 10 }).lastRow).toBe(0)
    expect(visibleBeads({ technique: 'peyote' }, 5, 10, { left: 0, right: 100, top: 0, bottom: 16 }).lastRow).toBe(1)
  })

  it('takes the stagger into account for a shifted row\'s columns', () => {
    const { columnsOf } = visibleBeads({ technique: 'peyote' }, 10, 4, { left: 0, right: 25, top: 0, bottom: 100 })

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

  it('draws a square bead half a pixel in from its cell, its faint rim and, inside that, its color: two rectangles', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead())

    expect(named('fillRect').map((call) => [call.fillStyle, ...call.args])).toEqual([
      [blendOver(DEFAULT_THEME.rim, '#e63746'), 40.5, 20.5, 19, 19],
      ['#e63746', 41.25, 21.25, 17.5, 17.5],
    ])
    expect(named('fill')).toHaveLength(0)
  })

  it('draws a white rim in dark, so two beads of one color stay apart (ticket 0460)', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ theme: DARK_THEME }))

    expect(named('fillRect').map((call) => [call.fillStyle, ...call.args])).toEqual([
      [blendOver(DARK_THEME.rim, '#e63746'), 40.5, 20.5, 19, 19],
      ['#e63746', 41.25, 21.25, 17.5, 17.5],
    ])
  })

  it('draws a white rim on a near-black bead in light, where the dark rim would vanish, but not on a dark navy', () => {
    const rims = (color: string, theme = DEFAULT_THEME) => {
      const { context, named } = recordingContext()
      drawFlatBead(context, bead({ color, theme }))
      return named('fillRect')[0]!.fillStyle
    }

    expect(rims('#1a1a1a')).toBe(blendOver(DARK_THEME.rim, '#1a1a1a'))
    expect(rims('#2c2c2c')).toBe(blendOver(DARK_THEME.rim, '#2c2c2c'))
    expect(rims('#2e2e2e')).toBe(blendOver(DEFAULT_THEME.rim, '#2e2e2e'))
    expect(rims('#1f3f8a')).toBe(blendOver(DEFAULT_THEME.rim, '#1f3f8a'))
    expect(rims('#1a1a1a', PROJECT_THEMES.contrast)).toBe(blendOver(PROJECT_THEMES.contrast.rim, '#1a1a1a'))
  })

  it('blends the translucent rim over the bead color into one opaque color', () => {
    expect(blendOver('rgba(20,20,19,.12)', '#ffffff')).toBe('rgb(227, 227, 227)')
    expect(blendOver('#123456', '#ffffff')).toBe('#123456')
  })

  it('draws a rounded bead as its rim\'s shape and, inside it a pixel tighter, its color', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ cornerRadius: 6 }))

    expect(named('roundRect').map((call) => call.args)).toEqual([
      [40.5, 20.5, 19, 19, 5.5],
      [41.25, 21.25, 17.5, 17.5, 4.75],
    ])
    expect(named('fill').map((call) => call.fillStyle)).toEqual([blendOver(DEFAULT_THEME.rim, '#e63746'), '#e63746'])
  })

  it('draws a rounded bead from arcs where the browser has no roundRect', () => {
    const { context, named } = recordingContext()
    ;(context as unknown as { roundRect: undefined }).roundRect = undefined

    drawFlatBead(context, bead({ cornerRadius: 6 }))

    expect(named('arcTo').map((call) => call.args[4])).toEqual([5.5, 5.5, 5.5, 5.5, 4.75, 4.75, 4.75, 4.75])
  })

  it('draws an empty bead in the empty tint', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ color: null }))

    expect(named('fillRect')[1]!.fillStyle).toBe(DEFAULT_THEME.emptyBead)
  })

  it('draws a finished bead in light as its own color at 50% over the board, opaque', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ dimmed: true }))

    const faded = fadeOver('#e63746', DEFAULT_THEME.background, 0.5)
    expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha])).toEqual([
      [blendOver(DEFAULT_THEME.rim, faded), 1],
      [faded, 1],
    ])
  })

  it('draws a finished bead in dark as its own color at 50% over the board, not grey (ticket 352)', () => {
    const { context, named } = recordingContext()

    drawFlatBead(context, bead({ dimmed: true, theme: DARK_THEME }))

    const faded = fadeOver('#e63746', DARK_THEME.background, 0.5)
    expect(named('fillRect').map((call) => call.fillStyle)).toEqual([blendOver(DARK_THEME.rim, faded), faded])
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

      const faded = fadeOver('#e63746', '#ffffff', 0.5)
      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([
        [blendOver(DEFAULT_THEME.rim, faded), 1, 40.5, 20.5, 19, 19],
        [faded, 1, 41.25, 21.25, 17.5, 17.5],
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

describe('the keep-out margin on the Canvas', () => {
  /** The clip in force at each drawn bead: whether it is an even-odd one with a rectangle at `box` cut out. */
  function drawnWithMarginCutOut(project: Project, box: [number, number, number, number]): Map<string, boolean> {
    const { context, calls } = recordingContext()
    const cutOut = new Map<string, boolean>()
    const drawBead: BeadDrawer = (_context, bead) => {
      const clipAt = calls.map(({ name }) => name).lastIndexOf('clip')
      const clip = calls[clipAt]
      const corners = clip ? calls.slice(0, clipAt).filter(({ name }) => name === 'moveTo').map(({ args }) => args) : []
      cutOut.set(`${bead.x},${bead.y}`, clip?.args[0] === 'evenodd' && corners.some(([x, y]) => x === box[0] && y === box[1]))
    }
    renderProject(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 2000, height: 2000 }, zoom: 1, rowMarks: false, drawBead })
    return cutOut
  }

  it('hides the overhang of the beads just outside it, which nest into its edge rows in peyote', () => {
    const frame = { technique: 'peyote' as const, row: 20, column: 20, rows: 4, columns: 4 }
    // A bead in the row just above the margin (row 13, the margin being rows 14 to 29): its bottom 5px lies inside the margin's outline.
    const project = { ...projectOf('peyote', 4, 4), frame: { ...frame, beads: {} }, beads: { 13: { 22: '#ff0000' } } }

    const cutOut = drawnWithMarginCutOut(project, [14 * 20, 14 * 15, 16 * 20 + 10, 15 * 15 + 20])

    expect(cutOut.get(`${22 * 20 + 10},${13 * 15}`)).toBe(true)
  })
})

describe('the Frame over the Canvas (ADR 0066)', () => {
  /** A 3 x 2 Frame at row 20, column 20 holding red in its first bead, over a Canvas with blue under the Frame and green beyond it. */
  function layered(): Project {
    const base = projectOf('loom', 3, 2)
    return {
      ...base,
      frame: { technique: 'loom' as const, row: 20, column: 20, rows: 2, columns: 3, beads: { 0: { 0: '#ff0000' } } },
      beads: { 20: { 21: '#0000ff' }, 40: { 40: '#00ff00' } },
    }
  }
  const drawnOnCanvas = (project: Project): BeadShape[] => {
    const beads: BeadShape[] = []
    const drawBead: BeadDrawer = (_context, bead) => beads.push(bead)
    renderProject(recordingContext().context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 2000, height: 2000 }, zoom: 1, rowMarks: false, drawBead })
    return beads
  }
  const colorsAt = (beads: BeadShape[], row: number, column: number) => beads.filter((bead) => bead.x === column * 20 && bead.y === row * 20).map((bead) => bead.color)

  it('draws the Frame\'s own cells at their place on the Canvas, beads and empty beads alike', () => {
    const beads = drawnOnCanvas(layered())

    expect(colorsAt(beads, 20, 20)).toEqual(['#ff0000'])
    expect(colorsAt(beads, 21, 22)).toEqual([null])
  })

  it('does not draw the Canvas beads under the Frame, and still draws those beyond it', () => {
    const beads = drawnOnCanvas(layered())

    expect(colorsAt(beads, 20, 21)).toEqual([null])
    expect(beads.some((bead) => bead.color === '#0000ff')).toBe(false)
    expect(colorsAt(beads, 40, 40)).toEqual(['#00ff00'])
  })

  it('draws only the Frame\'s beads when the Project is drawn on its own, from the origin', () => {
    const project = layered()
    const beads = beadsDrawn(project, whole(project))

    expect(beads.map((bead) => bead.color)).toEqual(['#ff0000', null, null, null, null, null])
  })
})

describe('Netting (ticket 485)', () => {
  // One diamond at Net size 3: 5 columns and 5 rows of positions, 8 of them beads. A bead is 20 and a strand step 15.
  const project = (extra: Partial<Project> = {}) => ({ ...createProject({ technique: 'netting', netSize: 3, beadId: 'toho-cube-1.5mm', size: { width: 1, height: 1, unit: 'beads' } }), ...extra })

  it('measures a block of positions as the steps between them plus one bead', () => {
    expect(projectExtentPx('netting', 5, 5)).toEqual({ width: 4 * 15 + 20, height: 4 * 15 + 20 })
  })

  it('draws round beads, upright, at the places of the mesh and nothing in a hole', () => {
    const woven = project()
    const everyPosition = Array.from({ length: 25 }, (_cell, at) => ({ row: Math.floor(at / 5), column: at % 5, color: '#e63746' }))
    const painted = { ...woven, frame: { ...woven.frame!, beads: withColors({}, everyPosition) } }

    const beads = beadsDrawn(painted, whole(painted))

    expect(beads.map(({ x, y, width, height }) => [x, y, width ?? 20, height ?? 20])).toEqual([
      [30, 0, 20, 20],
      [15, 15, 20, 20],
      [45, 15, 20, 20],
      [0, 30, 20, 20],
      [60, 30, 20, 20],
      [15, 45, 20, 20],
      [45, 45, 20, 20],
      [30, 60, 20, 20],
    ])
    expect(beads.every(({ cornerRadius }) => cornerRadius === 10)).toBe(true)
    expect(beads.every(({ color }) => color === '#e63746')).toBe(true)
  })

  it('paints a bead on its own and leaves the others empty', () => {
    const woven = project()
    const colored = { ...woven, frame: { ...woven.frame!, beads: withColors({}, [{ row: 2, column: 0, color: '#2f6fed' }]) } }

    expect(beadsDrawn(colored, whole(colored)).map(({ color }) => color)).toEqual([null, null, null, '#2f6fed', null, null, null, null])
  })
})

describe('Bead shape (ADR 0068)', () => {
  const delicaCell = { aspect: 1.3 / 1.6, roundness: 0.1 }
  const drawnBeads = (project: Project) => beadsDrawn(project, whole(project))
  const painted = (project: Project): Project => ({
    ...project,
    frame: { ...project.frame!, beads: withColors({}, [0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => ({ row, column, color: '#111111' })))) },
  })

  it('draws the Symmetric cell exactly as the Technique had it', () => {
    const project = painted(projectOf('peyote', 3, 3))
    expect(drawnBeads({ ...project, beadShape: 'symmetric' })).toEqual(drawnBeads(project))
  })

  it('draws each cell with the Bead height and its outline, and rows at its pitch, when Real', () => {
    const real = { ...painted(projectOf('peyote', 3, 3, { beadId: 'miyuki-delica-11-0' })), beadShape: 'real' as const }
    const beads = drawnBeads(real)
    expect(beads).toHaveLength(9)
    for (const bead of beads) {
      expect(bead.width).toBe(20)
      expect(bead.height).toBeCloseTo(20 * delicaCell.aspect)
      expect(bead.cornerRadius).toBe(2)
    }
    const rows = [...new Set(beads.map((bead) => bead.y))]
    expect(rows[1]! - rows[0]!).toBeCloseTo(0.75 * 20 * delicaCell.aspect)
    expect(projectExtentPx('peyote', 3, 3, delicaCell).height).toBeCloseTo(20 * delicaCell.aspect * (1 + 2 * 0.75))
  })

  it('lays a Right-angle weave Unit out from the Bead, not from the Technique\'s own 0.7', () => {
    const unit = (cell?: typeof delicaCell) => projectExtentPx('rightAngle', 3, 3, cell)
    const flatter = projectExtentPx('rightAngle', 3, 3, { aspect: 0.7, roundness: 0.1 })
    expect(flatter).toEqual(unit())
    expect(unit(delicaCell)).not.toEqual(unit())
  })
})

describe('a round Bead in Real shape is a pill (ADR 0068)', () => {
  it('never rounds a corner past half the shorter side', () => {
    const { context, calls } = recordingContext()
    const drawn = { x: 0, y: 0, size: 20, width: 20, height: 26, cornerRadius: 10, color: '#111111', dimmed: false, deviceScale: 1, theme: DEFAULT_THEME }
    drawFlatBead(context, drawn)
    const radii = calls.filter((call) => call.name === 'roundRect').map((call) => call.args[4])
    expect(radii.length).toBeGreaterThan(0)
    for (const radius of radii) expect(radius as number).toBeLessThanOrEqual(10)
  })
})
