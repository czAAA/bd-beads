import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RADIAL_DIVIDERS, RADIAL_HOLE, RADIAL_PLACES, RADIAL_REACH, RADIAL_RING, radialItemAt, radialSliceOutline } from './radialToolbox'
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
