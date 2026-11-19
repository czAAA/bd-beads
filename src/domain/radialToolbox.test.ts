import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RADIAL_DIVIDERS, RADIAL_HOLE, RADIAL_PLACES, RADIAL_REACH, RADIAL_RING, RADIAL_ROOM, radialCenterOnScreen, radialItemAt, radialItemOff, radialNameCenter, radialSliceOutline } from './radialToolbox'
import { PILL_TOOLS } from './toolPill'

/** A point `distance` from the ring's centre at `angle`, degrees clockwise from straight up, y down as on screen. */
function at(angle: number, distance: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180
  return { x: distance * Math.sin(radians), y: -distance * Math.cos(radians) }
}

/** The touch target a hit area has to hold (accessibility.md, ticket 0962). */
const TOUCH_TARGET = 44

describe('the Radial toolbox places (RadialToolbox card)', () => {
  it('holds the ten items, the colours over the top and the tools under, each in the Tool pill order left to right', () => {
    expect(RADIAL_PLACES.map((place) => place.id)).toEqual(['pick-color', 'recent-1', 'recent-2', 'recent-3', 'redo', 'tool-erase', 'tool-select', 'tool-fill', 'tool-paint', 'undo'])
    const leftToRight = (ids: string[]) => ids.map((id) => at(RADIAL_PLACES.find((place) => place.id === id)!.angle, 1).x)
    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)
    const colors = leftToRight(['pick-color', 'recent-1', 'recent-2', 'recent-3'])
    const tools = leftToRight(PILL_TOOLS.slice(0, 4).map((tool) => `tool-${tool}`))
    expect(colors).toEqual(sorted(colors))
    expect(tools).toEqual(sorted(tools))
  })

  it('the slices fill the whole turn, each starting where the last one ends', () => {
    expect(RADIAL_PLACES.reduce((sum, place) => sum + place.slice, 0)).toBe(360)
    RADIAL_PLACES.forEach((place, index) => {
      const next = RADIAL_PLACES[(index + 1) % RADIAL_PLACES.length]!
      expect((place.angle + place.slice / 2) % 360, `${place.id} to ${next.id}`).toBe((next.angle - next.slice / 2 + 360) % 360)
    })
  })

  it('a divider stands on each side of Undo and of Redo', () => {
    const edges = (id: string) => {
      const place = RADIAL_PLACES.find((each) => each.id === id)!
      return [place.angle - place.slice / 2, place.angle + place.slice / 2]
    }
    expect([...RADIAL_DIVIDERS].sort((a, b) => a - b)).toEqual([...edges('redo'), ...edges('undo')])
  })

  it('is the size the tokens say: radial-radius to the tiles, pill-thickness across', () => {
    const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as { layout: { tokens: { name: string; value: string }[] } }
    const px = (name: string) => parseFloat(tokens.layout.tokens.find((token) => token.name === name)!.value)
    expect(RADIAL_RING).toEqual({ radius: px('radial-radius'), band: px('pill-thickness') })
    expect([RADIAL_HOLE, RADIAL_REACH]).toEqual([60, 108])
  })
})

describe('radialItemAt', () => {
  it("every item's tile centre picks that item", () => {
    for (const place of RADIAL_PLACES) expect(radialItemAt(at(place.angle, RADIAL_RING.radius), RADIAL_HOLE), place.id).toBe(place.id)
  })

  it('picks nothing inside the hole, and an item from its edge on', () => {
    for (let angle = 0; angle < 360; angle += 7) {
      expect(radialItemAt(at(angle, RADIAL_HOLE - 0.5), RADIAL_HOLE)).toBeUndefined()
      expect(radialItemAt(at(angle, RADIAL_HOLE + 0.5), RADIAL_HOLE)).toBeDefined()
    }
    expect(radialItemAt({ x: 0, y: 0 }, RADIAL_HOLE)).toBeUndefined()
  })

  it('a point far beyond the ring still picks by direction', () => {
    for (const place of RADIAL_PLACES) expect(radialItemAt(at(place.angle + place.slice / 2 - 1, 5000), RADIAL_HOLE), place.id).toBe(place.id)
  })

  it('no point belongs to two items: every direction picks one, and an edge goes to the slice it starts', () => {
    for (let tenth = 0; tenth < 3600; tenth += 1) {
      const angle = tenth / 10
      const inSlice = RADIAL_PLACES.filter((place) => ((angle - (place.angle - place.slice / 2) + 360) % 360) < place.slice)
      expect(inSlice.length, `${angle}°`).toBe(1)
      // An edge itself rounds to either side in sines and cosines: off it, the point picks the slice it is in.
      if (!Number.isInteger(angle)) expect(radialItemAt(at(angle, RADIAL_RING.radius), RADIAL_HOLE), `${angle}°`).toBe(inSlice[0]!.id)
    }
  })
})

describe('radialSliceOutline', () => {
  it("every point inside an item's outline picks that item", () => {
    for (const place of RADIAL_PLACES) {
      const outline = radialSliceOutline(place.id, RADIAL_HOLE, RADIAL_REACH)
      const middle = at(place.angle, RADIAL_RING.radius)
      // Pulled a little toward the slice's middle, a corner of the outline is inside it.
      for (const point of outline) {
        const inside = { x: point.x + (middle.x - point.x) * 0.02, y: point.y + (middle.y - point.y) * 0.02 }
        expect(radialItemAt(inside, RADIAL_HOLE), place.id).toBe(place.id)
      }
    }
  })

  it('at its smallest a slice holds a touch target round its tile centre', () => {
    for (const place of RADIAL_PLACES) {
      // The slice is narrowest across its direction at the tile's centre: half its angle each way on the radius.
      const across = 2 * RADIAL_RING.radius * Math.sin(((place.slice / 2) * Math.PI) / 180)
      expect(across, place.id).toBeGreaterThanOrEqual(TOUCH_TARGET)
    }
    expect(RADIAL_REACH - RADIAL_HOLE).toBeGreaterThanOrEqual(TOUCH_TARGET)
  })
})

describe('radialCenterOnScreen (ticket 1076)', () => {
  const { side, top } = RADIAL_ROOM
  // A 13-inch tablet both ways and a desktop, in the design system's px.
  const screens = [
    { width: 1366, height: 1024 },
    { width: 1024, height: 1366 },
    { width: 1920, height: 1080 },
  ]

  it('keeps 120 from the sides and the bottom and 158 from the top: the reach, float-edge, and the room of the name', () => {
    const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as { layout: { tokens: { name: string; value: string }[] } }
    expect(RADIAL_ROOM.edge).toBe(parseFloat(tokens.layout.tokens.find((token) => token.name === 'float-edge')!.value))
    expect(RADIAL_ROOM).toEqual({ side: 120, top: 158, edge: 12 })
  })

  it.each(screens)('a press with room on every side of a $width × $height screen opens the ring on it, not moved', (screen) => {
    const middle = { x: screen.width / 2, y: screen.height / 2 }
    expect(radialCenterOnScreen(middle, screen, RADIAL_ROOM)).toEqual(middle)
    // The nearest presses that still fit: one px further would move it.
    expect(radialCenterOnScreen({ x: side, y: top }, screen, RADIAL_ROOM)).toEqual({ x: side, y: top })
    expect(radialCenterOnScreen({ x: screen.width - side, y: screen.height - side }, screen, RADIAL_ROOM)).toEqual({ x: screen.width - side, y: screen.height - side })
  })

  it.each(screens)('at an edge of a $width × $height screen it moves straight in from that edge, by the least', (screen) => {
    const middle = { x: screen.width / 2, y: screen.height / 2 }
    expect(radialCenterOnScreen({ x: 3, y: middle.y }, screen, RADIAL_ROOM)).toEqual({ x: side, y: middle.y })
    expect(radialCenterOnScreen({ x: screen.width - 3, y: middle.y }, screen, RADIAL_ROOM)).toEqual({ x: screen.width - side, y: middle.y })
    expect(radialCenterOnScreen({ x: middle.x, y: 3 }, screen, RADIAL_ROOM)).toEqual({ x: middle.x, y: top })
    expect(radialCenterOnScreen({ x: middle.x, y: screen.height - 3 }, screen, RADIAL_ROOM)).toEqual({ x: middle.x, y: screen.height - side })
  })

  it.each(screens)('in a corner of a $width × $height screen it moves in from both edges', (screen) => {
    expect(radialCenterOnScreen({ x: 0, y: 0 }, screen, RADIAL_ROOM)).toEqual({ x: side, y: top })
    expect(radialCenterOnScreen({ x: screen.width, y: 0 }, screen, RADIAL_ROOM)).toEqual({ x: screen.width - side, y: top })
    expect(radialCenterOnScreen({ x: 0, y: screen.height }, screen, RADIAL_ROOM)).toEqual({ x: side, y: screen.height - side })
    expect(radialCenterOnScreen({ x: screen.width, y: screen.height }, screen, RADIAL_ROOM)).toEqual({ x: screen.width - side, y: screen.height - side })
  })

  it("stays inside a box that is not the whole screen, the Homepage demo's (ticket 1114)", () => {
    const box = { left: 300, top: 200, width: 800, height: 500 }
    expect(radialCenterOnScreen({ x: 700, y: 450 }, box, RADIAL_ROOM)).toEqual({ x: 700, y: 450 })
    expect(radialCenterOnScreen({ x: 310, y: 210 }, box, RADIAL_ROOM)).toEqual({ x: 300 + side, y: 200 + top })
    expect(radialCenterOnScreen({ x: 1095, y: 695 }, box, RADIAL_ROOM)).toEqual({ x: 1100 - side, y: 700 - side })
  })

  it('takes its room in the px of the screen, so a larger text size keeps the same rule', () => {
    const room = { side: side * 1.25, top: top * 1.25 }
    expect(radialCenterOnScreen({ x: 0, y: 0 }, { width: 1000, height: 800 }, room)).toEqual({ x: 150, y: 197.5 })
  })

  it('on a screen too small for the ring and its room it stands in the middle', () => {
    expect(radialCenterOnScreen({ x: 10, y: 10 }, { width: 200, height: 250 }, RADIAL_ROOM)).toEqual({ x: 100, y: (top + 250 - side) / 2 })
  })
})

describe('radialNameCenter (ticket 1076)', () => {
  it('a name with room stays over the middle of the ring', () => {
    expect(radialNameCenter(400, 180, 1024, 12)).toBe(400)
    expect(radialNameCenter(120, 216, 1024, 12)).toBe(120)
  })

  it('a long name near a side moves in by the least that keeps it float-edge inside', () => {
    expect(radialNameCenter(120, 280, 1024, 12)).toBe(152)
    expect(radialNameCenter(904, 280, 1024, 12)).toBe(872)
  })
})

describe('radialItemOff (RadialToolbox card, States)', () => {
  const all = { canUndo: true, canRedo: true, recents: ['#111111', '#222222', '#333333'] }
  const off = (state: Parameters<typeof radialItemOff>[1]) => RADIAL_PLACES.map((place) => place.id).filter((id) => radialItemOff(id, state))

  it('nothing is off with steps to undo and redo, and three recent colours', () => {
    expect(off(all)).toEqual([])
  })

  it('Undo and Redo are off with nothing to undo or redo', () => {
    expect(off({ ...all, canUndo: false })).toEqual(['undo'])
    expect(off({ ...all, canRedo: false })).toEqual(['redo'])
  })

  it('a recent colour that does not exist yet is off, in its place', () => {
    expect(off({ ...all, recents: ['#111111'] })).toEqual(['recent-2', 'recent-3'])
  })

  it('Pick color from Canvas and the tools are never off (ticket 1089)', () => {
    expect(off({ canUndo: false, canRedo: false, recents: [] })).toEqual(['recent-1', 'recent-2', 'recent-3', 'redo', 'undo'])
  })
})
