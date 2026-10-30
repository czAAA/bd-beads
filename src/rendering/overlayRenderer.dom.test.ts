import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Rect } from '../domain/canvas'
import { withMargin } from '../domain/margin'
import { createProject } from '../domain/createProject'
import { findBead } from '../domain/beads'
import { replaceBead } from '../domain/projectBead'
import { moveToRow, rowProgressOf } from '../domain/rowProgress'
import { changeFrame } from '../domain/changeFrame'
import { frameLayoutOf } from '../domain/frameShape'
import { onLayer } from '../domain/layers'
import { paintCells } from '../domain/drawing'
import type { Project, RowProgress } from '../domain/project'
import { DEFAULT_THEME } from './beadLook'
import { GLINT_COLOR, ROW_MOTION } from './rowMotion'
import { beadRoundness, type Technique } from '../domain/weave'
import { recordingContext } from '../testUtils/recordingContext'
import { renderOverlay as renderOverlayWith } from './overlayRenderer'
import { spaceOf } from './space'
import { CELL_SIZE_PX } from './cellSize'
import { displayedExtentPx, surfaceView } from './surfaceView'
import { canvasOf, frameOf, quarterTurnOf, withFrameSheet } from '../domain/layerRecord'
import { withLayers } from '../testUtils/layerFields'
import { type BeadMap } from '../domain/canvas'
import { MIRROR_OFF, withMirrorArea, type MirrorSetting } from '../domain/mirror'

/** The rings round the current beads (ticket 375): the rounded rectangles of the first stroked path. */
function ringRects(calls: ReturnType<typeof recordingContext>['calls']): ReturnType<typeof recordingContext>['calls'] {
  const stroke = calls.findIndex((call) => call.name === 'stroke')
  const begin = calls.slice(0, stroke).map((call) => call.name).lastIndexOf('beginPath')
  return calls.slice(begin, stroke).filter((call) => call.name === 'roundRect')
}

/** A test Project that draws no Row progress says `marks: false` on its Row progress; the wrapper below hands that to the renderer as `rowMarks`, as an export does. */
type TestRowProgress = RowProgress & { marks?: boolean }

function renderOverlay(context: Parameters<typeof renderOverlayWith>[0], input: Parameters<typeof renderOverlayWith>[1]): void {
  renderOverlayWith(context, { rowMarks: (rowProgressOf(input.project) as TestRowProgress).marks !== false, ...input })
}

/** A Project whose whole Frame holds beads, since only a cell with a bead is marked (ticket 411). */
/** The Project in a Bead this device does not know, drawn in its Technique's own cell (rounded in peyote), not a cube's. */
const ownCell = (project: Project): Project => withLayers(project, { bead: undefined })

function projectOf(technique: Technique, columns: number, rows: number, rowProgress: Partial<TestRowProgress>, rotation: Rotation = 0, filled = true): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  const beads: BeadMap = {}
  for (let row = 0; filled && row < rows; row += 1) {
    beads[row] = Object.fromEntries(Array.from({ length: columns }, (_, column) => [column, '#e63746']))
  }
  return withLayers(project, { frame: { ...frameOf(project)!, beads }, orientation: rotation, rowProgress: { direction: 'rows', currentRow: 0, currentColumn: 0, ...rowProgress } })
}

function whole(project: Project, zoom = 1) {
  const { width, height } = displayedExtentPx(canvasOf(project).technique, frameOf(project)!.columns, frameOf(project)!.rows, zoom, quarterTurnOf(project))
  return { x: 0, y: 0, width, height }
}

describe('renderOverlay', () => {
  it('clears the layer, and draws nothing else while Row progress is off', () => {
    const project = projectOf('loom', 4, 4, { marks: false })
    const { context, calls } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1 })

    expect(calls.map((call) => call.name)).toEqual(['setTransform', 'clearRect'])
  })

  it('clears the whole backing store, at the pixel ratio', () => {
    const project = projectOf('loom', 4, 3, { marks: false })
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1, pixelRatio: 2 })

    expect(named('clearRect')[0]!.args).toEqual([0, 0, 160, 120])
  })

  describe('the row being woven (rows along the grid\'s rows)', () => {
    it('strokes one 3px ring path round the beads of the row, and no line joins them (tickets 352, 376)', () => {
      const project = projectOf('loom', 4, 5, { currentRow: 2 })
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(named('stroke')).toHaveLength(1)
      expect(ringRects(calls)).toHaveLength(4)
      expect(named('lineTo')).toHaveLength(0)
    })

    it('rings every bead of the row inside its cell (tickets 375, 376)', () => {
      const project = projectOf('loom', 3, 3, { currentRow: 1 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      const outline = ringRects(calls)
      // Row 1 of a 3-wide loom: three beads at x 0, 20, 40 and y 20, each ringed 1px in, so its 2px stroke ends on the cell's edge and no ring reaches a neighbour.
      expect(outline.map((call) => call.args)).toEqual([[1, 21, 18, 18, 0], [21, 21, 18, 18, 0], [41, 21, 18, 18, 0]])
    })

    it('rings only the peyote beads woven in the current pass (ticket 375)', () => {
      // Pass 2 is the second half of line 1: the beads at odd positions.
      const project = projectOf('peyote', 5, 3, { currentRow: 2 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(ringRects(calls)).toHaveLength(2)
    })

    it('keeps the last row\'s rings inside the Project, with no clamping needed', () => {
      const project = projectOf('loom', 4, 5, { currentRow: 4 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      // Row 4 is y 80..100, the Project's own edge: the ring's outer edge is that edge.
      expect(ringRects(calls)[1]!.args).toEqual([21, 81, 18, 18, 0])
    })

    it('rings a brick stitch row where it sits, half a bead across', () => {
      const brick = projectOf('brick', 3, 4, { currentRow: 1 })
      const { context, calls } = recordingContext()
      renderOverlay(context, { project: brick, region: whole(brick), zoom: 1 })

      expect(ringRects(calls)[0]!.args.slice(0, 2)).toEqual([11, 21])
    })

    it('rings each peyote bead with its own corner radius, less the half stroke', () => {
      const R = beadRoundness('peyote') * CELL_SIZE_PX - 1
      const project = ownCell(projectOf('peyote', 5, 3, { currentRow: 0 }))
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(ringRects(calls).map((call) => call.args[4])).toEqual([R, R, R, R, R])
    })

    it('marks only the cells that hold a bead: an empty cell gets no ring and no lift (ticket 411)', () => {
      const base = projectOf('loom', 3, 3, { currentRow: 1 })
      const project = withLayers(base, { frame: { ...frameOf(base)!, beads: { 1: { 0: '#e63746', 2: '#e63746' } } } })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(ringRects(calls).map((call) => call.args.slice(0, 2))).toEqual([[1, 21], [41, 21]])
    })

    it('shows no marker for a pass with no beads', () => {
      const project = projectOf('loom', 3, 3, { currentRow: 1 }, 0, false)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(named('stroke')).toHaveLength(0)
      expect(named('roundRect')).toHaveLength(0)
    })

    it('draws nothing for a row that is not there', () => {
      const project = projectOf('loom', 4, 4, { currentRow: 9 })
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(named('fillRect')).toHaveLength(0)
      expect(named('fill')).toHaveLength(0)
    })
  })

  describe('the glint of a pass just finished (BeadBoard card, ticket 0730)', () => {
    const glinted = (calls: ReturnType<typeof recordingContext>['calls']) => calls.filter((call) => call.name === 'fill' && call.fillStyle === GLINT_COLOR && call.globalAlpha > 0)
    const plainRed = (calls: ReturnType<typeof recordingContext>['calls']) => calls.filter((call) => call.fillStyle === '#e63746')

    it('washes each bead of the pass in white and shows it at full color until the dim delay', () => {
      const project = projectOf('loom', 4, 3, { currentRow: 2 })
      const { context, calls } = recordingContext()
      renderOverlay(context, { project, region: whole(project), zoom: 1, rowMotion: { glints: [{ pass: 1, elapsed: 0.35 * ROW_MOTION.glint }] } })
      expect(glinted(calls)).toHaveLength(4)
      expect(plainRed(calls).length).toBeGreaterThan(0)
    })

    it('washes only the beads that pass adds on peyote', () => {
      const project = projectOf('peyote', 5, 3, { currentRow: 3 })
      const { context, calls } = recordingContext()
      renderOverlay(context, { project, region: whole(project), zoom: 1, rowMotion: { glints: [{ pass: 2, elapsed: 0.35 * ROW_MOTION.glint }] } })
      expect(glinted(calls)).toHaveLength(2)
    })

    it('leaves the pass to its finished look after the dim delay, and draws nothing of it with Row highlight off', () => {
      const project = projectOf('loom', 4, 3, { currentRow: 2 })
      const later = recordingContext()
      renderOverlay(later.context, { project, region: whole(project), zoom: 1, rowMotion: { glints: [{ pass: 1, elapsed: ROW_MOTION.dimDelay }] } })
      expect(glinted(later.calls)).toEqual([])
      expect(plainRed(later.calls)).toEqual([])

      const off = recordingContext()
      renderOverlay(off.context, { project, region: whole(project), zoom: 1, rowMarks: false, rowMotion: { glints: [{ pass: 1, elapsed: 0.35 * ROW_MOTION.glint }] } })
      expect(glinted(off.calls)).toEqual([])
    })
  })

  describe('the column being woven (rows down the grid\'s columns)', () => {
    it('rings every bead of the column, as it does a row\'s', () => {
      const project = projectOf('loom', 4, 3, { direction: 'columns', currentColumn: 1 })
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(ringRects(calls).map((call) => call.args.slice(0, 2))).toEqual([[21, 1], [21, 21], [21, 41]])
      expect(named('lineTo')).toHaveLength(0)
    })

    it('rings only the beads woven in the pass on peyote', () => {
      const project = projectOf('peyote', 3, 2, { direction: 'columns', currentColumn: 1 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(ringRects(calls)).toHaveLength(1)
    })
  })

  describe('the pass being woven on a Custom frame (ticket 0594)', () => {
    it('rings each bead of the current round turned to its panel\'s angle, and only the beads that hold a colour', () => {
      const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
      const placed = changeFrame(open, { custom: { shape: 'triangle', size: 4, centre: { row: 20, column: 20 } } })
      if (placed.kind !== 'changed') throw new Error('expected a Triangle')
      const round = frameLayoutOf(frameOf(placed.project)!)!.positions.filter(({ row }) => row === 1)
      const painted = onLayer(placed.project, 'frame', (view) => paintCells(view, round.slice(0, 4), '#e63746'))
      const project = moveToRow(painted, 1)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, space: spaceOf(project, true) })

      expect(named('rotate').map((call) => call.args[0])).toEqual(expect.arrayContaining(round.slice(0, 4).map(({ angle }) => angle)))
      // Each of the four beads is lifted and ringed, both turned: eight turns, no more.
      expect(named('rotate')).toHaveLength(8)
    })

    it('glints the round just finished one bead at a time in its Row order, each turned to its panel (ticket 0730)', () => {
      const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
      const placed = changeFrame(open, { custom: { shape: 'triangle', size: 4, centre: { row: 20, column: 20 } } })
      if (placed.kind !== 'changed') throw new Error('expected a Triangle')
      const round = frameLayoutOf(frameOf(placed.project)!)!.positions.filter(({ row }) => row === 1)
      const project = moveToRow(onLayer(placed.project, 'frame', (view) => paintCells(view, round.slice(0, 4), '#e63746')), 2)
      const washed = (elapsed: number) => {
        const { context, calls } = recordingContext()
        renderOverlay(context, { project, region: whole(project), zoom: 1, space: spaceOf(project, true), rowMotion: { glints: [{ pass: 1, elapsed }] } })
        return calls.filter((call) => call.name === 'fill' && call.fillStyle === GLINT_COLOR && call.globalAlpha > 0)
      }

      // The first bead has started and the next not yet; a little later all four are washing.
      expect(washed(ROW_MOTION.glintStep / 2)).toHaveLength(1)
      expect(washed(4 * ROW_MOTION.glintStep)).toHaveLength(4)
    })
  })

  it('draws through the same transform as the cells: zoom and a quarter turn', () => {
    const project = projectOf('loom', 3, 2, { currentRow: 0 }, 90)
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project, 2), zoom: 2 })

    // The same matrix renderProject sets for this Project, so the marker lands on its own bead.
    expect(named('setTransform').at(-1)!.args).toEqual([0, 2, -2, 0, 80, -0])
  })

  describe('the hover preview', () => {
    const noProgress = { marks: false }

    it('shows the paint color faintly on the bead, inside its rim', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 2 }], color: '#e63746' } })

      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([['#e63746', 0.6, 40.5, 20.5, 19, 19]])
      expect(context.globalAlpha).toBe(1)
    })

    it('shows each bead of a block in its own color, where it has one', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        project,
        region: whole(project),
        zoom: 1,
        preview: { cells: [{ row: 0, column: 0, color: '#2f6fed' }, { row: 0, column: 1 }], color: '#e63746' },
      })

      expect(named('fillRect').map((call) => call.fillStyle)).toEqual(['#2f6fed', '#e63746'])
    })

    it('outlines the bead in the dark ink when there is no color to show', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 0, column: 0 }], color: null } })

      expect(named('fill')).toHaveLength(1)
      expect(named('fill')[0]!.fillStyle).toBe(DEFAULT_THEME.outline)
      expect(named('fill')[0]!.args).toEqual(['evenodd'])
      expect(named('fillRect')).toHaveLength(0)
    })

    it('follows a shifted row and the Technique\'s packing, and rounds a peyote outline', () => {
      const project = ownCell(projectOf('peyote', 4, 3, noProgress))
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: null } })

      // Row 1: half a bead across (10) and 15px down; the color goes inside the 1px rim.
      const outline = named('roundRect').map((call) => call.args as number[])
      expect(outline.map((args) => args.slice(0, 4))).toEqual([[30.5, 15.5, 19, 19], [32.5, 17.5, 15, 15]])
      // Rounded at 22% of the bead less its gap, and 2px less inside.
      expect(outline[0]![4]).toBeCloseTo(3.9)
      expect(outline[1]![4]).toBeCloseTo(1.9)
    })

    it('fills a peyote bead\'s own rounded shape, leaving out what the next row\'s beads lie over', () => {
      const project = projectOf('peyote', 4, 3, noProgress)
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' } })

      expect(named('fillRect')).toHaveLength(0)
      // Row 2 sits 15px lower and half a bead back: its beads at x = 21 and 41 (the bead is at 31), under the bead's own 1px gap.
      const cutOuts = named('roundRect').map((call) => (call.args as number[]).slice(0, 4))
      expect(cutOuts).toEqual([[20.5, 30.5, 19, 19], [40.5, 30.5, 19, 19], [30.5, 15.5, 19, 19]])
      const clipAt = calls.findIndex((call) => call.name === 'clip')
      const fillAt = calls.findIndex((call) => call.name === 'fill' && call.fillStyle === '#e63746')
      expect(clipAt).toBeGreaterThan(0)
      expect(fillAt).toBeGreaterThan(clipAt)
      expect(named('clip')[0]!.args).toEqual(['evenodd'])
    })

    it('leaves out only the next-row beads the Project has', () => {
      const project = projectOf('peyote', 4, 3, noProgress)
      const { context, named } = recordingContext()

      // Row 1 is shifted half a bead, so row 2's beads under its last bead are columns 3 and 4, and 4 is not there.
      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 3 }], color: '#e63746' } })

      const cutOuts = named('roundRect').map((call) => (call.args as number[]).slice(0, 2))
      expect(cutOuts).toEqual([[60.5, 30.5], [70.5, 15.5]])
    })

    it('leaves a bead on the last peyote row whole, and a loom bead too', () => {
      const peyote = projectOf('peyote', 4, 3, noProgress)
      const last = recordingContext()
      renderOverlay(last.context, { project: peyote, region: whole(peyote), zoom: 1, preview: { cells: [{ row: 2, column: 1 }], color: '#e63746' } })
      expect(last.named('clip')).toHaveLength(0)

      const loom = projectOf('loom', 4, 3, noProgress)
      const stacked = recordingContext()
      renderOverlay(stacked.context, { project: loom, region: whole(loom), zoom: 1, preview: { cells: [{ row: 0, column: 1 }], color: '#e63746' } })
      expect(stacked.named('clip')).toHaveLength(0)
    })

    it('leaves out a bead that is not in the Project', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 5, column: 0 }, { row: 0, column: -1 }, { row: 0, column: 4 }], color: '#e63746' } })

      expect(named('fillRect')).toHaveLength(0)
    })

    it('is drawn under the Row progress marker, which is lifted above the beads', () => {
      const project = projectOf('loom', 4, 3, { currentRow: 1 })
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' } })

      // The row's own beads are lifted first (ticket 375); the preview goes over them, then nothing but the marker.
      const styles = named('fillRect').map((call) => call.fillStyle)
      const previewAt = styles.indexOf('#e63746')
      expect(previewAt).toBeGreaterThan(0)
      expect(styles.slice(previewAt + 1).every((style) => style === DEFAULT_THEME.marker)).toBe(true)
    })

    it('clears the layer when it is gone, so a hover leaves nothing behind', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [], color: '#e63746' } })

      expect(calls.some((call) => call.name === 'clearRect')).toBe(true)
      expect(calls.some((call) => call.name === 'fillRect')).toBe(false)
    })
  })

  describe('the Selection', () => {
    const noProgress = { marks: false }
    const selected = { top: 1, left: 1, rows: 3, columns: 4 }

    it('is drawn as the rectangle\'s outer border, 2px thick inside its edge, with no wash on its beads (ticket 414)', () => {
      const project = projectOf('loom', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, selection: selected })

      // Beads 1..3 down and 1..4 across: a box from (20, 20) that is 80 wide and 60 tall.
      const strips = named('fillRect')
      expect(strips.map((call) => call.args)).toEqual([
        [20, 20, 80, 2],
        [20, 78, 80, 2],
        [20, 20, 2, 60],
        [98, 20, 2, 60],
      ])
      expect(strips.every((call) => call.fillStyle === DEFAULT_THEME.marker && call.globalAlpha === 1)).toBe(true)
      expect(named('drawImage')).toHaveLength(0)
    })

    it('spans the furthest left and right its rows reach on brick stitch, so it reads as one rectangle', () => {
      const brick = projectOf('brick', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project: brick, region: whole(brick), zoom: 1, selection: { top: 1, left: 0, rows: 2, columns: 2 } })

      // Row 1 is half a bead across, row 2 is back at the left: the box runs from 0 to 10 + 40.
      const [top] = named('fillRect')
      expect(top!.args).toEqual([0, 20, 50, 2])
    })

    it('is one border on peyote too, with no per-bead work however big the Selection is', () => {
      const project = projectOf('peyote', 250, 250, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        project,
        region: { x: 0, y: 0, width: 100, height: 60 },
        zoom: 1,
        selection: { top: 0, left: 0, rows: 250, columns: 250 },
      })

      expect(named('fillRect')).toHaveLength(4)
    })

    it('clips a Selection that reaches past the Project', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, selection: { top: 1, left: 2, rows: 9, columns: 9 } })

      // Down to the last row (2) and across to the last column (3): a 40 wide, 40 tall box from (40, 20).
      expect(named('fillRect')[0]!.args).toEqual([40, 20, 40, 2])
      expect(named('fillRect')[3]!.args).toEqual([78, 20, 2, 40])
    })

    it('is drawn under the hover preview and the Row progress marker', () => {
      const project = projectOf('loom', 6, 5, { currentRow: 2 })
      const { context, calls } = recordingContext()

      renderOverlay(context, {
        project,
        region: whole(project),
        zoom: 1,
        selection: selected,
        preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' },
      })

      const order = calls
        .filter((call) => call.name === 'fillRect' || call.name === 'stroke')
        .map((call) => (call.name === 'stroke' ? 'marker' : call.fillStyle === '#e63746' ? 'preview' : 'border'))
      // Beads of the row are lifted before all of it (ticket 375), so look from the first border strip on.
      const fromBorder = order.slice(order.indexOf('border'))
      expect(fromBorder.indexOf('border')).toBeLessThan(fromBorder.indexOf('preview'))
      expect(fromBorder.indexOf('preview')).toBeLessThan(fromBorder.indexOf('marker'))
    })

    it('shows the Frame\'s eight handles round it when the surface is known, and four on touch (ticket 414)', () => {
      const project = projectOf('loom', 6, 5, noProgress)
      const surface = surfaceView({ technique: 'loom', space: spaceOf(project, true), rotation: 0, zoom: 1, viewport: { width: 200, height: 160 } })

      for (const [touch, count] of [[false, 8], [true, 4]] as const) {
        const { context, named } = recordingContext()
        renderOverlay(context, { project, region: whole(project), zoom: 1, space: spaceOf(project, true), selection: selected, selectionHandles: { surface, touch } })

        expect(named('roundRect')).toHaveLength(count)
      }
    })

    it('shows no handles on a Selection of fewer than five beads, the same size rulers need (ticket 435)', () => {
      const project = projectOf('loom', 6, 5, noProgress)
      const surface = surfaceView({ technique: 'loom', space: spaceOf(project, true), rotation: 0, zoom: 1, viewport: { width: 200, height: 160 } })

      for (const [rows, columns, count] of [[1, 1, 0], [2, 2, 0], [1, 5, 8], [2, 3, 8]] as const) {
        const { context, named } = recordingContext()
        renderOverlay(context, { project, region: whole(project), zoom: 1, space: spaceOf(project, true), selection: { top: 0, left: 0, rows, columns }, selectionHandles: { surface, touch: false } })

        expect(named('roundRect')).toHaveLength(count)
      }
    })
  })

  describe('Mirror\'s Axis lines on the Frame (ticket 0703)', () => {
    const on = (axes: Partial<MirrorSetting['axes']>, counts: Partial<MirrorSetting['counts']> = {}): MirrorSetting => ({ ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, ...axes }, counts: { ...MIRROR_OFF.counts, ...counts } })
    /** The lines stroked, as [from, to] in the Frame's px. */
    const lines = (calls: ReturnType<typeof recordingContext>['calls']) => {
      const moves = calls.filter((call) => call.name === 'moveTo' || call.name === 'lineTo')
      return moves.flatMap((call, index) => (call.name === 'moveTo' ? [[call.args, moves[index + 1]!.args]] : []))
    }

    it('draws N dashed marker lines cutting the Frame into N + 1 equal strips, in screen px at any zoom, with the Frame alone', () => {
      const project = projectOf('loom', 6, 4, { marks: false })
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project, 2), zoom: 2, mirror: on({ leftRight: true, topBottom: true }, { leftRight: 2 }) })

      expect(lines(calls)).toEqual([
        [[40, 0], [40, 80]],
        [[80, 0], [80, 80]],
        [[0, 40], [120, 40]],
      ])
      expect(named('setLineDash')[0]!.args[0]).toEqual([2.5, 2])
      const stroke = calls.find((call) => call.name === 'stroke')!
      expect(stroke.strokeStyle).toBe(DEFAULT_THEME.marker)
    })

    it('moves with the Frame on the open Canvas, across the box round a peyote Frame\'s beads', () => {
      const project = withLayers(projectOf('peyote', 4, 4, { marks: false }), { frame: { technique: 'peyote' as const, row: 5, column: 5, rows: 4, columns: 4, beads: {} } })
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 1, mirror: on({ leftRight: true }) })

      // Column 5 of a peyote Canvas is 100px in, plus the odd row's half-bead shift; row 5 sits at 5 × 15px.
      expect(named('translate').map((call) => call.args)).toContainEqual([110, 75])
      // The box round 4 peyote columns is 4 × 20 + 10px wide (the shifted rows), 20 + 3 × 15px tall.
      expect(lines(calls)).toEqual([[[45, 0], [45, 65]]])
    })

    it('draws nothing while the mode is Off or no Axis is on', () => {
      const project = projectOf('loom', 4, 4, { marks: false })
      const off = recordingContext()
      renderOverlay(off.context, { project, region: whole(project), zoom: 1, mirror: MIRROR_OFF })
      expect(off.named('stroke')).toHaveLength(0)
      expect(off.named('moveTo')).toHaveLength(0)
      const noAxis = recordingContext()
      renderOverlay(noAxis.context, { project, region: whole(project), zoom: 1, mirror: on({}) })
      expect(noAxis.named('stroke')).toHaveLength(0)
    })
  })

  describe('the Area the Axes run inside (ticket 0710, MirrorPopover card)', () => {
    const on = (axes: Partial<MirrorSetting['axes']>): MirrorSetting => ({ ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, ...axes } })
    const lines = (calls: ReturnType<typeof recordingContext>['calls']) => {
      const moves = calls.filter((call) => call.name === 'moveTo' || call.name === 'lineTo')
      return moves.flatMap((call, index) => (call.name === 'moveTo' ? [[call.args, moves[index + 1]!.args]] : []))
    }
    const fills = (calls: ReturnType<typeof recordingContext>['calls']) => calls.filter((call) => call.name === 'fillRect').map((call) => call.args)

    it('on a Frame draws the Area as the Selection\'s rectangle round its cells and the Axis lines inside it, not across the Frame', () => {
      const project = withMirrorArea(projectOf('loom', 6, 4, { marks: false }), 'frame', { row: 1, column: 1, rows: 2, columns: 4 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, mirror: on({ leftRight: true }) })

      expect(lines(calls)).toEqual([[[60, 20], [60, 60]]])
      expect(fills(calls)).toEqual([[20, 20, 80, 2], [20, 58, 80, 2], [20, 20, 2, 40], [98, 20, 2, 40]])
      expect(calls.find((call) => call.name === 'fillRect')!.fillStyle).toBe(DEFAULT_THEME.marker)
    })

    it('on the open Canvas draws the Area and its Axes in place of the view-wide Axes, with the Selection\'s eight handles when the view is known, and the band a pick drags with none', () => {
      const framed = projectOf('loom', 6, 5, { marks: false })
      const open = withMirrorArea((changeFrame(framed, { remove: true }) as { project: Project }).project, 'canvas', { row: 2, column: 3, rows: 2, columns: 2 })
      const surface = surfaceView({ technique: 'loom', space: spaceOf(open, true), rotation: 0, zoom: 1, viewport: { width: 200, height: 160 } })
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project: open, space: spaceOf(open, true), region: { x: 0, y: 0, width: 200, height: 160 }, zoom: 1, mirror: on({ leftRight: true }), canvasAxes: { axes: { leftRight: 1 }, handles: [] }, mirrorArea: { surface, touch: false, band: { row: 0, column: 0, rows: 1, columns: 3, layer: 'canvas' } } })

      expect(lines(calls)).toEqual([[[80, 40], [80, 80]]])
      expect(fills(calls).slice(0, 4)).toEqual([[60, 40, 40, 2], [60, 78, 40, 2], [60, 40, 2, 40], [98, 40, 2, 40]])
      expect(fills(calls).slice(4)).toEqual([[0, 0, 60, 2], [0, 18, 60, 2], [0, 0, 2, 20], [58, 0, 2, 20]])
      expect(named('roundRect')).toHaveLength(8)
    })

    it('draws no Area while the mode is Off', () => {
      const project = withMirrorArea(projectOf('loom', 6, 4, { marks: false }), 'frame', { row: 1, column: 1, rows: 2, columns: 4 })
      const { context, named } = recordingContext()
      renderOverlay(context, { project, region: whole(project), zoom: 1 })
      expect(named('fillRect')).toHaveLength(0)
    })
  })

  describe('Mirror\'s Axes on the open Canvas (ticket 0704)', () => {
    const on = (axes: Partial<MirrorSetting['axes']>): MirrorSetting => ({ ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, ...axes } })
    const lines = (calls: ReturnType<typeof recordingContext>['calls']) => {
      const moves = calls.filter((call) => call.name === 'moveTo' || call.name === 'lineTo')
      return moves.flatMap((call, index) => (call.name === 'moveTo' ? [[call.args, moves[index + 1]!.args]] : []))
    }
    const open = () => withLayers(projectOf('loom', 4, 4, { marks: false }), { frame: undefined })
    const handle = { axis: 'leftRight' as const, x: 70, y: 56, size: 32 }

    it('draws each Axis as a dashed marker line across the whole view in screen px, and its chip at a fixed size over everything', () => {
      const { context, calls, named } = recordingContext()
      renderOverlayWith(context, { project: open(), space: spaceOf(open(), true), region: { x: 0, y: 0, width: 400, height: 300 }, zoom: 2, pixelRatio: 2, mirror: on({ leftRight: true, topBottom: true }), canvasAxes: { axes: { leftRight: 3, topBottom: 1 }, handles: [handle] } })

      expect(lines(calls)).toEqual([
        [[70, 0], [70, 150]],
        [[0, 30], [200, 30]],
      ])
      expect(named('setLineDash')[0]!.args[0]).toEqual([2.5, 2])
      expect(calls.find((call) => call.name === 'stroke')!.strokeStyle).toBe(DEFAULT_THEME.marker)
      const chip = named('arc').find((call) => call.args[2] === 16)!
      expect(chip.args.slice(0, 3)).toEqual([70, 56, 16])
      expect(chip.fillStyle).toBe(DEFAULT_THEME.chip.fill)
      expect(chip.strokeStyle).toBe(DEFAULT_THEME.marker)
      // The chips are drawn in the viewport's px: the transform set just before them is the pixel ratio alone.
      const transforms = named('setTransform').map((call) => call.args)
      expect(transforms[transforms.length - 1]).toEqual([2, 0, 0, 2, 0, 0])
    })

    it('draws a held chip in the accent, and nothing while the mode is Off or no Axis is given', () => {
      const held = recordingContext()
      renderOverlayWith(held.context, { project: open(), space: spaceOf(open(), true), region: { x: 0, y: 0, width: 400, height: 300 }, zoom: 1, mirror: on({ leftRight: true }), canvasAxes: { axes: { leftRight: 3 }, handles: [handle], held: 'leftRight' } })
      expect(held.named('arc').find((call) => call.args[2] === 16)!.strokeStyle).toBe(DEFAULT_THEME.accent)

      const off = recordingContext()
      renderOverlayWith(off.context, { project: open(), space: spaceOf(open(), true), region: { x: 0, y: 0, width: 400, height: 300 }, zoom: 1, canvasAxes: { axes: { leftRight: 3 }, handles: [handle] } })
      expect(off.named('stroke')).toHaveLength(0)
      const none = recordingContext()
      renderOverlayWith(none.context, { project: open(), space: spaceOf(open(), true), region: { x: 0, y: 0, width: 400, height: 300 }, zoom: 1, mirror: on({ leftRight: true }), canvasAxes: { axes: {}, handles: [] } })
      expect(none.named('stroke')).toHaveLength(0)
    })
  })

  describe('Radial on a Frame and on the open Canvas (ticket 0705, MirrorPopover card)', () => {
    const radial = (fold: number, mode: MirrorSetting['mode']): MirrorSetting => ({ ...MIRROR_OFF, mode, axes: { ...MIRROR_OFF.axes, radial: true }, fold })
    const lines = (calls: ReturnType<typeof recordingContext>['calls']) => {
      const moves = calls.filter((call) => call.name === 'moveTo' || call.name === 'lineTo')
      return moves.flatMap((call, index) => (call.name === 'moveTo' ? [[call.args, moves[index + 1]!.args]] : []))
    }
    const strokes = (calls: ReturnType<typeof recordingContext>['calls']) => calls.filter((call) => call.name === 'stroke')

    it('in Mirror mode draws the ring at the Frame\'s centre and the Fold\'s mirror lines through it, the first vertical and full, the others soft, clipped to the Frame', () => {
      const project = projectOf('loom', 6, 4, { marks: false })
      const { context, calls, named } = recordingContext()
      renderOverlay(context, { project, region: whole(project, 2), zoom: 2, mirror: radial(4, 'mirror') })

      const ring = named('arc')[0]!
      expect(ring.args.slice(0, 3)).toEqual([60, 40, 3.5])
      expect(ring.strokeStyle).toBe(DEFAULT_THEME.marker)
      expect(named('rect').map((call) => call.args)).toContainEqual([0, 0, 120, 80])
      expect(named('clip')).toHaveLength(1)
      const drawn = lines(calls)
      expect(drawn).toHaveLength(4)
      const [[from, to]] = drawn as [number[], number[]][]
      expect([from![0], to![0]]).toEqual([60, 60])
      expect(from![1]).toBeLessThan(40)
      expect(to![1]).toBeGreaterThan(40)
      // The second line leans 45°: as far across as down.
      const [[from2, to2]] = drawn.slice(1) as [number[], number[]][]
      expect(Math.abs((to2![0] - from2![0]) / (to2![1] - from2![1]))).toBeCloseTo(1, 6)
      expect(strokes(calls).map((call) => call.globalAlpha)).toEqual([1, 0.45, 0.45, 0.45, 1])
    })

    it('in Repeat mode draws the Fold\'s sector rays from the centre, the first straight up, all full, and no straight Axis line', () => {
      const project = projectOf('loom', 6, 4, { marks: false })
      const { context, calls } = recordingContext()
      renderOverlay(context, { project, region: whole(project, 2), zoom: 2, mirror: { ...radial(3, 'repeat'), axes: { leftRight: true, topBottom: false, radial: true } } })

      const drawn = lines(calls)
      expect(drawn).toHaveLength(3)
      expect(drawn.every(([from]) => from![0] === 60 && from![1] === 40)).toBe(true)
      expect(drawn[0]![1]![0]).toBe(60)
      expect(drawn[0]![1]![1]).toBeLessThan(40)
      expect(strokes(calls).every((call) => call.globalAlpha === 1)).toBe(true)
    })

    it('on the open Canvas draws the ring and lines at the centre handle\'s place, in Repeat mode too, with the centre chip', () => {
      const open = withLayers(projectOf('loom', 4, 4, { marks: false }), { frame: undefined })
      const chip = { axis: 'radial' as const, x: 70, y: 30, size: 32 }
      const { context, calls, named } = recordingContext()
      renderOverlayWith(context, { project: open, space: spaceOf(open, true), region: { x: 0, y: 0, width: 400, height: 300 }, zoom: 1, mirror: radial(2, 'repeat'), canvasAxes: { axes: { centre: { row: 1, column: 3 } }, handles: [chip] } })

      expect(named('arc')[0]!.args.slice(0, 3)).toEqual([70, 30, 7])
      const drawn = lines(calls)
      expect(drawn).toHaveLength(2)
      expect(drawn.every(([from]) => from![0] === 70 && from![1] === 30)).toBe(true)
      expect(named('arc').find((call) => call.args[2] === 16)!.args.slice(0, 2)).toEqual([70, 30])
    })
  })

  describe('the Frame margin outline (ticket 276)', () => {
    const framed = withLayers(projectOf('loom', 4, 4, { marks: false }), { frame: { technique: 'loom' as const, row: 5, column: 5, rows: 4, columns: 4, beads: {} } })

    it('strokes a dashed 1px outline round the margin at the given opacity', () => {
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project: framed, space: spaceOf(framed, true), region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 2, marginOutline: 0.5 })

      expect(named('setLineDash')[0]!.args[0]).toEqual([2, 1.5])
      const stroke = calls.find((call) => call.name === 'stroke')!
      expect(stroke.globalAlpha).toBe(0.5)
    })

    // The margin's cells come from `withMargin`; the sizes are worked out here from the bead geometry (CELL_SIZE_PX 20), not from `projectExtentPx`.
    const outline = (technique: Technique, frame: Rect) => {
      const project = withLayers(projectOf(technique, 4, 4, { marks: false }), { frame: { technique, ...frame, beads: {} } })
      const { context, calls } = recordingContext()
      renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 1, marginOutline: 1 })
      const [x, , width, height] = calls.find((call) => call.name === 'roundRect')!.args as number[]
      return { x, width, height, outer: withMargin(frame) }
    }
    const frame = { row: 5, column: 5, rows: 4, columns: 4 }

    it.each([
      ['loom', (rows: number, columns: number) => ({ width: columns * 20, height: rows * 20 })],
      ['peyote', (rows: number, columns: number) => ({ width: columns * 20 + 10, height: 20 + (rows - 1) * 15 })], // rows nest at three quarters of a bead; shifted rows add half a bead across
      ['brick', (rows: number, columns: number) => ({ width: columns * 20 + 10, height: 20 + (rows - 1) * 20 })], // rows sit a bead apart
    ] as const)('wraps the %s margin as drawn, not as a full-bead grid', (technique, sizeOf) => {
      const { width, height, outer } = outline(technique, frame)

      expect({ width, height }).toEqual(sizeOf(outer.rows, outer.columns))
    })

    it('starts at the margin\'s own column even when its first row is a shifted one', () => {
      const shiftedFirstRow = { ...frame, row: 7, column: 8 }
      const { x, outer } = outline('peyote', shiftedFirstRow)

      expect(outer.row % 2).toBe(1)
      expect(x).toBe(outer.column * 20)
    })

    it('draws nothing while it is faded out', () => {
      const { context, calls } = recordingContext()

      renderOverlay(context, { project: framed, space: spaceOf(framed, true), region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 1, marginOutline: 0 })

      expect(calls.some((call) => call.name === 'stroke')).toBe(false)
    })
  })
})

describe('the overlay of a Frame woven in its own Technique (ticket 492)', () => {
  /** A peyote Frame of 3 × 3 at row 2, column 3 of a loom Canvas, every bead painted, the first pass the current one. */
  function mixed(): Project {
    const base = projectOf('loom', 3, 3, { currentRow: 1 })
    return withLayers(base, { frame: { ...frameOf(base)!, technique: 'peyote', row: 2, column: 3 } })
  }

  it('rings the current pass in the Frame\'s Weave, drawn from the corner of the Canvas position the Frame lies on', () => {
    const project = mixed()
    const { context, calls } = recordingContext()

    renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 300, height: 300 }, zoom: 1 })

    expect(calls.find((call) => call.name === 'translate')?.args).toEqual([60, 40])
    // Pass 1 is row 1's even beads, columns 0 and 2: x 10 and 50, y 15 (peyote's second row, shifted half a bead).
    const rings = ringRects(calls).map((call) => call.args as number[])
    expect(rings.map(([x, y]) => [x! - 1, y! - 1])).toEqual([[10, 15], [50, 15]])
  })

  it('outlines a Selection of the Frame inside the Frame\'s layer and one of the Canvas outside it', () => {
    const project = withLayers(mixed(), { rowProgress: { direction: 'rows' as const, currentRow: 0, currentColumn: 0, marks: false } as RowProgress })
    const draw = (layer: 'canvas' | 'frame', top: number) => {
      const { context, calls } = recordingContext()
      renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 300, height: 300 }, zoom: 1, selection: { top, left: 3, rows: 1, columns: 1, layer } })
      return calls
    }

    const inFrame = draw('frame', 3)
    expect(inFrame.find((call) => call.name === 'translate')?.args).toEqual([60, 40])
    expect(inFrame.filter((call) => call.name === 'fillRect')[0]?.args).toEqual([10, 15, 20, 2])
    const onCanvas = draw('canvas', 9)
    expect(onCanvas.findIndex((call) => call.name === 'fillRect')).toBeLessThan(onCanvas.findIndex((call) => call.name === 'translate'))
    expect(onCanvas.filter((call) => call.name === 'fillRect')[0]?.args).toEqual([60, 180, 20, 2])
  })
})

describe('a big paste preview and Piece-shaped Selection draw only what is on screen (ticket 0675)', () => {
  afterEach(() => vi.restoreAllMocks())
  const RED = '#e63746'
  /** An open Canvas with no Frame, Row progress off. */
  const canvas = (): Project => (withLayers(projectOf('loom', 4, 4, { marks: false }), { frame: undefined }))
  /** A 100 × 60 px window at zoom 1 into the middle of the Canvas, half a bead off the grid: it shows parts of 6 × 4
   * beads of 20 px. */
  const window = { x: 2010, y: 2010, width: 100, height: 60 }
  const ON_SCREEN = 24
  const block = (rows: number, columns: number, color: string | null = RED) => Array.from({ length: rows }, () => Array<string | null>(columns).fill(color))
  const stampOf = (colors: (string | null)[][], top = 0, left = 0, lands: (row: number, column: number) => boolean = () => true) => ({ colors, top, left, rows: colors.length, columns: colors[0]!.length, lands })
  const calls = (made: { args: unknown[] }[]) => made.map((call) => call.args)
  const cellsOf = (stamp: ReturnType<typeof stampOf>) =>
    stamp.colors.flatMap((row, r) => row.flatMap((color, c) => (color && stamp.lands(stamp.top + r, stamp.left + c) ? [{ row: stamp.top + r, column: stamp.left + c, color }] : [])))

  it('draws no more of a 300 × 300 paste preview than the beads on screen', () => {
    const project = canvas()
    const { context, named } = recordingContext()

    renderOverlay(context, { project, space: spaceOf(project, true), region: window, zoom: 1, preview: { cells: [], stamp: stampOf(block(300, 300)), color: null } })

    expect(named('fillRect').length).toBeGreaterThan(0)
    expect(named('fillRect').length).toBeLessThanOrEqual(ON_SCREEN)
  })

  it('draws no more of a 300 × 300 paste preview on a Frame than the Frame\'s beads on screen', () => {
    const base = projectOf('loom', 300, 300, { marks: false })
    const project: Project = withLayers(base, { frame: { ...frameOf(base)!, row: 2, column: 3 } })
    const { context, named } = recordingContext()

    renderOverlay(context, { project, space: spaceOf(project, true), region: window, zoom: 1, preview: { cells: [], stamp: stampOf(block(300, 300), 2, 3), color: null } })

    expect(calls(named('translate'))).toEqual([[60, 40]])
    expect(named('fillRect').length).toBeGreaterThan(0)
    expect(named('fillRect').length).toBeLessThanOrEqual(ON_SCREEN)
  })

  it('draws a 300 × 300 paste preview zoomed out as one draft image, a pixel a bead at the preview\'s opacity', () => {
    const putImageData = vi.fn()
    const scratch = { createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }), putImageData }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(scratch as unknown as CanvasRenderingContext2D)
    const project = canvas()
    const { context, named } = recordingContext()

    renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 1900, height: 1200 }, zoom: 0.2, preview: { cells: [], stamp: stampOf(block(300, 300), 0, 0), color: null } })

    expect(named('fillRect')).toHaveLength(0)
    expect(named('drawImage').map((call) => [call.globalAlpha, ...call.args.slice(1)])).toEqual([[0.6, 0, 0, 300, 300, 0, 0, 6000, 6000]])
    expect(putImageData).toHaveBeenCalledTimes(1)
  })

  it('draws a stamp as the same preview its cells listed one by one make, on the Canvas and on a Frame in its own Weave', () => {
    const base = projectOf('loom', 3, 3, { marks: false })
    const framed: Project = withLayers(base, { frame: { ...frameOf(base)!, technique: 'peyote', row: 2, column: 3 } })
    const colors = [[RED, null, '#2f6fed', RED], [RED, RED, null, RED], ['#2f6fed', RED, RED, RED]]
    // The stamp runs off the Frame's right edge and down onto the Canvas below it; the Frame clips what it lands.
    const stamp = stampOf(colors, 3, 4, (row, column) => !(row === 3 && column === 6))
    for (const project of [canvas(), framed]) {
      const region = { x: 0, y: 0, width: 300, height: 300 }
      const stamped = recordingContext()
      const listed = recordingContext()

      renderOverlay(stamped.context, { project, space: spaceOf(project, true), region, zoom: 1, preview: { cells: [], stamp, color: null } })
      renderOverlay(listed.context, { project, space: spaceOf(project, true), region, zoom: 1, preview: { cells: cellsOf(stamp), color: null } })

      expect(stamped.calls.length).toBeGreaterThan(2)
      expect(stamped.calls).toEqual(listed.calls)
    }
  })

  it('leaves out what the next peyote row lies over with one clip a row, not one a bead, and one fill a color', () => {
    const project: Project = withLayers(canvas(), { technique: 'peyote' })
    const { context, named } = recordingContext()
    const colors = [[RED, RED, '#2f6fed', RED], [RED, RED, RED, RED], [RED, RED, RED, RED]]

    renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 300, height: 300 }, zoom: 1, preview: { cells: [], stamp: stampOf(colors), color: null } })

    expect(named('clip')).toHaveLength(3)
    expect(named('fill').map((call) => call.fillStyle)).toEqual([RED, '#2f6fed', RED, RED])
  })

  it('draws no more of a 300 × 300 Piece-shaped Selection\'s outline than the beads on screen', () => {
    const project = canvas()
    const cells = Array.from({ length: 300 * 300 }, (_, index) => ({ row: Math.floor(index / 300), column: index % 300 }))
    const { context, named } = recordingContext()

    renderOverlay(context, { project, space: spaceOf(project, true), region: { ...window, x: 10, y: 10 }, zoom: 1, selection: { top: 0, left: 0, rows: 300, columns: 300, cells } })

    expect(named('fillRect').length).toBeGreaterThan(0)
    expect(named('fillRect').length).toBeLessThanOrEqual(ON_SCREEN)
  })

  it('outlines a shape round its outside: each side of a bead that no bead of the shape lies across', () => {
    const project = canvas()
    const { context, named } = recordingContext()
    const cells = [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 0 }]

    renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 300, height: 300 }, zoom: 1, selection: { top: 0, left: 0, rows: 2, columns: 2, cells } })

    const sides = named('fillRect').map((call) => (call.args as number[]).join(' ')).sort()
    expect(sides).toEqual(['0 0 2 20', '0 0 20 2', '0 20 2 20', '0 38 20 2', '18 20 2 20', '20 0 20 2', '20 18 20 2', '38 0 2 20'].sort())
  })

  it('outlines a shape on the Frame inside the Frame\'s layer, in its own Weave', () => {
    const base = projectOf('loom', 3, 3, { marks: false })
    const project: Project = withLayers(base, { frame: { ...frameOf(base)!, technique: 'peyote', row: 2, column: 3 } })
    const { context, calls } = recordingContext()

    renderOverlay(context, { project, space: spaceOf(project, true), region: { x: 0, y: 0, width: 300, height: 300 }, zoom: 1, selection: { top: 3, left: 3, rows: 1, columns: 1, layer: 'frame', cells: [{ row: 3, column: 3 }] } })

    expect(calls.find((call) => call.name === 'translate')?.args).toEqual([60, 40])
    expect(calls.filter((call) => call.name === 'fillRect')[0]?.args).toEqual([10, 15, 20, 2])
  })
})

describe('the overlay of a Frame in a Bead of its own (ticket 0665)', () => {
  it('draws the Frame\'s layer from its corner at its Bead\'s size over the Canvas\'s, and unscaled on its own', () => {
    const base = projectOf('loom', 3, 3, { currentRow: 1 })
    const project = replaceBead(withLayers(base, { frame: { ...frameOf(base)!, row: 2, column: 3 } }), findBead('toho/round/15-0')!)
    const draw = (open: boolean) => {
      const { context, named } = recordingContext()
      renderOverlay(context, { project, space: spaceOf(project, open), region: { x: 0, y: 0, width: 300, height: 300 }, zoom: 1 })
      return named
    }
    const scale = 1 / findBead('toho/cube/1.5mm')!.widthMm
    expect(draw(true)('translate').map(({ args }) => args)).toEqual([[60, 40]])
    expect(draw(true)('scale').map(({ args }) => args)).toEqual([[scale, scale]])
    expect(draw(false)('scale')).toEqual([])
  })
})
