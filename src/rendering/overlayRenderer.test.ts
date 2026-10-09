import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rotation } from '../domain/grid'
import { createProject, withFrameGrid, type Project, type RowProgress, type Technique } from '../domain/project'
import { beadRoundness, blendOver, DEFAULT_THEME, fadeOver } from './beadLook'
import { recordingContext } from '../testUtils/recordingContext'
import { renderOverlay } from './overlayRenderer'
import { spaceOf } from './space'
import { CELL_SIZE_PX, displayedExtentPx } from './surfaceView'

/** The line the Row progress marker strokes, as its path calls (ticket 369). */
function markerPath(calls: ReturnType<typeof recordingContext>['calls']): unknown[][] {
  return calls.filter((call) => call.name === 'moveTo' || call.name === 'lineTo' || call.name === 'arcTo').map((call) => [call.name, ...call.args])
}

function projectOf(technique: Technique, columns: number, rows: number, rowProgress: Partial<RowProgress>, rotation: Rotation = 0): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  return { ...project, rotation, rowProgress: { enabled: true, direction: 'rows', currentRow: 0, currentColumn: 0, ...rowProgress } }
}

function whole(project: Project, zoom = 1) {
  const { width, height } = displayedExtentPx(project.technique, project.frame!.columns, project.frame!.rows, zoom, project.rotation)
  return { x: 0, y: 0, width, height }
}

describe('renderOverlay', () => {
  it('clears the layer, and draws nothing else while Row progress is off', () => {
    const project = projectOf('loom', 4, 4, { enabled: false })
    const { context, calls } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1 })

    expect(calls.map((call) => call.name)).toEqual(['setTransform', 'clearRect'])
  })

  it('clears the whole backing store, at the pixel ratio', () => {
    const project = projectOf('loom', 4, 3, { enabled: false })
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1, pixelRatio: 2 })

    expect(named('clearRect')[0]!.args).toEqual([0, 0, 160, 120])
  })

  describe('the row being woven (rows along the grid\'s rows)', () => {
    it('strokes one 3px line along the bottom of the row, the side facing the next row to weave (ticket 352)', () => {
      const project = projectOf('loom', 4, 5, { currentRow: 2 })
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      // Row 2 of a 4-wide loom: x 0..80, y 40..60; the line sits on the seam below it.
      expect(markerPath(calls)).toEqual([['moveTo', 0, 60], ['lineTo', 80, 60]])
      expect(named('stroke')).toHaveLength(1)
      expect(named('fillRect')).toHaveLength(0)
    })

    it('keeps the last row\'s line inside the Project', () => {
      const project = projectOf('loom', 4, 5, { currentRow: 4 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(markerPath(calls)).toEqual([['moveTo', 0, 98.5], ['lineTo', 80, 98.5]])
    })

    it('follows a shifted row on brick stitch', () => {
      const brick = projectOf('brick', 3, 4, { currentRow: 1 })
      const { context, calls } = recordingContext()
      renderOverlay(context, { project: brick, region: whole(brick), zoom: 1 })

      // Row 1 is half a bead across and starts 21px down.
      expect(markerPath(calls)).toEqual([['moveTo', 10, 41], ['lineTo', 70, 41]])
    })

    it('follows each rounded bead\'s outline on peyote, one stroked border joined from bead to bead (ticket 369)', () => {
      const R = beadRoundness('peyote') * CELL_SIZE_PX + 1
      const border = (currentRow: number) => {
        const project = projectOf('peyote', 5, 3, { currentRow })
        const recorded = recordingContext()
        renderOverlay(recorded.context, { project, region: whole(project), zoom: 1 })
        return recorded
      }

      // Row 0 is one whole pass: every bead on its bottom edge (y 20), a curve of the bead's own corner radius at each end of each.
      const whole0 = border(0)
      expect(whole0.named('stroke')).toHaveLength(1)
      expect(whole0.named('fillRect')).toHaveLength(0)
      expect(whole0.named('moveTo')[0]!.args).toEqual([0, 20 - R])
      expect(whole0.named('arcTo')[0]!.args).toEqual([0, 20, 20, 20, R])
      expect(whole0.named('arcTo')).toHaveLength(10)

      // Row 1, first pass: bead 0 (half a bead across, y 15..35) on its bottom edge, bead 1 still to weave on its top edge (y 15), 20px higher.
      const first = border(1)
      expect(first.named('arcTo')[0]!.args).toEqual([10, 35, 30, 35, R])
      expect(first.named('arcTo')[2]!.args).toEqual([30, 15, 50, 15, R])
      // The step joins bead 0's end to bead 1's start.
      expect(first.named('lineTo').map((call) => call.args)).toContainEqual([30, 15 + R])

      // Second pass: the row is complete, so every bead is on its bottom edge again.
      expect(border(2).named('arcTo')[2]!.args).toEqual([30, 35, 50, 35, R])
    })

    it('keeps the outline of the last peyote row inside the Project (ticket 369)', () => {
      const R = beadRoundness('peyote') * CELL_SIZE_PX + 1
      const project = projectOf('peyote', 5, 3, { currentRow: 4 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      // Row 2 ends at y 50, the Project's own edge: the 3px line is drawn 1.5px in from it.
      expect(markerPath(calls)[0]).toEqual(['moveTo', 0, 48.5 - R])
      expect(markerPath(calls)[1]).toEqual(['arcTo', 0, 48.5, 20, 48.5, R])
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
    it('strokes one 3px line on the right of loom\'s column, the side facing the next column (ticket 352)', () => {
      const project = projectOf('loom', 4, 3, { direction: 'columns', currentColumn: 1 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      expect(markerPath(calls)).toEqual([['moveTo', 40, 0], ['lineTo', 40, 60]])
    })

    it('is one line with rounded turns across the shifted rows on peyote, a pass at a time (ticket 369)', () => {
      const border = (currentColumn: number) => {
        const project = projectOf('peyote', 3, 2, { direction: 'columns', currentColumn })
        const { context, calls } = recordingContext()
        renderOverlay(context, { project, region: whole(project), zoom: 1 })
        return markerPath(calls)
      }

      // Column 1 is woven in two passes (ticket 347): row 0's bead (right edge at x 40) is in the first; row 1's (shifted half a bead, 15px down)
      // is still to weave and keeps the line on its left edge at x 30. The turns across the seam between them (y 17.5) are rounded.
      expect(border(1)).toEqual([['moveTo', 40, 0], ['arcTo', 40, 17.5, 30, 17.5, 5], ['arcTo', 30, 17.5, 30, 35, 5], ['lineTo', 30, 35]])
      // Once both are woven, both are on their right edges (x 40 and 50).
      expect(border(2)).toEqual([['moveTo', 40, 0], ['arcTo', 40, 17.5, 50, 17.5, 5], ['arcTo', 50, 17.5, 50, 35, 5], ['lineTo', 50, 35]])
    })

    it('steps across the shifted rows on brick stitch, the turns rounded a little', () => {
      const project = projectOf('brick', 3, 2, { direction: 'columns', currentColumn: 0 })
      const { context, calls } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1 })

      // Row 1 is half a bead across and 21px down.
      expect(markerPath(calls)).toEqual([['moveTo', 20, 0], ['arcTo', 20, 20.5, 30, 20.5, 3], ['arcTo', 30, 20.5, 30, 41, 3], ['lineTo', 30, 41]])
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
    const noProgress = { enabled: false }

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

      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' } })
      renderOverlay(context, { project, region: whole(project), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: null } })

      // Row 1: half a bead across (10) and 15px down; the color goes inside the 1px rim.
      expect(named('fillRect')[0]!.args).toEqual([31, 16, 18, 18])
      const outline = named('roundRect').map((call) => call.args as number[])
      expect(outline.map((args) => args.slice(0, 4))).toEqual([[31, 16, 18, 18], [33, 18, 14, 14]])
      // Rounded at 22% of the bead less its gap, and 2px less inside.
      expect(outline[0]![4]).toBeCloseTo(3.4)
      expect(outline[1]![4]).toBeCloseTo(1.4)
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

      const styles = named('fillRect').map((call) => call.fillStyle)
      expect(styles[0]).toBe('#e63746')
      expect(styles.slice(1).every((style) => style === DEFAULT_THEME.marker)).toBe(true)
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
    const noProgress = { enabled: false }
    const selected = { top: 1, left: 1, rows: 3, columns: 4 }

    it('washes each selected bead inside its rim, faintly, on loom and brick stitch', () => {
      const project = projectOf('loom', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, selection: selected })

      const washes = named('fillRect').filter((call) => call.globalAlpha === 0.3)
      expect(washes).toHaveLength(12)
      expect(washes[0]!.args).toEqual([21, 21, 18, 18])
      expect(washes.every((call) => call.fillStyle === DEFAULT_THEME.marker)).toBe(true)
      expect(context.globalAlpha).toBe(1)
    })

    it('outlines the rectangle: the edge beads carry a 2px strip on the sides that are its edge, and inside beads carry none', () => {
      const project = projectOf('loom', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, selection: selected })

      const strips = named('fillRect').filter((call) => call.globalAlpha === 1).map((call) => call.args as number[])
      // The top-left bead (row 1, column 1) is at the corner: its top and its left.
      expect(strips).toContainEqual([21, 21, 18, 2])
      expect(strips).toContainEqual([21, 21, 2, 18])
      // A bead in the middle of the rectangle's top edge has only a top strip.
      expect(strips.filter((rect) => rect[0] === 41 && rect[1] === 21)).toEqual([[41, 21, 18, 2]])
      // The interior (row 2, columns 2 and 3) has none: nothing is drawn at (41, 41) or (61, 41).
      expect(strips.some((rect) => rect[0] >= 41 && rect[0] <= 61 && rect[1] >= 41 && rect[1] < 59)).toBe(false)
      // The far corner (row 3, column 4): a bottom and a right.
      expect(strips).toContainEqual([81, 77, 18, 2])
      expect(strips).toContainEqual([97, 61, 2, 18])
    })

    it('shifts with the Technique\'s rows, so the outline reads as one rectangle on peyote and brick stitch', () => {
      const brick = projectOf('brick', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project: brick, region: whole(brick), zoom: 1, selection: { top: 1, left: 0, rows: 2, columns: 2 } })

      // Row 1 is half a bead across and 21px down: its first bead's wash starts at (11, 22); row 2 is back at the left.
      const washes = named('fillRect').filter((call) => call.globalAlpha === 0.3).map((call) => call.args)
      expect(washes[0]).toEqual([11, 22, 18, 18])
      expect(washes[2]).toEqual([1, 43, 18, 18])
    })

    describe('on peyote', () => {
      afterEach(() => vi.restoreAllMocks())

      it('blits a rounded wash for each bead, and clips each edge bead\'s outline to its rounded inside', () => {
        const spriteContext = recordingContext()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(spriteContext.context as unknown as CanvasRenderingContext2D)
        const project = projectOf('peyote', 6, 5, noProgress)
        const { context, named } = recordingContext()

        renderOverlay(context, { project, region: whole(project), zoom: 1, selection: selected })

        expect(named('drawImage')).toHaveLength(12)
        expect(named('drawImage')[0]!.args.slice(1)).toEqual([31, 16, 18, 18])
        // The wash was made once, faintly, in the marker color.
        expect(spriteContext.named('roundRect')).toHaveLength(1)
        expect(spriteContext.named('fill')[0]!.fillStyle).toBe(DEFAULT_THEME.marker)
        expect(spriteContext.named('fill')[0]!.globalAlpha).toBe(0.3)
        // Each of the 10 beads on the edge is clipped to its rounded inside (22% of the bead, less the gap) before its strips.
        expect(named('clip')).toHaveLength(10)
        expect(named('roundRect')[0]!.args.slice(0, 4)).toEqual([31, 16, 18, 18])
        expect(named('roundRect')[0]!.args[4]).toBeCloseTo(3.4)
      })
    })

    it('draws only the beads on screen, however big the Selection is', () => {
      const project = projectOf('loom', 250, 250, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        project,
        region: { x: 0, y: 0, width: 100, height: 60 },
        zoom: 1,
        selection: { top: 0, left: 0, rows: 250, columns: 250 },
      })

      // 100 × 60 px is 5 × 3 beads (with the one that reaches the edge, 6 × 4).
      expect(named('fillRect').filter((call) => call.globalAlpha === 0.3).length).toBeLessThan(30)
    })

    it('clips a Selection that reaches past the Project', () => {
      const project = projectOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, selection: { top: 1, left: 2, rows: 9, columns: 9 } })

      expect(named('fillRect').filter((call) => call.globalAlpha === 0.3)).toHaveLength(4)
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
        .map((call) => (call.name === 'stroke' ? 'marker' : call.fillStyle === '#e63746' ? 'preview' : call.globalAlpha === 0.3 ? 'wash' : 'outline'))
      expect(order.indexOf('wash')).toBeLessThan(order.indexOf('outline'))
      expect(order.indexOf('outline')).toBeLessThan(order.indexOf('preview'))
      expect(order.indexOf('preview')).toBeLessThan(order.indexOf('marker'))
    })
  })

  describe('Mirror\'s axis lines', () => {
    const noProgress = { enabled: false }

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

    it('measures brick stitch by its rows a seam apart, and draws the same number of lines in every Technique', () => {
      for (const technique of ['loom', 'peyote', 'brick'] as const) {
        const project = projectOf(technique, 10, 6, noProgress)
        const { context, named } = recordingContext()

        renderOverlay(context, { project, region: whole(project), zoom: 1, mirrorAxisCounts: { columns: 2, rows: 1 } })

        const lines = named('fillRect')
        expect(lines).toHaveLength(3)
        // Two lines run the Project's whole height, and one its whole width.
        const height = technique === 'loom' ? 120 : technique === 'peyote' ? 95 : 125
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
    const noProgress = { enabled: false }

    it('draws each faded over the paper, in its own color, covering the bead underneath', () => {
      const grid = [[{ color: '#e63746' }, { color: null }], [{ color: '#2f6fed' }, { color: '#1a1a1a' }]]
      const project = withFrameGrid(projectOf('loom', 2, 2, noProgress), grid)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, dimmedCells: [{ row: 0, column: 0 }, { row: 1, column: 1 }] })

      // The bead's own color at 60% over the board, its faint rim over that: opaque, so it covers what it is over.
      const red = fadeOver('#e63746', DEFAULT_THEME.background, 0.6)
      const black = fadeOver('#1a1a1a', DEFAULT_THEME.background, 0.6)
      expect(red).toBe(fadeOver('#e63746', DEFAULT_THEME.background, 0.6))
      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([
        [blendOver(DEFAULT_THEME.rim!, red), 1, 1, 1, 18, 18],
        [red, 1, 1.75, 1.75, 16.5, 16.5],
        [blendOver(DEFAULT_THEME.rim!, black), 1, 21, 21, 18, 18],
        [black, 1, 21.75, 21.75, 16.5, 16.5],
      ])
    })

    it('draws an empty bead faded in the empty tint', () => {
      const project = projectOf('loom', 2, 2, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { project, region: whole(project), zoom: 1, dimmedCells: [{ row: 0, column: 0 }] })

      expect(named('fillRect')[1]!.fillStyle).toBe(fadeOver(DEFAULT_THEME.emptyBead, DEFAULT_THEME.background, 0.6))
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

    it('is drawn under the Selection\'s wash', () => {
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
      expect(rects[0]!.args).toEqual([1, 1, 18, 18])
      expect(rects.at(-5)!.globalAlpha).toBe(0.3)
    })
  })
})

describe('the bead cursor (ticket 159)', () => {
  it('rings the bead 2px outside it in the focus-ring color, drawn over everything else', () => {
    const project = projectOf('loom', 4, 3, { enabled: true, direction: 'rows', currentRow: 1, currentColumn: 0 })
    const { context, calls } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1, cursor: { row: 1, column: 2 } })

    const fills = calls.filter((call) => call.name === 'fill')
    expect(fills.at(-1)!.fillStyle).toBe(DEFAULT_THEME.cursor)
    // Bead (2, 1) stands at x 41, y 21, 18 across; the ring's inside is 2px out from it, and 2px wide.
    const rects = calls.filter((call) => call.name === 'roundRect').slice(-2).map((call) => (call.args as number[]).slice(0, 4))
    expect(rects).toEqual([
      [37, 17, 26, 26],
      [39, 19, 22, 22],
    ])
  })

  it('draws nothing without a cursor', () => {
    const project = projectOf('loom', 4, 3, { enabled: false })
    const { context, named } = recordingContext()

    renderOverlay(context, { project, region: whole(project), zoom: 1 })

    expect(named('fill')).toHaveLength(0)
  })

  describe('the Frame margin outline (ticket 276)', () => {
    const framed = { ...projectOf('loom', 4, 4, { enabled: false }), frame: { row: 5, column: 5, rows: 4, columns: 4 } }

    it('strokes a dashed 1px outline round the margin at the given opacity', () => {
      const { context, calls, named } = recordingContext()

      renderOverlay(context, { project: framed, region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 2, marginOutline: 0.5 })

      expect(named('setLineDash')[0]!.args[0]).toEqual([2, 1.5])
      const stroke = calls.find((call) => call.name === 'stroke')!
      expect(stroke.globalAlpha).toBe(0.5)
    })

    it('draws nothing while it is faded out', () => {
      const { context, calls } = recordingContext()

      renderOverlay(context, { project: framed, region: { x: 0, y: 0, width: 400, height: 400 }, zoom: 1, marginOutline: 0 })

      expect(calls.some((call) => call.name === 'stroke')).toBe(false)
    })
  })
})

describe('on the open canvas (ADR 0026)', () => {
  /** A 3-wide, 4-tall Frame at row 6, column 5: positions are the bead's own row and column, so the Frame is not at the origin. */
  function openProject(rowProgress: Partial<RowProgress>): Project {
    const project = projectOf('loom', 3, 4, rowProgress)
    return { ...project, frame: { row: 6, column: 5, rows: 4, columns: 3 } }
  }
  const view = { x: 0, y: 0, width: 400, height: 400 }
  const overlay = (project: Project, extra: Parameters<typeof renderOverlay>[1] extends infer Input ? Partial<Input> : never) => {
    const recorded = recordingContext()
    renderOverlay(recorded.context, { project, space: spaceOf(project, true), region: view, zoom: 1, ...extra })
    return recorded
  }

  it('draws the Row progress marker along the Frame\'s row, wherever the Frame is', () => {
    const { calls } = overlay(openProject({ currentRow: 1 }), {})

    // Frame row 1 is row 7: y 140, and x 100 to 160; the line across the seam below.
    expect(markerPath(calls)).toEqual([['moveTo', 100, 160], ['lineTo', 160, 160]])
  })

  it('draws no Row progress marker with no Frame', () => {
    const project = { ...openProject({ currentRow: 1 }), frame: undefined }

    expect(overlay(project, {}).named('stroke')).toEqual([])
  })

  it('washes a Selection that reaches outside the Frame and into the negative', () => {
    const { named } = overlay(openProject({ enabled: false }), { selection: { top: -1, left: -1, rows: 1, columns: 2 } })

    const washes = named('fillRect').filter((call) => call.globalAlpha === 0.3)
    expect(washes.map((call) => call.args)).toEqual([
      [-19, -19, 18, 18],
      [1, -19, 18, 18],
    ])
  })

  it('shows the hover preview on any bead, Frame or not', () => {
    const { named } = overlay(openProject({ enabled: false }), { preview: { cells: [{ row: 8, column: 7 }, { row: -2, column: -3 }], color: '#e63746' } })

    expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([
      ['#e63746', 0.6, 141, 161, 18, 18],
      ['#e63746', 0.6, -59, -39, 18, 18],
    ])
  })

  it('rings the keyboard cursor on the bead at its own row and column', () => {
    const { calls } = overlay(openProject({ enabled: false }), { cursor: { row: 7, column: 6 } })

    const rects = calls.filter((call) => call.name === 'roundRect').slice(-2).map((call) => (call.args as number[]).slice(0, 4))
    expect(rects).toEqual([
      [117, 137, 26, 26],
      [119, 139, 22, 22],
    ])
  })
})

describe('on its own, in a Project whose first row is odd (regression)', () => {
  it('shifts the Row progress marker by the bead\'s own row, as the editor does', () => {
    const project = projectOf('peyote', 2, 3, { currentRow: 0 })
    // No Frame and beads from row 1 on: the Frame the Project makes for itself starts on an odd row.
    const odd: Project = { ...project, frame: undefined, beads: { 1: { 0: '#e63746' }, 2: { 0: '#e63746' }, 3: { 0: '#e63746' } } }
    const { named } = (() => {
      const recorded = recordingContext()
      renderOverlay(recorded.context, { project: odd, space: spaceOf(odd, false), region: { x: 0, y: 0, width: 80, height: 80 }, zoom: 1 })
      return recorded
    })()

    // The first row is row 1 of the Project: shifted half a bead, so its first bead's edge starts at x 10 and not at 0.
    expect(named('moveTo')[0]!.args[0]).toBe(10)
  })
})
