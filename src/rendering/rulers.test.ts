import { describe, expect, it } from 'vitest'
import { withColors, type Rect } from '../domain/canvas'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { rulerLayout, type RulerDot, type RulerLabel } from './rulers'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'
import { flatProject } from '../testUtils/flatFields'
import { canvasOf } from '../domain/layerRecord'

const R = '#e63746'
interface Look {
  technique?: Technique
  rotation?: Rotation
  zoom?: number
  scroll?: { x: number; y: number }
  /** Left out, the surface is unmeasured and the numbers are not cut at any edge. */
  viewport?: { width: number; height: number }
  /** Put this box of beads in the middle of a 2000px viewport. */
  centred?: Rect
  numbers?: boolean
}

const block = (row: number, column: number, rows = 3, columns = 3): [number, number][] =>
  Array.from({ length: rows * columns }, (_, i) => [row + Math.floor(i / columns), column + (i % columns)])
const project = (positions: [number, number][], frame?: Rect, technique: Technique = 'loom') =>
  flatProject({
    technique,
    ...(frame ? { frame: { ...frame, technique, beads: {} } } : {}),
    beads: withColors({}, positions.map(([row, column]) => ({ row, column, color: R }))),
  })
/** The Ruler layout of a Project in a view of the Canvas. */
const layoutOf = (subject: ReturnType<typeof project>, { technique = canvasOf(subject).technique, rotation = 0, zoom = 1, scroll, viewport, centred, numbers = true }: Look = {}) => {
  const view = (at?: { x: number; y: number }, size = viewport) => surfaceView({ space: OPEN_SPACE, technique, rotation, zoom, scroll: at, viewport: size })
  // A turn carries the box off the top-left corner: centre it in a viewport that holds it, whichever way it is turned.
  const looking = centred ? view(undefined, { width: 2000, height: 2000 }) : undefined
  const surface = looking ? view(looking.scrollToCentre(centred), { width: 2000, height: 2000 }) : view(scroll)
  return rulerLayout(subject, surface, { fontPx: 11, numbers })
}
const framed = (frame: Rect, look: Look = {}) => layoutOf(project([], frame, look.technique), look)

describe('which boxes carry rulers', () => {
  it('is each piece, with only the start sides, until a Frame is set', () => {
    const { boxes } = layoutOf(project([...block(0, 0), ...block(10, 10)]))
    expect(boxes.map((box) => [box.kind, box.sides, box.outset])).toEqual([['piece', 'start', 5], ['piece', 'start', 5]])
  })

  it('leaves out a Piece area of 4 beads or fewer in total, and keeps one of 5 or more, whatever its shape', () => {
    const count = (positions: [number, number][]) => layoutOf(project(positions)).boxes.length
    expect(count([[0, 0]])).toBe(0)
    expect(count(block(0, 0, 2, 2))).toBe(0)
    expect(count(block(0, 0, 1, 4))).toBe(0)
    expect(count(block(0, 0, 1, 5))).toBe(1)
    expect(count(block(0, 0, 5, 1))).toBe(1)
    expect(count(block(0, 0, 2, 3))).toBe(1)
    expect(count(block(0, 0, 2, 9))).toBe(1)
    expect(count(block(0, 0, 3, 3))).toBe(1)
    expect(count(block(0, 0, 3, 8))).toBe(1)
  })

  it('measures joined Piece areas as the joined rectangle', () => {
    const { boxes } = layoutOf(project([[0, 0], [0, 2], [2, 0], [2, 2]]))
    expect(boxes.map(({ row, column, rows, columns }) => ({ row, column, rows, columns }))).toEqual([{ row: 0, column: 0, rows: 3, columns: 3 }])
  })

  it('is the Frame alone, on every side, once it is set, whatever pieces there are', () => {
    const { boxes } = layoutOf(project([...block(0, 0), ...block(10, 10)], { row: 2, column: 3, rows: 4, columns: 5 }))
    expect(boxes).toEqual([{ technique: 'loom', row: 2, column: 3, rows: 4, columns: 5, kind: 'frame', outset: 7, sides: 'sheet' }])
  })

  it('leaves out a box far off screen', () => {
    const { boxes } = layoutOf(project([...block(0, 0), ...block(900, 900)]), { viewport: { width: 1000, height: 800 } })
    expect(boxes).toHaveLength(1)
  })
})

describe('the numbers of a ruled box', () => {
  const frame = { row: 0, column: 0, rows: 3, columns: 4 }

  it('are every row and column, from 1, above, left and right of a Frame, none below, where its title block is (ticket 0657)', () => {
    const { labels } = framed(frame)

    expect(labels.filter((l) => l.axis === 'column' && l.y < 0).map((l) => l.text)).toEqual(['1', '2', '3', '4'])
    expect(labels.filter((l) => l.axis === 'column' && l.y > 60).map((l) => l.text)).toEqual([])
    expect(labels.filter((l) => l.axis === 'row' && l.x < 0).map((l) => l.text)).toEqual(['1', '2', '3'])
    expect(labels.filter((l) => l.axis === 'row' && l.x > 80).map((l) => l.text)).toEqual(['1', '2', '3'])
  })

  it('leave out the side shown at the bottom, whichever way the view is turned (ticket 0657)', () => {
    const turned = { rotation: 180 as const, centred: frame }
    const { labels } = framed(frame, turned)
    const columns = labels.filter((l) => l.axis === 'column')
    expect(columns.length).toBe(4)
    expect(columns.every((l) => l.y < 1000)).toBe(true)
    expect(labels.filter((l) => l.axis === 'row')).toHaveLength(6)
  })

  it('stand 3px clear of the line, which is 7px outside the beads, on each side', () => {
    const { labels } = framed(frame)
    const topOne = labels.find((l) => l.axis === 'column' && l.text === '1' && l.y < 0)!
    const leftOne = labels.find((l) => l.axis === 'row' && l.text === '1' && l.x < 0)!

    // Bead 1 is 0 to 20 wide: its number is centred on 10, and sits above the 7px line and 3px gap.
    expect(topOne.x).toBe(10)
    expect(topOne.y + topOne.height / 2).toBe(-7 - 3)
    expect(leftOne.y).toBe(10)
    expect(leftOne.x + leftOne.width / 2).toBe(-7 - 3)
  })

  it('line up on the dots’ line, whatever the digits: a 1-digit row number is as far from the beads as a 2-digit one', () => {
    // At 70% a 12-row ruler's step is 5, so its beads 1-4, 6-9 and 11-12 carry dots and 5 and 10 carry numbers.
    const { labels, dots } = framed({ ...frame, rows: 12 }, { zoom: 0.7 })
    const left = labels.filter((l) => l.axis === 'row' && l.x < 0)
    const leftDots = dots.filter((d) => d.axis === 'row' && d.x < 0)

    expect(left.map((l) => l.text)).toEqual(['5', '10'])
    expect(new Set(left.map((l) => l.x)).size).toBe(1)
    expect(left[0]?.x).toBeCloseTo(leftDots[0]?.x ?? NaN)
  })

  it('mark every 5th, and only each piece’s own start sides have numbers', () => {
    const { labels } = layoutOf(project(block(0, 0, 3, 10)))

    expect(labels.filter((l) => l.fifth).map((l) => l.text)).toEqual(['5', '10'])
    expect(labels.filter((l) => l.axis === 'column')).toHaveLength(10)
    expect(labels.filter((l) => l.axis === 'row')).toHaveLength(3)
  })

  it('turn a quarter from column 100, and keep row numbers upright whatever their size', () => {
    const { labels } = framed({ ...frame, columns: 120 })

    const hundred = labels.find((l) => l.axis === 'column' && l.text === '100' && l.y < 0)!
    const ninetyNine = labels.find((l) => l.axis === 'column' && l.text === '99' && l.y < 0)!
    expect(hundred.turned).toBe(true)
    expect(ninetyNine.turned).toBe(false)
    // Turned, three digits take the room two do across, and stand taller instead.
    expect(hundred.width).toBeLessThanOrEqual(ninetyNine.width)
    expect(hundred.height).toBeGreaterThan(ninetyNine.height)
    expect(labels.filter((l) => l.axis === 'row').every((l) => !l.turned)).toBe(true)
  })

  it('give a press the whole row or column of the box, by absolute position', () => {
    const { labels } = framed({ ...frame, row: 10, column: 20 }, { scroll: { x: 300, y: 150 } })

    const row2 = labels.find((l) => l.axis === 'row' && l.text === '2')!
    const column3 = labels.find((l) => l.axis === 'column' && l.text === '3')!
    expect(row2.selection).toEqual({ top: 11, left: 20, rows: 1, columns: 4 })
    expect(column3.selection).toEqual({ top: 10, left: 22, rows: 3, columns: 1 })
  })

  it('shift the column numbers by the half bead an offset technique’s odd rows sit', () => {
    const { labels } = framed({ ...frame, row: 1 }, { technique: 'peyote' })
    const first = labels.find((l) => l.axis === 'column' && l.text === '1')!
    // Row 1 is shifted 10px right, so bead 1's number is centred on 10 + 10.
    expect(first.x).toBe(20)
  })

  it('follow the picture when it is turned, standing on the side the Frame’s top now faces', () => {
    const { labels } = framed(frame, { rotation: 90, scroll: { x: -200, y: 0 } })
    const topOne = labels.find((l) => l.axis === 'column' && l.text === '1')!
    // A quarter turn clockwise carries the top of the Frame to the right: the column numbers stand right of it.
    expect(topOne.x - topOne.width / 2).toBeCloseTo(0 + 200 + 7 + 3, 5)
  })

  it('leave out the numbers far off screen', () => {
    const layout = layoutOf(project([...block(0, 0), ...block(900, 900)]), { viewport: { width: 1000, height: 800 } })

    expect(layout.labels.some((l) => l.text === '1' && l.axis === 'row')).toBe(true)
    expect(layout.labels.length).toBeLessThan(10)
  })
})

describe('the Ruler step', () => {
  // The first ruler of column numbers: the one above the Frame, or at the side its top now faces.
  const columnsOnTop = (look: Look, columns = 50) => {
    const frame = { row: 0, column: 0, rows: 5, columns }
    const { labels } = framed(frame, { ...look, centred: look.rotation ? frame : undefined })
    return labels.slice(0, labels.findIndex((l) => l.axis === 'row'))
  }

  it('is every bead while the numbers have room, then every 5th', () => {
    expect(columnsOnTop({ zoom: 1 }).map((l) => l.index + 1).slice(0, 3)).toEqual([1, 2, 3])
    expect(columnsOnTop({ zoom: 0.5 }).map((l) => l.index + 1).slice(0, 3)).toEqual([5, 10, 15])
  })

  it('measures a ruler running up the screen by its numbers’ height, not their width', () => {
    // 16px between beads: a 2-digit number is about 17.6px wide with its gap, but 15.4px tall.
    expect(columnsOnTop({ zoom: 0.8, rotation: 0 }).map((l) => l.index + 1).slice(0, 2)).toEqual([5, 10])
    expect(columnsOnTop({ zoom: 0.8, rotation: 90 }).map((l) => l.index + 1).slice(0, 2)).toEqual([1, 2])
  })

  it('leaves no two drawn numbers overlapping on a 999-column ruler at 50%, where the step still applies', () => {
    const labels = columnsOnTop({ zoom: 0.5 }, 999)
    // 10px beads: a number needs about 17px, so every 5th bead has room, every bead does not.
    expect(labels.map((l) => l.index + 1).slice(0, 3)).toEqual([5, 10, 15])
    for (let i = 1; i < labels.length; i += 1) {
      expect(labels[i]!.x - labels[i]!.width / 2).toBeGreaterThanOrEqual(labels[i - 1]!.x + labels[i - 1]!.width / 2)
    }
  })
})

describe('the Ruler dots', () => {
  const frame = { row: 0, column: 0, rows: 3, columns: 30 }
  const columnsOnTop = (dots: RulerDot[]) => dots.filter((d) => d.axis === 'column' && d.y < 0)

  it('mark every bead without a number, every 5th bolder', () => {
    // 14px of pitch: numbers every 5, so the 4 beads between each pair are dots.
    const dots = columnsOnTop(framed(frame, { zoom: 0.7 }).dots)
    expect(dots.map((d) => d.index + 1)).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29])
    expect(dots.every((d) => !d.fifth)).toBe(true)
  })

  it('leave no bead bare where every bead has a number', () => {
    expect(framed(frame).dots).toEqual([])
  })

  it('keep only the 5th-bead dots under 6px of pitch', () => {
    const dots = columnsOnTop(framed({ ...frame, columns: 999 }, { zoom: 0.1 }).dots)
    expect(dots.length).toBeGreaterThan(0)
    expect(dots.every((d) => d.fifth && !d.numbered)).toBe(true)
  })

  it('bring back a dot per bead from 6px of pitch', () => {
    const dots = columnsOnTop(framed({ ...frame, columns: 999 }, { zoom: 6.5 / 20 }).dots)
    expect(dots.some((d) => !d.fifth)).toBe(true)
  })

  it('shift a brick stitch’s odd rows by half a bead, as the numbers do', () => {
    // Turned a quarter, the first row's and the last row's rulers both stand on screen, at the right and the left.
    const look = { technique: 'brick' as const, zoom: 0.7, rotation: 90 as const, centred: { row: 0, column: 0, rows: 4, columns: 12 } }
    const { dots } = framed({ row: 0, column: 0, rows: 4, columns: 12 }, look)
    const columns = dots.filter((d) => d.axis === 'column')
    const first = (side: (d: RulerDot) => boolean) => columns.find(side)!
    // Row 0 sits unshifted, row 3 is shifted a half bead: the same column's dot is 14 * 0.5 apart along the side.
    expect(Math.abs(first((d) => d.x > 1000).y - first((d) => d.x < 1000).y)).toBeCloseTo(10 * 0.7)
  })

  it('stand on the side the top faces when turned, and give only a Piece’s start sides dots', () => {
    const look = { rotation: 90 as const, zoom: 0.7, technique: 'brick' as const, centred: { row: 0, column: 0, rows: 4, columns: 12 } }
    const whole = framed({ row: 0, column: 0, rows: 4, columns: 12 }, look).dots
    const piece = layoutOf(project(block(0, 0, 4, 12), undefined, 'brick'), look).dots
    expect(piece.length).toBeGreaterThan(0)
    expect(whole.length).toBeGreaterThan(piece.length)
  })

  it('are none with the numbers off, though the Frame’s box is still there', () => {
    const layout = framed(frame, { zoom: 0.7, numbers: false })
    expect(layout.dots).toEqual([])
    expect(layout.labels).toEqual([])
    expect(layout.boxes).toHaveLength(1)
  })
})

describe('the numbers below 50% zoom (ticket 303)', () => {
  const wide = { row: 0, column: 0, rows: 13, columns: 100 }
  const texts = (zoom: number, side: (l: RulerLabel) => boolean) => framed(wide, { zoom }).labels.filter(side).map((l) => l.text)

  it('keep the Ruler step at 50%', () => {
    expect(texts(0.5, (l) => l.axis === 'column' && l.y < 0).length).toBeGreaterThan(1)
    expect(texts(0.5, (l) => l.axis === 'row' && l.x < 0).length).toBeGreaterThan(0)
  })

  it('are only the last one on each side at 49%, columns and rows, above, left and right', () => {
    expect(texts(0.49, (l) => l.axis === 'column' && l.y < 0)).toEqual(['100'])
    expect(texts(0.49, (l) => l.axis === 'column' && l.y > 0)).toEqual([])
    expect(texts(0.49, (l) => l.axis === 'row' && l.x < 0)).toEqual(['13'])
    expect(texts(0.49, (l) => l.axis === 'row' && l.x > 0)).toEqual(['13'])
  })

  it('give a press on the last number its whole row or column', () => {
    const [last] = framed(wide, { zoom: 0.1 }).labels.filter((l) => l.axis === 'column')
    expect(last!.selection).toEqual({ top: 0, left: 99, rows: 13, columns: 1 })
  })

  it('are the one number of a piece’s start sides too', () => {
    const { labels } = layoutOf(project(block(0, 0, 13, 100)), { zoom: 0.25 })
    expect(labels.map((l) => l.text).sort()).toEqual(['100', '13'])
  })
})

describe('numbers and dots lay out at every technique, turn and zoom', () => {
  const techniques: Technique[] = ['loom', 'peyote', 'brick']
  const rotations: Rotation[] = [0, 90, 180, 270]
  // Above 50%, below it, and with a bead pitch of 5px, under the 6px where only every 5th bead keeps its dot.
  const zooms = [1, 0.6, 0.4, 0.25]
  const cases = techniques.flatMap((technique) => rotations.flatMap((rotation) => zooms.map((zoom) => ({ technique, rotation, zoom }))))

  it.each(cases)('$technique turned $rotation° at zoom $zoom', ({ technique, rotation, zoom }) => {
    const frame = { row: 1, column: 2, rows: 14, columns: 60 }
    const { labels, dots } = framed(frame, { technique, rotation, zoom, centred: frame })

    expect(labels.length).toBeGreaterThan(0)
    if (zoom < 1) {
      expect(dots.length).toBeGreaterThan(0)
    }
  })
})

describe('the rulers at different zooms (ticket 377)', () => {
  const frame: Rect = { row: 0, column: 0, rows: 8, columns: 150 }

  it('holds the dots to a 2-digit number’s half band, so a turned 3-digit column number does not push them off the line', () => {
    const { dots, scale } = framed(frame, { zoom: 0.6 })
    const columnDots = dots.filter((d) => d.axis === 'column')
    expect(columnDots.length).toBeGreaterThan(0)
    for (const dot of columnDots) {
      expect(dot.half).toBeCloseTo(scale.fontPx * 0.6)
    }
  })

  it('draws the Frame’s line closer to the beads zoomed out and further zoomed in than at 100%', () => {
    const outset = (zoom: number) => framed(frame, { zoom }).boxes[0]!.outset
    expect(outset(0.2)).toBeLessThan(outset(1))
    expect(outset(3)).toBeGreaterThan(outset(1))
  })

  it('makes the numbers bigger zoomed out and zoomed in than at 100%, and the dots bigger zoomed in', () => {
    const at = (zoom: number) => framed(frame, { zoom }).scale
    expect(at(0.2).fontPx).toBeGreaterThan(at(1).fontPx)
    expect(at(3).fontPx).toBeGreaterThan(at(1).fontPx)
    expect(at(3).dotRadius).toBeGreaterThan(at(1).dotRadius)
  })
})

describe('the dots below the zoom where only the last number shows (ticket 378)', () => {
  const frame: Rect = { row: 0, column: 0, rows: 8, columns: 150 }

  it('stand close to the Frame’s line, within a few px of it, not out at the numbers’ band', () => {
    const { dots, boxes, scale } = framed(frame, { zoom: 0.2 })
    const top = dots.filter((d) => d.axis === 'column' && d.normal[1] < -0.5)
    expect(top.length).toBeGreaterThan(0)
    const frameTop = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 0.2 }).beadBox(frame).y
    const away = frameTop - top[0]!.y
    expect(away).toBeCloseTo(boxes[0]!.outset + scale.gap + scale.dotRadius, 5)
    expect(away).toBeLessThan(7)
  })
})

describe('the rulers of a Frame woven in its own Technique (ticket 492)', () => {
  // A peyote Frame of 3 rows × 4 columns at row 2, column 3 of a loom Canvas: its corner is at (60, 40).
  const frame = { technique: 'peyote' as const, row: 2, column: 3, rows: 3, columns: 4 }
  const subject = flatProject({ technique: 'loom', frame: { ...frame, beads: {} } })
  const surface = surfaceView({ space: OPEN_SPACE, technique: 'loom', frame, rotation: 0, zoom: 1 })
  const { labels } = rulerLayout(subject, surface, { fontPx: 11, numbers: true })

  it('number the rows at the Frame\'s own pitch, from its corner', () => {
    const rows = labels.filter((l) => l.axis === 'row' && l.x < 0 + 60)
    expect(rows.map((l) => l.text)).toEqual(['1', '2', '3'])
    expect(rows.map((l) => l.y)).toEqual([50, 65, 80])
  })

  it('number the columns across, the shifted second row not moving the top ruler', () => {
    const columns = labels.filter((l) => l.axis === 'column' && l.y < 40)
    expect(columns.map((l) => l.x)).toEqual([70, 90, 110, 130])
  })

  it('mark the row or column of the Frame a number selects by its Canvas positions', () => {
    const second = labels.find((l) => l.axis === 'row' && l.text === '2')!
    expect(second.selection).toMatchObject({ top: 3, left: 3, rows: 1, columns: 4 })
  })
})

describe('a Custom frame (ticket 0592)', () => {
  it('carries no rulers: its beads lie in rounds, not its rectangle\'s rows and columns', () => {
    const triangle = { row: 0, column: 0, rows: 12, columns: 10, technique: 'peyote' as const, shape: 'triangle' as const, settings: { rounds: 4 } }
    const surface = surfaceView({ space: OPEN_SPACE, technique: 'peyote', rotation: 0, zoom: 1, viewport: { width: 800, height: 600 } })
    const laid = rulerLayout(flatProject({ technique: 'peyote', frame: { ...triangle, beads: {} } }), surface, { fontPx: 11, numbers: true })
    expect(laid.boxes).toEqual([])
    expect(laid.labels).toEqual([])
  })
})

describe('a Frame lying turned (ticket 0667)', () => {
  it('carries its line and rulers round what it covers as it lies, Width and Height swapped', () => {
    const turned = { row: 0, column: 0, rows: 4, columns: 6, technique: 'loom' as const, quarterTurns: 1 as const }
    const surface = surfaceView({ space: OPEN_SPACE, technique: 'loom', frame: turned, rotation: 0, zoom: 1, viewport: { width: 800, height: 600 } })
    const laid = rulerLayout(flatProject({ technique: 'loom', frame: { ...turned, beads: {} } }), surface, { fontPx: 11, numbers: true })
    expect(laid.boxes).toEqual([expect.objectContaining({ row: 0, column: 0, rows: 6, columns: 4, kind: 'frame' })])
    expect(Math.max(...laid.labels.filter((label) => label.axis === 'column').map((label) => Number(label.text)))).toBe(4)
    expect(Math.max(...laid.labels.filter((label) => label.axis === 'row').map((label) => Number(label.text)))).toBe(6)
  })
})
