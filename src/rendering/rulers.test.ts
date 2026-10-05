import { describe, expect, it } from 'vitest'
import { withColors } from '../domain/canvas'
import { labelAt, rulerBeads, rulerDots, rulerLabels, rulerPick, rulerStep, ruledBoxes, visibleRulerLabels, type RulerView } from './rulers'

const R = '#e63746'
const view = (extra: Partial<RulerView> = {}): RulerView => ({
  technique: 'loom',
  rotation: 0,
  zoom: 1,
  scroll: { x: 0, y: 0 },
  viewport: { width: 1000, height: 800 },
  fontPx: 11,
  ...extra,
})
const project = (positions: [number, number][], frame?: { row: number; column: number; rows: number; columns: number }) => ({
  technique: 'loom' as const,
  frame,
  beads: withColors({}, positions.map(([row, column]) => ({ row, column, color: R }))),
})

describe('which boxes carry rulers', () => {
  it('is each piece, with only the start sides, until a Frame is set', () => {
    const boxes = ruledBoxes(project([[0, 0], [10, 10]]))
    expect(boxes.map((box) => [box.kind, box.sides, box.outset])).toEqual([['piece', 'start', 5], ['piece', 'start', 5]])
  })

  it('is the Frame alone, on every side, once it is set, whatever pieces there are', () => {
    const boxes = ruledBoxes(project([[0, 0], [10, 10]], { row: 2, column: 3, rows: 4, columns: 5 }))
    expect(boxes).toEqual([{ row: 2, column: 3, rows: 4, columns: 5, kind: 'frame', outset: 7, sides: 'all' }])
  })
})

describe('the numbers of a ruled box', () => {
  const box = { row: 0, column: 0, rows: 3, columns: 4, kind: 'frame' as const, outset: 7, sides: 'all' as const }

  it('are every row and column, from 1, above, left, below and right of a Frame', () => {
    const labels = rulerLabels(box, view())

    expect(labels.filter((l) => l.axis === 'column' && l.y < 0).map((l) => l.text)).toEqual(['1', '2', '3', '4'])
    expect(labels.filter((l) => l.axis === 'column' && l.y > 60).map((l) => l.text)).toEqual(['1', '2', '3', '4'])
    expect(labels.filter((l) => l.axis === 'row' && l.x < 0).map((l) => l.text)).toEqual(['1', '2', '3'])
    expect(labels.filter((l) => l.axis === 'row' && l.x > 80).map((l) => l.text)).toEqual(['1', '2', '3'])
  })

  it('stand 3px clear of the line, which is 7px outside the beads, on each side', () => {
    const labels = rulerLabels(box, view())
    const topOne = labels.find((l) => l.axis === 'column' && l.text === '1' && l.y < 0)!
    const leftOne = labels.find((l) => l.axis === 'row' && l.text === '1' && l.x < 0)!

    // Bead 1 is 0 to 20 wide: its number is centred on 10, and sits above the 7px line and 3px gap.
    expect(topOne.x).toBe(10)
    expect(topOne.y + topOne.height / 2).toBe(-7 - 3)
    expect(leftOne.y).toBe(10)
    expect(leftOne.x + leftOne.width / 2).toBe(-7 - 3)
  })

  it('mark every 5th, and only each piece’s own start sides have numbers', () => {
    const wide = { ...box, columns: 10, sides: 'start' as const, kind: 'piece' as const, outset: 5 }
    const labels = rulerLabels(wide, view())

    expect(labels.filter((l) => l.fifth).map((l) => l.text)).toEqual(['5', '10'])
    expect(labels.filter((l) => l.axis === 'column')).toHaveLength(10)
    expect(labels.filter((l) => l.axis === 'row')).toHaveLength(3)
  })

  it('turn a quarter from column 100, and keep row numbers upright whatever their size', () => {
    const labels = rulerLabels({ ...box, columns: 120 }, view({ viewport: { width: 1e6, height: 800 } }))

    const hundred = labels.find((l) => l.axis === 'column' && l.text === '100' && l.y < 0)!
    const ninetyNine = labels.find((l) => l.axis === 'column' && l.text === '99' && l.y < 0)!
    expect(hundred.turned).toBe(true)
    expect(ninetyNine.turned).toBe(false)
    // Turned, three digits take the room two do across, and stand taller instead.
    expect(hundred.width).toBeLessThanOrEqual(ninetyNine.width)
    expect(hundred.height).toBeGreaterThan(ninetyNine.height)
    expect(labels.filter((l) => l.axis === 'row').every((l) => !l.turned)).toBe(true)
  })

  it('give a click the whole row or column of the box, by absolute position', () => {
    const labels = rulerLabels({ ...box, row: 10, column: 20 }, view({ scroll: { x: 300, y: 150 } }))

    const row2 = labels.find((l) => l.axis === 'row' && l.text === '2')!
    const column3 = labels.find((l) => l.axis === 'column' && l.text === '3')!
    expect(row2.selection).toEqual({ top: 11, left: 20, rows: 1, columns: 4 })
    expect(column3.selection).toEqual({ top: 10, left: 22, rows: 3, columns: 1 })
  })

  it('shift the column numbers by the half bead an offset technique’s odd rows sit', () => {
    const peyote = rulerLabels({ ...box, row: 1, sides: 'start' }, view({ technique: 'peyote' }))
    const first = peyote.find((l) => l.axis === 'column' && l.text === '1')!
    // Row 1 is shifted 10px right, so bead 1's number is centred on 10 + 10.
    expect(first.x).toBe(20)
  })

  it('follow the picture when it is turned, standing on the side the Frame’s top now faces', () => {
    const labels = rulerLabels({ ...box, sides: 'start' }, view({ rotation: 90, scroll: { x: -200, y: 0 } }))
    const topOne = labels.find((l) => l.axis === 'column' && l.text === '1')!
    // A quarter turn clockwise carries the top of the Frame to the right: the column numbers stand right of it.
    expect(topOne.x - topOne.width / 2).toBeCloseTo(0 + 200 + 7 + 3, 5)
  })

  it('leave out the numbers far off screen, and find the one under a point', () => {
    const labels = visibleRulerLabels(project([[0, 0], [0, 1], [900, 900]]), view())

    expect(labels.some((l) => l.text === '1' && l.axis === 'row')).toBe(true)
    expect(labels.length).toBeLessThan(10)
    const first = labels[0]!
    expect(labelAt(labels, { x: first.x, y: first.y })).toBe(first)
    expect(labelAt(labels, { x: 5000, y: 5000 })).toBeUndefined()
  })
})

describe('the Ruler step', () => {
  const two = { width: 13.2, height: 11 }
  const turned = { width: 11, height: 19.8 }

  it('is every bead while the numbers have room, then 5, 10, 50, 100', () => {
    expect(rulerStep({ x: 20, y: 20 }, [two])).toBe(1)
    expect(rulerStep({ x: 10, y: 0 }, [two])).toBe(5)
    expect(rulerStep({ x: 3, y: 0 }, [two])).toBe(10)
    expect(rulerStep({ x: 2, y: 0 }, [two])).toBe(10)
    expect(rulerStep({ x: 1, y: 0 }, [two])).toBe(50)
    expect(rulerStep({ x: 0.2, y: 0 }, [two])).toBe(100)
  })

  it('measures turned numbers by their own box, and a ruler running up the screen by its height', () => {
    // 3-digit numbers turned stand 19.8 tall but only 11 wide.
    expect(rulerStep({ x: 3, y: 0 }, [two, turned])).toBe(10)
    expect(rulerStep({ x: 0, y: 3 }, [turned])).toBe(10)
    expect(rulerStep({ x: 0, y: 3 }, [two])).toBe(5)
  })

  it('leaves no two drawn numbers overlapping on a 999-column ruler at 10%', () => {
    const wide = { row: 0, column: 0, rows: 10, columns: 999, kind: 'frame' as const, outset: 7, sides: 'all' as const }
    const labels = rulerLabels(wide, view({ zoom: 0.1, viewport: { width: 1e6, height: 800 } })).filter((l) => l.axis === 'column' && l.y < 0)
    // 2px beads: a number needs about 17px, so every 10th bead has room, every 5th does not.
    expect(labels.map((l) => l.index + 1).slice(0, 3)).toEqual([10, 20, 30])
    for (let i = 1; i < labels.length; i += 1) {
      expect(labels[i]!.x - labels[i]!.width / 2).toBeGreaterThanOrEqual(labels[i - 1]!.x + labels[i - 1]!.width / 2)
    }
  })
})

describe('the Ruler dots', () => {
  const box = { row: 0, column: 0, rows: 3, columns: 30, kind: 'frame' as const, outset: 7, sides: 'all' as const }
  const columnsOnTop = (dots: ReturnType<typeof rulerDots>) => dots.filter((d) => d.axis === 'column' && d.y < 0)

  it('mark every bead without a number, every 5th bolder', () => {
    // 14px of pitch: numbers every 5, so the 4 beads between each pair are dots.
    const dots = columnsOnTop(rulerDots(box, view({ zoom: 0.7 })))
    expect(dots.map((d) => d.index + 1)).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29])
    expect(dots.every((d) => !d.fifth)).toBe(true)
  })

  it('leave no bead bare where every bead has a number', () => {
    expect(rulerDots(box, view())).toEqual([])
  })

  it('keep only the 5th-bead dots under 6px of pitch', () => {
    const wide = { ...box, columns: 999 }
    const dots = columnsOnTop(rulerDots(wide, view({ zoom: 0.1, viewport: { width: 4000, height: 800 } })))
    expect(dots.length).toBeGreaterThan(0)
    expect(dots.every((d) => d.fifth && !d.numbered)).toBe(true)
  })

  it('bring back a dot per bead from 6px of pitch', () => {
    const dots = columnsOnTop(rulerDots({ ...box, columns: 999 }, view({ zoom: 6.5 / 20, viewport: { width: 4000, height: 800 } })))
    expect(dots.some((d) => !d.fifth)).toBe(true)
  })
})

describe('picking by the nearest bead on a ruler', () => {
  const frame = { row: 0, column: 0, rows: 4, columns: 999 }
  const wide = project([[0, 0]], frame)
  const tenPercent = view({ zoom: 0.1, viewport: { width: 400, height: 300 } })

  it('lands on the bead under the pointer at 10%, where a bead is 2px', () => {
    const [bead] = rulerBeads({ ...frame, kind: 'frame', outset: 7, sides: 'all' }, tenPercent).filter((d) => d.axis === 'column' && d.index === 40 && d.y < 0)
    const picked = rulerPick(wide, tenPercent, [], { x: bead!.x + 0.4, y: bead!.y })
    expect(picked).toEqual({ top: 0, left: 40, rows: 4, columns: 1 })
  })

  it('selects a row from a dot beside the left ruler, and nothing away from the rulers', () => {
    const [dot] = rulerBeads({ ...frame, kind: 'frame', outset: 7, sides: 'all' }, view()).filter((d) => d.axis === 'row' && d.index === 2 && d.x < 0)
    expect(rulerPick(wide, view(), [], { x: dot!.x, y: dot!.y })).toEqual({ top: 2, left: 0, rows: 1, columns: 999 })
    expect(rulerPick(wide, view(), [], { x: 300, y: 300 })).toBeUndefined()
  })

  it('lets a number under the pointer pick its own bead', () => {
    const labels = visibleRulerLabels(wide, tenPercent)
    const label = labels.find((l) => l.axis === 'column' && l.y < 0)!
    expect(rulerPick(wide, tenPercent, labels, { x: label.x, y: label.y })).toEqual(label.selection)
  })
})
