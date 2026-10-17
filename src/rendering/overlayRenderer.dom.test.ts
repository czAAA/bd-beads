import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import { createProject, withFrameGrid, type Project, type RowProgress, type Technique } from '../domain/project'
import type { Frame } from '../domain/canvas'
import { withMargin } from '../domain/margin'
import { beadRoundness, blendOver, DEFAULT_THEME, fadeOver } from './beadLook'
import { recordingContext } from '../testUtils/recordingContext'
import { renderOverlay as renderOverlayWith } from './overlayRenderer'
import { spaceOf } from './space'
import { CELL_SIZE_PX, displayedExtentPx, surfaceView } from './surfaceView'

/** The rings round the current beads (ticket 375): the rounded rectangles of the first stroked path. */
function ringRects(calls: ReturnType<typeof recordingContext>['calls']): ReturnType<typeof recordingContext>['calls'] {
  const stroke = calls.findIndex((call) => call.name === 'stroke')
  const begin = calls.slice(0, stroke).map((call) => call.name).lastIndexOf('beginPath')
  return calls.slice(begin, stroke).filter((call) => call.name === 'roundRect')
}

/** A test Project that draws no Row progress says `marks: false` on its Row progress; the wrapper below hands that to the renderer as `rowMarks`, as an export does. */
type TestRowProgress = RowProgress & { marks?: boolean }

function renderOverlay(context: Parameters<typeof renderOverlayWith>[0], input: Parameters<typeof renderOverlayWith>[1]): void {
  renderOverlayWith(context, { rowMarks: (input.project.rowProgress as TestRowProgress).marks !== false, ...input })
}

/** A Project whose whole Frame holds beads, since only a cell with a bead is marked (ticket 411). */
function projectOf(technique: Technique, columns: number, rows: number, rowProgress: Partial<TestRowProgress>, rotation: Rotation = 0, filled = true): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  const beads: Project['beads'] = {}
  for (let row = 0; filled && row < rows; row += 1) {
    beads[row] = Object.fromEntries(Array.from({ length: columns }, (_, column) => [column, '#e63746']))
  }
  return { ...project, beads, rotation, rowProgress: { direction: 'rows', currentRow: 0, currentColumn: 0, ...rowProgress } }
}

function whole(project: Project, zoom = 1) {
  const { width, height } = displayedExtentPx(project.technique, project.frame!.columns, project.frame!.rows, zoom, project.rotation)
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
      const project = projectOf('peyote', 5, 3, { currentRow: 0 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(ringRects(calls).map((call) => call.args[4])).toEqual([R, R, R, R, R])
    })

    it('marks only the cells that hold a bead: an empty cell gets no ring and no lift (ticket 411)', () => {
      const project = { ...projectOf('loom', 3, 3, { currentRow: 1 }), beads: { 1: { 0: '#e63746', 2: '#e63746' } } }
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

      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([['#e63746', 0.6, 41, 21, 18, 18]])
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
      const project = projectOf('peyote', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: null } })

      // Row 1: half a bead across (10) and 15px down; the color goes inside the 1px rim.
      const outline = named('roundRect').map((call) => call.args as number[])
      expect(outline.map((args) => args.slice(0, 4))).toEqual([[31, 16, 18, 18], [33, 18, 14, 14]])
      // Rounded at 22% of the bead less its gap, and 2px less inside.
      expect(outline[0]![4]).toBeCloseTo(3.4)
      expect(outline[1]![4]).toBeCloseTo(1.4)
    })

    it('fills a peyote bead\'s own rounded shape, leaving out what the next row\'s beads lie over', () => {
      const project = projectOf('peyote', 4, 3, noProgress)
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' } })

      expect(named('fillRect')).toHaveLength(0)
      // Row 2 sits 15px lower and half a bead back: its beads at x = 21 and 41 (the bead is at 31), under the bead's own 1px gap.
      const cutOuts = named('roundRect').map((call) => (call.args as number[]).slice(0, 4))
      expect(cutOuts).toEqual([[21, 31, 18, 18], [41, 31, 18, 18], [31, 16, 18, 18]])
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
      expect(cutOuts).toEqual([[61, 31], [71, 16]])
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

  describe('Mirror\'s axis lines', () => {
    const noProgress = { marks: false }

    it('draws a line for each axis of a direction, across the whole Project, super-thin and faint', () => {
      const project = projectOf('loom', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, mirrorAxisCounts: { columns: 2, rows: 0 } })

      // 200px wide, two axes: a third and two thirds of the way across, 2px wide and 120px tall.
      const lines = named('fillRect')
      expect(lines).toHaveLength(2)
      expect(lines[0]!.args[0]).toBeCloseTo(200 / 3 - 1)
      expect(lines[1]!.args[0]).toBeCloseTo((200 * 2) / 3 - 1)
      expect(lines.map((call) => call.args.slice(1))).toEqual([[0, 2, 120], [0, 2, 120]])
      expect(lines.every((call) => call.globalAlpha === 0.65 && call.fillStyle === DEFAULT_THEME.marker)).toBe(true)
      expect(context.globalAlpha).toBe(1)
    })

    it('draws the other direction across the Project\'s height', () => {
      const project = projectOf('loom', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, mirrorAxisCounts: { columns: 0, rows: 1 } })

      expect(named('fillRect').map((call) => call.args)).toEqual([[0, 59, 200, 2]])
    })

    it('measures peyote\'s width with its half-bead shift and its packed height', () => {
      const project = projectOf('peyote', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, mirrorAxisCounts: { columns: 1, rows: 1 } })

      // 210 wide (10 beads and the shift) and 20 + 5 × 15 = 95 tall.
      expect(named('fillRect').map((call) => call.args)).toEqual([[104, 0, 2, 95], [0, 46.5, 210, 2]])
    })

    it('measures brick stitch by its rows a bead apart, and draws the same number of lines in every Technique', () => {
      for (const technique of ['loom', 'peyote', 'brick'] as const) {
        const project = projectOf(technique, 10, 6, noProgress)
        const { context, named } = recordingContext()

        renderOverlay(context, { project, region: whole(project), zoom: 1, mirrorAxisCounts: { columns: 2, rows: 1 } })

        const lines = named('fillRect')
        expect(lines).toHaveLength(3)
        // Two lines run the Project's whole height, and one its whole width.
        const height = technique === 'loom' ? 120 : technique === 'peyote' ? 95 : 120
        expect(lines.filter((call) => call.args[3] === height)).toHaveLength(2)
      }
    })

    it('draws nothing while no direction has an axis', () => {
      const project = projectOf('loom', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, mirrorAxisCounts: { columns: 0, rows: 0 } })

      expect(named('fillRect')).toHaveLength(0)
    })

    it('is drawn over everything else, the marker included', () => {
      const project = projectOf('loom', 10, 6, { currentRow: 2 })
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, mirrorAxisCounts: { columns: 1, rows: 0 } })

      const alphas = named('fillRect').map((call) => call.globalAlpha)
      expect(alphas.at(-1)).toBe(0.65)
      expect(alphas.slice(0, -1).every((alpha) => alpha === 1)).toBe(true)
    })
  })

  describe('the beads a hovered "Mirror current" button would overwrite', () => {
    const noProgress = { marks: false }

    it('draws each faded over the paper, in its own color, covering the bead underneath', () => {
      const grid = [[{ color: '#e63746' }, { color: null }], [{ color: '#2f6fed' }, { color: '#1a1a1a' }]]
      const project = withFrameGrid(projectOf('loom', 2, 2, noProgress), grid)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, dimmedCells: [{ row: 0, column: 0 }, { row: 1, column: 1 }] })

      // The bead's own color at 50% over the board, its faint rim over that: opaque, so it covers what it is over.
      const red = fadeOver('#e63746', DEFAULT_THEME.background, 0.5)
      const black = fadeOver('#1a1a1a', DEFAULT_THEME.background, 0.5)
      expect(red).toBe(fadeOver('#e63746', DEFAULT_THEME.background, 0.5))
      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([
        [blendOver(DEFAULT_THEME.rim!, red), 1, 0.5, 0.5, 19, 19],
        [red, 1, 1.25, 1.25, 17.5, 17.5],
        [blendOver(DEFAULT_THEME.rim!, black), 1, 20.5, 20.5, 19, 19],
        [black, 1, 21.25, 21.25, 17.5, 17.5],
      ])
    })

    it('draws an empty bead faded in the empty tint', () => {
      const project = projectOf('loom', 2, 2, noProgress, 0, false)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, dimmedCells: [{ row: 0, column: 0 }] })

      expect(named('fillRect')[1]!.fillStyle).toBe(fadeOver(DEFAULT_THEME.emptyBead, DEFAULT_THEME.background, 0.5))
    })

    it('draws only the beads named, on screen and in the Project', () => {
      const project = projectOf('loom', 250, 250, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        project,
        region: { x: 0, y: 0, width: 100, height: 60 },
        zoom: 1,
        dimmedCells: [{ row: 0, column: 0 }, { row: 200, column: 0 }, { row: 999, column: 0 }, { row: 0, column: -3 }],
      })

      expect(named('fillRect')).toHaveLength(2)
    })

    it('is drawn under the Selection\'s border', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        project,
        region: whole(project),
        zoom: 1,
        selection: { top: 0, left: 0, rows: 1, columns: 1 },
        dimmedCells: [{ row: 0, column: 0 }],
      })

      const rects = named('fillRect')
      expect(rects[0]!.args).toEqual([0.5, 0.5, 19, 19])
      expect(rects.at(-4)!.args).toEqual([0, 0, 20, 2])
    })
  })
})

describe('the bead-shaped pointer (ticket 353)', () => {
  const noProgress = { marks: false }

  it('is 90% of a bead as drawn less 1px, centred on the pointer, in the chosen color at 60%', () => {
    const project = projectOf('loom', 8, 8, noProgress)
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project, 2), zoom: 2, pointer: { x: 50, y: 40, color: '#e63746' } })

    expect(named('setTransform').at(-1)!.args).toEqual([1, 0, 0, 1, 0, 0])
    expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([['#e63746', 0.6, 32.5, 22.5, 35, 35]])
  })

  it('scales with the pixel ratio and shows at every zoom', () => {
    const project = projectOf('loom', 8, 8, noProgress)
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project, 0.5), zoom: 0.5, pixelRatio: 2, pointer: { x: 10, y: 10, color: '#e63746' } })

    expect(named('setTransform').at(-1)!.args).toEqual([2, 0, 0, 2, 0, 0])
    expect(named('fillRect')[0]!.args).toEqual([6, 6, 8, 8])
  })

  it('is a 2px dark outline when there is no color', () => {
    const project = projectOf('loom', 8, 8, noProgress)
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1, pointer: { x: 30, y: 30, color: null } })

    expect(named('fill')).toHaveLength(1)
    expect(named('fill')[0]!.fillStyle).toBe(DEFAULT_THEME.outline)
    expect(named('fill')[0]!.args).toEqual(['evenodd'])
    expect(named('fillRect')).toHaveLength(0)
  })

  it('is rounded in peyote and square otherwise', () => {
    const peyote = projectOf('peyote', 8, 8, noProgress)
    const rounded = recordingContext()
    renderOverlay(rounded.context, { project: peyote, region: whole(peyote), zoom: 1, pointer: { x: 30, y: 30, color: '#e63746' } })
    expect(rounded.named('fillRect')).toHaveLength(0)
    expect(rounded.named('roundRect')[0]!.args.slice(2)).toEqual([17, 17, beadRoundness('peyote') * 17])

    const loom = projectOf('loom', 8, 8, noProgress)
    const square = recordingContext()
    renderOverlay(square.context, { project: loom, region: whole(loom), zoom: 1, pointer: { x: 30, y: 30, color: '#e63746' } })
    expect(square.named('fillRect')).toHaveLength(1)
  })
})

describe('the bead-shaped pointer on a rotated Project (ticket 353)', () => {
  it('stays upright in the surface\'s own px: the Project turns under it, the marker does not', () => {
    const project = projectOf('loom', 8, 8, { marks: false }, 90)
    const upright = recordingContext()
    const turned = recordingContext()

    renderOverlay(upright.context, { project: { ...project, rotation: 0 }, region: whole(project), zoom: 1, pointer: { x: 30, y: 30, color: '#e63746' } })
    renderOverlay(turned.context, { project, region: whole(project), zoom: 1, pointer: { x: 30, y: 30, color: '#e63746' } })

    expect(turned.named('fillRect').map((call) => call.args)).toEqual(upright.named('fillRect').map((call) => call.args))
  })
})

describe('the bead cursor (ticket 159)', () => {
  it('rings the bead 2px outside it in the focus-ring color, drawn over everything else', () => {
    const project = projectOf('loom', 4, 3, { direction: 'rows', currentRow: 1, currentColumn: 0 })
    const { context, calls } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1, cursor: { row: 1, column: 2 } })

    const fills = calls.filter((call) => call.name === 'fill')
    expect(fills.at(-1)!.fillStyle).toBe(DEFAULT_THEME.cursor)
    // Bead (2, 1) stands at x 40.5, y 20.5, 19 across; the ring's inside is 2px out from it, and 2px wide.
    const rects = calls.filter((call) => call.name === 'roundRect').slice(-2).map((call) => (call.args as number[]).slice(0, 4))
    expect(rects).toEqual([
      [36.5, 16.5, 27, 27],
      [38.5, 18.5, 23, 23],
    ])
  })

  it('draws nothing without a cursor', () => {
    const project = projectOf('loom', 4, 3, { marks: false })
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1 })

    expect(named('fill')).toHaveLength(0)
  })

  describe('the Frame margin outline (ticket 276)', () => {
    const framed = { ...projectOf('loom', 4, 4, { marks: false }), frame: { row: 5, column: 5, rows: 4, columns: 4 } }

    it('strokes a dashed 1px outline round the margin at the given opacity', () => {
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project: framed, region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 2, marginOutline: 0.5 })

      expect(named('setLineDash')[0]!.args[0]).toEqual([2, 1.5])
      const stroke = calls.find((call) => call.name === 'stroke')!
      expect(stroke.globalAlpha).toBe(0.5)
    })

    // The margin's cells come from `withMargin`; the sizes are worked out here from the bead geometry (CELL_SIZE_PX 20), not from `projectExtentPx`.
    const outline = (technique: Technique, frame: Frame) => {
      const project = { ...projectOf(technique, 4, 4, { marks: false }), frame }
      const { context, calls } = recordingContext()
      renderOverlay(context, { project, region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 1, marginOutline: 1 })
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

      renderOverlay(context, { project: framed, region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 1, marginOutline: 0 })

      expect(calls.some((call) => call.name === 'stroke')).toBe(false)
    })
  })
})

describe('on the Canvas (ADR 0026)', () => {
  /** A 3-wide, 4-tall Frame at row 6, column 5: positions are the bead's own row and column, so the Frame is not at the origin. */
  function openProject(rowProgress: Partial<TestRowProgress>): Project {
    const project = projectOf('loom', 3, 4, rowProgress, 0, false)
    const beads: Project['beads'] = {}
    for (let row = 6; row < 10; row += 1) {
      beads[row] = { 5: '#e63746', 6: '#e63746', 7: '#e63746' }
    }
    return { ...project, beads, frame: { row: 6, column: 5, rows: 4, columns: 3 } }
  }
  const view = { x: 0, y: 0, width: 400, height: 400 }
  const overlay = (project: Project, extra: Parameters<typeof renderOverlay>[1] extends infer Input ? Partial<Input> : never) => {
    const recorded = recordingContext()
    renderOverlay(recorded.context, { project, space: spaceOf(project, true), region: view, zoom: 1, ...extra })
    return recorded
  }

  it('rings the beads of the Frame\'s row, wherever the Frame is', () => {
    const { calls } = overlay(openProject({ currentRow: 1 }), {})

    // Frame row 1 is row 7: y 140, and x 100 to 160.
    expect(ringRects(calls).map((call) => call.args.slice(0, 2))).toEqual([[101, 141], [121, 141], [141, 141]])
  })

  it('draws no Row progress marker with no Frame', () => {
    const project = { ...openProject({ currentRow: 1 }), frame: undefined }

    expect(overlay(project, {}).named('stroke')).toEqual([])
  })

  it('borders a Selection that reaches outside the Frame and into the negative', () => {
    const { named } = overlay(openProject({ marks: false }), { selection: { top: -1, left: -1, rows: 1, columns: 2 } })

    expect(named('fillRect')[0]!.args).toEqual([-20, -20, 40, 2])
  })

  it('shows the hover preview on any bead, Frame or not', () => {
    const { named } = overlay(openProject({ marks: false }), { preview: { cells: [{ row: 8, column: 7 }, { row: -2, column: -3 }], color: '#e63746' } })

    expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([
      ['#e63746', 0.6, 141, 161, 18, 18],
      ['#e63746', 0.6, -59, -39, 18, 18],
    ])
  })

  it('rings the keyboard cursor on the bead at its own row and column', () => {
    const { calls } = overlay(openProject({ marks: false }), { cursor: { row: 7, column: 6 } })

    const rects = calls.filter((call) => call.name === 'roundRect').slice(-2).map((call) => (call.args as number[]).slice(0, 4))
    expect(rects).toEqual([
      [116.5, 136.5, 27, 27],
      [118.5, 138.5, 23, 23],
    ])
  })
})

describe('on its own, in a Project whose first row is odd (regression)', () => {
  it('shifts the Row progress marker by the bead\'s own row, as the editor does', () => {
    const project = projectOf('peyote', 2, 3, { currentRow: 0 })
    // No Frame and beads from row 1 on: the Frame the Project makes for itself starts on an odd row.
    const odd: Project = { ...project, frame: undefined, beads: { 1: { 0: '#e63746' }, 2: { 0: '#e63746' }, 3: { 0: '#e63746' } } }
    const { calls } = (() => {
      const recorded = recordingContext()
      renderOverlay(recorded.context, { project: odd, space: spaceOf(odd, false), region: { x: 0, y: 0, width: 80, height: 80 }, zoom: 1 })
      return recorded
    })()

    // The first row is row 1 of the Project: shifted half a bead, so its first bead's ring starts at x 11 (10 and the half stroke) and not at 0.
    expect(ringRects(calls)[0]!.args[0]).toBe(11)
  })
})
