import { describe, expect, it } from 'vitest'
import { captionColumns, placeFirstRunHints, type HintId, type HintLayout, type PlacedHint } from './firstRunHintPlacement'

// The reference layout (FirstRunHints card, a 1440 × 900 MacBook Air): the drawing area under the strip, its buttons
// just above it, the Tool pill docked at the bottom.
const strip = {
  menu: { left: 8, top: -31, width: 84, height: 30 },
  project: { left: 96, top: -31, width: 100, height: 30 },
  frame: { left: 200, top: -31, width: 84, height: 30 },
  export: { left: 1380, top: -31, width: 32, height: 30 },
}
const pill = { left: 500, top: 700, width: 440, height: 48 }
const tiles = {
  select: { left: 618, top: 704, width: 40, height: 40 },
  mirror: { left: 786, top: 704, width: 40, height: 40 },
  color: { left: 890, top: 704, width: 40, height: 40 },
}
const notes = {
  select: { width: 300, height: 44 },
  frame: { width: 150, height: 38 },
  export: { width: 160, height: 44 },
  menu: { width: 80, height: 110 },
  project: { width: 96, height: 110 },
  mirror: { width: 280, height: 19 },
  color: { width: 170, height: 19 },
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

const placed = (from: HintLayout, id: HintId) => placeFirstRunHints(from).find((hint) => hint.id === id)
const boxOf = (from: HintLayout, hint: PlacedHint) => ({ ...hint.note, ...from.notes[hint.id]! })

describe('the columns the strip captions wrap in (FirstRunHints card)', () => {
  it('gives each strip caption the room under its own button, up to the next one, at most 192px', () => {
    expect(captionColumns(strip)).toEqual({ menu: 82, project: 98, frame: 192, export: 192 })
  })

  it('leaves out a quiet caption whose button leaves it under 64px, and keeps Frame and Export at 64px', () => {
    const tight = {
      menu: { left: 8, top: -31, width: 40, height: 30 },
      project: { left: 52, top: -31, width: 40, height: 30 },
      frame: { left: 96, top: -31, width: 40, height: 30 },
      export: { left: 140, top: -31, width: 32, height: 30 },
    }

    expect(captionColumns(tight)).toEqual({ frame: 64, export: 64 })
  })
})

describe('where the first-run captions sit (FirstRunHints card)', () => {
  it('puts each strip caption under its own button, Export\'s right-aligned under it', () => {
    expect(placed(layout(), 'menu')?.note).toEqual({ left: 8, top: 8 })
    expect(placed(layout(), 'project')?.note).toEqual({ left: 96, top: 8 })
    expect(placed(layout(), 'frame')?.note).toEqual({ left: 200, top: 8 })
    expect(placed(layout(), 'export')?.note).toEqual({ left: 1252, top: 8 })
  })

  it('puts a tile caption just above its tile, centred on it, with the pill at the bottom', () => {
    expect(placed(layout(), 'select')?.note).toEqual({ left: 488, top: 650 })
  })

  it('stacks a tile caption further out, still centred on its tile, rather than cover a neighbour\'s', () => {
    expect(placed(layout(), 'mirror')?.note).toEqual({ left: 666, top: 615 })
  })

  it('follows the Tool pill to the left edge, the captions right of their tiles and centred on them', () => {
    const left = layout({
      pillPosition: 'left',
      obstacles: [{ left: 6, top: 200, width: 48, height: 520 }],
      targets: { ...strip, select: { left: 10, top: 312, width: 40, height: 40 }, mirror: { left: 10, top: 488, width: 40, height: 40 } },
    })

    expect(placed(left, 'select')?.note).toEqual({ left: 60, top: 310 })
    expect(placed(left, 'mirror')?.note).toEqual({ left: 60, top: 499 })
  })

  it('follows the Tool pill to the right edge, the captions left of their tiles', () => {
    const right = layout({
      pillPosition: 'right',
      obstacles: [{ left: 1370, top: 200, width: 48, height: 520 }],
      targets: { ...strip, select: { left: 1374, top: 312, width: 40, height: 40 } },
    })

    expect(placed(right, 'select')?.note).toEqual({ left: 1064, top: 310 })
  })

  it('keeps every caption off the others and off the pill, the CanvasHint line and the welcome', () => {
    const hint = { left: 440, top: 10, width: 560, height: 20 }
    const welcome = { left: 420, top: 260, width: 600, height: 260 }
    const busy = layout({ obstacles: [pill, hint, welcome] })
    const boxes = placeFirstRunHints(busy).map((placedHint) => boxOf(busy, placedHint))

    for (const [index, box] of boxes.entries()) {
      for (const other of [...boxes.slice(index + 1), pill, hint, welcome]) {
        const apart =
          box.left + box.width <= other.left || other.left + other.width <= box.left ||
          box.top + box.height <= other.top || other.top + other.height <= box.top
        expect(apart, `${JSON.stringify(box)} and ${JSON.stringify(other)}`).toBe(true)
      }
    }
  })

  it('fits every caption at the reference size', () => {
    expect(placeFirstRunHints(layout()).map((hint) => hint.id)).toEqual(['select', 'frame', 'export', 'color', 'mirror', 'menu', 'project'])
  })

  it('always shows Select, Frame and Export and drops the quiet captions where there is no room', () => {
    const full = layout({ obstacles: [{ left: 0, top: 0, width: 1424, height: 780 }] })

    expect(placeFirstRunHints(full).map((hint) => hint.id)).toEqual(['select', 'frame', 'export'])
  })

  it('places nothing for a control that is not there', () => {
    expect(placeFirstRunHints(layout({ targets: { ...strip } })).map((hint) => hint.id)).toEqual(['frame', 'export', 'menu', 'project'])
  })
})
