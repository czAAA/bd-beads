import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rotation } from '../domain/grid'
import { createPattern, withFrameGrid, type Pattern, type RowProgress, type Technique } from '../domain/pattern'
import { blendOver, DEFAULT_THEME, fadeOver } from './beadLook'
import { recordingContext } from '../testUtils/recordingContext'
import { renderOverlay } from './overlayRenderer'
import { displayedExtentPx } from './patternRenderer'

function patternOf(technique: Technique, columns: number, rows: number, rowProgress: Partial<RowProgress>, rotation: Rotation = 0): Pattern {
  const pattern = createPattern({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  return { ...pattern, rotation, rowProgress: { enabled: true, direction: 'rows', currentRow: 0, currentColumn: 0, ...rowProgress } }
}

function whole(pattern: Pattern, zoom = 1) {
  const { width, height } = displayedExtentPx(pattern.technique, pattern.frame!.columns, pattern.frame!.rows, zoom, pattern.rotation)
  return { x: 0, y: 0, width, height }
}

describe('renderOverlay', () => {
  it('clears the layer, and draws nothing else while Row progress is off', () => {
    const pattern = patternOf('loom', 4, 4, { enabled: false })
    const { context, calls } = recordingContext()

    renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })

    expect(calls.map((call) => call.name)).toEqual(['setTransform', 'clearRect'])
  })

  it('clears the whole backing store, at the pixel ratio', () => {
    const pattern = patternOf('loom', 4, 3, { enabled: false })
    const { context, named } = recordingContext()

    renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, pixelRatio: 2 })

    expect(named('clearRect')[0]!.args).toEqual([0, 0, 160, 120])
  })

  describe('the row being woven (rows along the grid\'s rows)', () => {
    it('outlines the row 3px outside it, 2px thick with rounded corners, kept inside the Pattern', () => {
      const pattern = patternOf('loom', 4, 5, { currentRow: 2 })
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })

      // Row 2 of a 4-wide loom: x 0..80, y 40..60; 3px out, but not past the Pattern's own left and right edges.
      expect(named('roundRect').map((call) => call.args)).toEqual([
        [0, 37, 80, 26, 5],
        [2, 39, 76, 22, 3],
      ])
      expect(named('fill').map((call) => [call.fillStyle, call.args[0]])).toEqual([[DEFAULT_THEME.marker, 'evenodd']])
    })

    it('follows a shifted row on peyote and brick stitch, and peyote\'s tighter packing', () => {
      const peyote = patternOf('peyote', 3, 4, { currentRow: 1 })
      const brick = patternOf('brick', 3, 4, { currentRow: 1 })

      const topLeft = (pattern: Pattern) => {
        const { context, named } = recordingContext()
        renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })
        return named('roundRect')[0]!.args.slice(0, 2)
      }

      // Row 1 is half a bead across in both; it starts 15px down in peyote and 21px in brick stitch; the outline 3px out.
      expect(topLeft(peyote)).toEqual([7, 12])
      expect(topLeft(brick)).toEqual([7, 18])
    })

    it('draws nothing for a row that is not there', () => {
      const pattern = patternOf('loom', 4, 4, { currentRow: 9 })
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })

      expect(named('fillRect')).toHaveLength(0)
      expect(named('fill')).toHaveLength(0)
    })
  })

  describe('the column being woven (rows down the grid\'s columns)', () => {
    it('draws loom\'s column as two long sides, closed at the first bead and the last', () => {
      const pattern = patternOf('loom', 4, 3, { direction: 'columns', currentColumn: 1 })
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })

      const rects = named('fillRect').map((call) => call.args)
      // Each bead: a 22px box a pixel out from the bead, with its left and right 2px.
      expect(rects).toContainEqual([19, -1, 2, 22])
      expect(rects).toContainEqual([39, -1, 2, 22])
      expect(rects).toContainEqual([19, 39, 2, 22])
      // The top of the first row and the bottom of the last close the strip.
      expect(rects).toContainEqual([21, -1, 18, 2])
      expect(rects).toContainEqual([21, 59, 18, 2])
      // A middle row has sides only.
      expect(rects.filter((rect) => rect[1] === 19)).toHaveLength(2)
    })

    it('outlines each bead whole on peyote, rounded, and following the shifted rows', () => {
      const pattern = patternOf('peyote', 3, 2, { direction: 'columns', currentColumn: 1 })
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })

      const outers = named('roundRect').filter((call) => call.args[2] === 22)
      // Row 0 at x 20, row 1 (shifted half a bead) at x 30 and 15px down; each a pixel out.
      expect(outers.map((call) => call.args.slice(0, 2))).toEqual([[19, -1], [29, 14]])
      expect(outers[0]!.args[4]).toBeCloseTo(4.84)
      expect(named('fill').every((call) => call.args[0] === 'evenodd')).toBe(true)
    })

    it('outlines each bead whole on brick stitch, square, a seam apart', () => {
      const pattern = patternOf('brick', 3, 2, { direction: 'columns', currentColumn: 0 })
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })

      // Each bead is a 22px square outline (a top and a bottom strip 22px wide; the sides are shorter). Row 1 is half a
      // bead across and 21px down, a pixel out from its bead: the seam is between the rows, not inside the outline.
      const tops = named('fillRect').filter((call) => call.args[2] === 22).map((call) => call.args.slice(0, 2))
      expect(tops).toEqual([[-1, -1], [-1, 19], [9, 20], [9, 40]])
    })
  })

  it('draws through the same transform as the cells: zoom and a quarter turn', () => {
    const pattern = patternOf('loom', 3, 2, { currentRow: 0 }, 90)
    const { context, named } = recordingContext()

    renderOverlay(context, { pattern, region: whole(pattern, 2), zoom: 2 })

    // The same matrix renderPattern sets for this Pattern, so the marker lands on its own bead.
    expect(named('setTransform').at(-1)!.args).toEqual([0, 2, -2, 0, 80, -0])
  })

  describe('the hover preview', () => {
    const noProgress = { enabled: false }

    it('shows the paint color faintly on the bead, inside its rim', () => {
      const pattern = patternOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, preview: { cells: [{ row: 1, column: 2 }], color: '#e63746' } })

      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([['#e63746', 0.6, 41, 21, 18, 18]])
      expect(context.globalAlpha).toBe(1)
    })

    it('shows each bead of a block in its own color, where it has one', () => {
      const pattern = patternOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        pattern,
        region: whole(pattern),
        zoom: 1,
        preview: { cells: [{ row: 0, column: 0, color: '#2f6fed' }, { row: 0, column: 1 }], color: '#e63746' },
      })

      expect(named('fillRect').map((call) => call.fillStyle)).toEqual(['#2f6fed', '#e63746'])
    })

    it('outlines the bead in the dark ink when there is no color to show', () => {
      const pattern = patternOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, preview: { cells: [{ row: 0, column: 0 }], color: null } })

      expect(named('fill')).toHaveLength(1)
      expect(named('fill')[0]!.fillStyle).toBe(DEFAULT_THEME.outline)
      expect(named('fill')[0]!.args).toEqual(['evenodd'])
      expect(named('fillRect')).toHaveLength(0)
    })

    it('follows a shifted row and the Technique\'s packing, and rounds a peyote outline', () => {
      const pattern = patternOf('peyote', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' } })
      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: null } })

      // Row 1: half a bead across (10) and 15px down; the color goes inside the 1px rim.
      expect(named('fillRect')[0]!.args).toEqual([31, 16, 18, 18])
      const outline = named('roundRect').map((call) => call.args as number[])
      expect(outline.map((args) => args.slice(0, 4))).toEqual([[31, 16, 18, 18], [33, 18, 14, 14]])
      // Rounded at 22% of the bead less its gap, and 2px less inside.
      expect(outline[0]![4]).toBeCloseTo(3.4)
      expect(outline[1]![4]).toBeCloseTo(1.4)
    })

    it('leaves out a bead that is not in the Pattern', () => {
      const pattern = patternOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, preview: { cells: [{ row: 5, column: 0 }, { row: 0, column: -1 }, { row: 0, column: 4 }], color: '#e63746' } })

      expect(named('fillRect')).toHaveLength(0)
    })

    it('is drawn under the Row progress marker, which is lifted above the beads', () => {
      const pattern = patternOf('loom', 4, 3, { currentRow: 1 })
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' } })

      const styles = named('fillRect').map((call) => call.fillStyle)
      expect(styles[0]).toBe('#e63746')
      expect(styles.slice(1).every((style) => style === DEFAULT_THEME.marker)).toBe(true)
    })

    it('clears the layer when it is gone, so a hover leaves nothing behind', () => {
      const pattern = patternOf('loom', 4, 3, noProgress)
      const { context, calls } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, preview: { cells: [], color: '#e63746' } })

      expect(calls.some((call) => call.name === 'clearRect')).toBe(true)
      expect(calls.some((call) => call.name === 'fillRect')).toBe(false)
    })
  })

  describe('the Selection', () => {
    const noProgress = { enabled: false }
    const selected = { top: 1, left: 1, rows: 3, columns: 4 }

    it('washes each selected bead inside its rim, faintly, on loom and brick stitch', () => {
      const pattern = patternOf('loom', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, selection: selected })

      const washes = named('fillRect').filter((call) => call.globalAlpha === 0.3)
      expect(washes).toHaveLength(12)
      expect(washes[0]!.args).toEqual([21, 21, 18, 18])
      expect(washes.every((call) => call.fillStyle === DEFAULT_THEME.marker)).toBe(true)
      expect(context.globalAlpha).toBe(1)
    })

    it('outlines the rectangle: the edge beads carry a 2px strip on the sides that are its edge, and inside beads carry none', () => {
      const pattern = patternOf('loom', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, selection: selected })

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
      const brick = patternOf('brick', 6, 5, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern: brick, region: whole(brick), zoom: 1, selection: { top: 1, left: 0, rows: 2, columns: 2 } })

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
        const pattern = patternOf('peyote', 6, 5, noProgress)
        const { context, named } = recordingContext()

        renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, selection: selected })

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
      const pattern = patternOf('loom', 250, 250, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        pattern,
        region: { x: 0, y: 0, width: 100, height: 60 },
        zoom: 1,
        selection: { top: 0, left: 0, rows: 250, columns: 250 },
      })

      // 100 × 60 px is 5 × 3 beads (with the one that reaches the edge, 6 × 4).
      expect(named('fillRect').filter((call) => call.globalAlpha === 0.3).length).toBeLessThan(30)
    })

    it('clips a Selection that reaches past the Pattern', () => {
      const pattern = patternOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, selection: { top: 1, left: 2, rows: 9, columns: 9 } })

      expect(named('fillRect').filter((call) => call.globalAlpha === 0.3)).toHaveLength(4)
    })

    it('is drawn under the hover preview and the Row progress marker', () => {
      const pattern = patternOf('loom', 6, 5, { currentRow: 2 })
      const { context, calls } = recordingContext()

      renderOverlay(context, {
        pattern,
        region: whole(pattern),
        zoom: 1,
        selection: selected,
        preview: { cells: [{ row: 1, column: 1 }], color: '#e63746' },
      })

      const order = calls
        .filter((call) => call.name === 'fillRect' || (call.name === 'fill' && call.fillStyle === DEFAULT_THEME.marker && call.globalAlpha === 1))
        .map((call) => (call.name === 'fill' ? 'marker' : call.fillStyle === '#e63746' ? 'preview' : call.globalAlpha === 0.3 ? 'wash' : 'outline'))
      expect(order.indexOf('wash')).toBeLessThan(order.indexOf('outline'))
      expect(order.indexOf('outline')).toBeLessThan(order.indexOf('preview'))
      expect(order.indexOf('preview')).toBeLessThan(order.indexOf('marker'))
    })
  })

  describe('Mirror\'s axis lines', () => {
    const noProgress = { enabled: false }

    it('draws a line for each axis of a direction, across the whole Pattern, super-thin and faint', () => {
      const pattern = patternOf('loom', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, mirrorAxisCounts: { columns: 2, rows: 0 } })

      // 200px wide, two axes: a third and two thirds of the way across, 2px wide and 120px tall.
      const lines = named('fillRect')
      expect(lines).toHaveLength(2)
      expect(lines[0]!.args[0]).toBeCloseTo(200 / 3 - 1)
      expect(lines[1]!.args[0]).toBeCloseTo((200 * 2) / 3 - 1)
      expect(lines.map((call) => call.args.slice(1))).toEqual([[0, 2, 120], [0, 2, 120]])
      expect(lines.every((call) => call.globalAlpha === 0.65 && call.fillStyle === DEFAULT_THEME.marker)).toBe(true)
      expect(context.globalAlpha).toBe(1)
    })

    it('draws the other direction across the Pattern\'s height', () => {
      const pattern = patternOf('loom', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, mirrorAxisCounts: { columns: 0, rows: 1 } })

      expect(named('fillRect').map((call) => call.args)).toEqual([[0, 59, 200, 2]])
    })

    it('measures peyote\'s width with its half-bead shift and its packed height', () => {
      const pattern = patternOf('peyote', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, mirrorAxisCounts: { columns: 1, rows: 1 } })

      // 210 wide (10 beads and the shift) and 20 + 5 × 15 = 95 tall.
      expect(named('fillRect').map((call) => call.args)).toEqual([[104, 0, 2, 95], [0, 46.5, 210, 2]])
    })

    it('measures brick stitch by its rows a seam apart, and draws the same number of lines in every Technique', () => {
      for (const technique of ['loom', 'peyote', 'brick'] as const) {
        const pattern = patternOf(technique, 10, 6, noProgress)
        const { context, named } = recordingContext()

        renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, mirrorAxisCounts: { columns: 2, rows: 1 } })

        const lines = named('fillRect')
        expect(lines).toHaveLength(3)
        // Two lines run the Pattern's whole height, and one its whole width.
        const height = technique === 'loom' ? 120 : technique === 'peyote' ? 95 : 125
        expect(lines.filter((call) => call.args[3] === height)).toHaveLength(2)
      }
    })

    it('draws nothing while no direction has an axis', () => {
      const pattern = patternOf('loom', 10, 6, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, mirrorAxisCounts: { columns: 0, rows: 0 } })

      expect(named('fillRect')).toHaveLength(0)
    })

    it('is drawn over everything else, the marker included', () => {
      const pattern = patternOf('loom', 10, 6, { currentRow: 2 })
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, mirrorAxisCounts: { columns: 1, rows: 0 } })

      const alphas = named('fillRect').map((call) => call.globalAlpha)
      expect(alphas.at(-1)).toBe(0.65)
      expect(alphas.slice(0, -1).every((alpha) => alpha === 1)).toBe(true)
    })
  })

  describe('the beads a hovered "Mirror current" button would overwrite', () => {
    const noProgress = { enabled: false }

    it('draws each faded over the paper, in its own color, covering the bead underneath', () => {
      const grid = [[{ color: '#e63746' }, { color: null }], [{ color: '#2f6fed' }, { color: '#1a1a1a' }]]
      const pattern = withFrameGrid(patternOf('loom', 2, 2, noProgress), grid)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, dimmedCells: [{ row: 0, column: 0 }, { row: 1, column: 1 }] })

      // The bead's own color at 28% over the board, its faint rim over that: opaque, so it covers what it is over.
      const red = fadeOver('#e63746', DEFAULT_THEME.background, 0.28)
      const black = fadeOver('#1a1a1a', DEFAULT_THEME.background, 0.28)
      expect(red).toBe('rgb(231, 179, 180)')
      expect(named('fillRect').map((call) => [call.fillStyle, call.globalAlpha, ...call.args])).toEqual([
        [blendOver(DEFAULT_THEME.rim!, red), 1, 1, 1, 18, 18],
        [red, 1, 1.75, 1.75, 16.5, 16.5],
        [blendOver(DEFAULT_THEME.rim!, black), 1, 21, 21, 18, 18],
        [black, 1, 21.75, 21.75, 16.5, 16.5],
      ])
    })

    it('draws an empty bead faded in the empty tint', () => {
      const pattern = patternOf('loom', 2, 2, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, dimmedCells: [{ row: 0, column: 0 }] })

      expect(named('fillRect')[1]!.fillStyle).toBe(fadeOver(DEFAULT_THEME.emptyBead, DEFAULT_THEME.background, 0.28))
    })

    it('draws only the beads named, on screen and in the Pattern', () => {
      const pattern = patternOf('loom', 250, 250, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        pattern,
        region: { x: 0, y: 0, width: 100, height: 60 },
        zoom: 1,
        dimmedCells: [{ row: 0, column: 0 }, { row: 200, column: 0 }, { row: 999, column: 0 }, { row: 0, column: -3 }],
      })

      expect(named('fillRect')).toHaveLength(2)
    })

    it('is drawn under the Selection\'s wash', () => {
      const pattern = patternOf('loom', 4, 3, noProgress)
      const { context, named } = recordingContext()

      renderOverlay(context, {
        pattern,
        region: whole(pattern),
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
    const pattern = patternOf('loom', 4, 3, { enabled: true, direction: 'rows', currentRow: 1, currentColumn: 0 })
    const { context, calls } = recordingContext()

    renderOverlay(context, { pattern, region: whole(pattern), zoom: 1, cursor: { row: 1, column: 2 } })

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
    const pattern = patternOf('loom', 4, 3, { enabled: false })
    const { context, named } = recordingContext()

    renderOverlay(context, { pattern, region: whole(pattern), zoom: 1 })

    expect(named('fill')).toHaveLength(0)
  })
})
