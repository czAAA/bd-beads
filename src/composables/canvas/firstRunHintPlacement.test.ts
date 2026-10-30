import { describe, expect, it } from 'vitest'
import { placeFirstRunHints, type HintLayout } from './firstRunHintPlacement'

// The reference layout (FirstRunHints card, a 1440 × 900 MacBook Air): the drawing area under the strip, its buttons
// just above it, the Tool pill docked at the bottom.
const strip = {
  menu: { left: 16, top: -31, width: 60, height: 30 },
  project: { left: 80, top: -31, width: 70, height: 30 },
  frame: { left: 154, top: -31, width: 60, height: 30 },
  export: { left: 1380, top: -31, width: 30, height: 30 },
}
const pill = { left: 500, top: 700, width: 440, height: 48 }
const tiles = {
  paint: { left: 534, top: 704, width: 40, height: 40 },
  select: { left: 618, top: 704, width: 40, height: 40 },
  mirror: { left: 786, top: 704, width: 40, height: 40 },
  color: { left: 890, top: 704, width: 40, height: 40 },
}
const notes = {
  paint: { width: 260, height: 26 },
  select: { width: 300, height: 52 },
  frame: { width: 300, height: 52 },
  export: { width: 200, height: 52 },
  menu: { width: 120, height: 66 },
  project: { width: 240, height: 44 },
  mirror: { width: 320, height: 22 },
  color: { width: 170, height: 22 },
}

function layout(change: Partial<HintLayout> = {}): HintLayout {
  return {
    area: { width: 1424, height: 780 },
    targets: { ...strip, ...tiles },
    notes,
    pillPosition: 'bottom',
    obstacles: [pill],
    ...change,
  }
}

const placed = (from: HintLayout, id: string) => placeFirstRunHints(from).find((hint) => hint.id === id)

describe('where the first-run hints sit (FirstRunHints card)', () => {
  it('puts step 3 right of the strip\'s Frame button, under the strip', () => {
    expect(placed(layout(), 'frame')?.note).toEqual({ left: 222, top: 40 })
  })

  it('puts step 4 right-aligned under Export', () => {
    expect(placed(layout(), 'export')?.note).toEqual({ left: 1210, top: 40 })
  })

  it('puts Paint\'s note above the pill, left of the tile, and Select\'s right of its tile', () => {
    expect(placed(layout(), 'paint')?.note).toEqual({ left: 290, top: 638 })
    expect(placed(layout(), 'select')?.note.left).toBe(642)
  })

  it('ends each arrow 6px off its control, on the drawing-area side', () => {
    expect(placed(layout(), 'paint')?.arrow).toMatch(/ 554 698 M /)
    expect(placed(layout(), 'frame')?.arrow).toMatch(/ 184 5 M /)
  })

  it('follows the Tool pill to the left edge, the tile notes right of their tiles', () => {
    const left = layout({
      pillPosition: 'left',
      obstacles: [{ left: 8, top: 100, width: 48, height: 440 }],
      targets: { ...strip, paint: { left: 12, top: 134, width: 40, height: 40 }, select: { left: 12, top: 218, width: 40, height: 40 } },
    })

    expect(placed(left, 'paint')?.note).toEqual({ left: 92, top: 124 })
    expect(placed(left, 'select')?.note).toEqual({ left: 92, top: 242 })
  })

  it('slides a note along, or further out, rather than cover the welcome', () => {
    const narrow = { left: 200, top: 30, width: 100, height: 60 }
    const wide = { left: 300, top: 30, width: 1124, height: 60 }

    expect(placed(layout({ obstacles: [pill, narrow] }), 'frame')?.note).toEqual({ left: 342, top: 40 })
    expect(placed(layout({ obstacles: [pill, wide] }), 'frame')?.note).toEqual({ left: 222, top: 100 })
  })

  it('keeps every arrow off the other notes', () => {
    const hints = placeFirstRunHints(layout())
    const boxes = hints.map((hint) => ({ id: hint.id, ...hint.note, ...notes[hint.id] }))

    for (const hint of hints) {
      const [x0, y0, cx, cy, x1, y1] = hint.arrow.match(/-?[\d.]+/g)!.slice(0, 6).map(Number)
      for (let step = 0; step <= 10; step += 1) {
        const t = step / 10
        const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
        const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1
        const crossed = boxes.find((box) => box.id !== hint.id && x > box.left && x < box.left + box.width && y > box.top && y < box.top + box.height)
        expect(crossed?.id, `${hint.id}'s arrow at ${x}, ${y}`).toBeUndefined()
      }
    }
  })

  it('fits every note at the reference size, step 2\'s above the Mirror and colour notes', () => {
    const hints = placeFirstRunHints(layout())

    expect(hints.map((hint) => hint.id)).toEqual(['paint', 'select', 'frame', 'export', 'color', 'mirror', 'menu', 'project'])
    expect(placed(layout(), 'select')!.note.top).toBeLessThan(placed(layout(), 'mirror')!.note.top)
  })

  it('always shows the four steps and drops the quiet notes where there is no room', () => {
    const full = layout({ obstacles: [{ left: 0, top: 0, width: 1424, height: 780 }] })
    const ids = placeFirstRunHints(full).map((hint) => hint.id)

    expect(ids).toEqual(['paint', 'select', 'frame', 'export'])
  })

  it('places nothing for a control that is not there', () => {
    const ids = placeFirstRunHints(layout({ targets: { ...strip } })).map((hint) => hint.id)

    expect(ids).toEqual(['frame', 'export', 'menu', 'project'])
  })
})
