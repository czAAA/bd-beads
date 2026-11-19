import { describe, expect, it } from 'vitest'
import { placeWinter, winterShown, type WinterLayout, type WinterRoom } from './winterCharms'

describe('the winter season', () => {
  const day = (month: number, date: number) => new Date(2026, month - 1, date, 12)

  it('runs from 19 November to 13 January, by the device’s date', () => {
    expect(winterShown(day(11, 19), '', false)).toBe(true)
    expect(winterShown(day(11, 30), '', false)).toBe(true)
    expect(winterShown(day(12, 1), '', false)).toBe(true)
    expect(winterShown(day(12, 25), '', false)).toBe(true)
    expect(winterShown(day(1, 1), '', false)).toBe(true)
    expect(winterShown(day(1, 13), '', false)).toBe(true)
  })

  it('is not on 18 November or 14 January, nor the rest of the year', () => {
    expect(winterShown(day(11, 18), '', false)).toBe(false)
    expect(winterShown(day(11, 1), '', false)).toBe(false)
    expect(winterShown(day(1, 14), '', false)).toBe(false)
    expect(winterShown(day(7, 15), '', false)).toBe(false)
  })

  it('is turned on by ?winter in the dev build only', () => {
    expect(winterShown(day(7, 15), '?winter', true)).toBe(true)
    expect(winterShown(day(7, 15), '?lang=en&winter', true)).toBe(true)
    expect(winterShown(day(7, 15), '?winter', false)).toBe(false)
  })
})

describe('placing the winter charms', () => {
  /** A 1920 × 1000 screen with 300px of black either side of the box, a 6px bead, 16px clear, no drift. */
  const room: WinterRoom = {
    width: 1920,
    height: 1000,
    box: { left: 300, right: 1620 },
    drawing: { top: 40, bottom: 960 },
    bead: 6,
    scale: 1.2,
    clear: 16,
    least: 120,
    drift: 0,
    small: { clear: 6, reach: 10, leastBead: 2 },
  }
  /** Charms measured in beads: a 10 × 10 one, a 12 × 12 one, a wide one and a very wide one. */
  const sizes = { small: { width: 10, height: 10 }, square: { width: 12, height: 12 }, wide: { width: 50, height: 10 }, huge: { width: 100, height: 10 } }
  const one = (charm: Partial<WinterLayout['charms'][number]>): WinterLayout => ({
    charms: [{ id: 'small', side: 'left', out: 0.5, down: 0.5, turn: 0, size: 1, ...charm }],
    small: [],
    marks: [],
  })

  it('lays a charm’s middle out across the black beside the box and down the screen, at its bead and angle', () => {
    expect(placeWinter(room, one({ turn: 30 }), sizes).charms).toEqual([{ id: 'small', side: 'left', x: 150, y: 500, bead: 6, turn: 30, over: false }])
    expect(placeWinter(room, one({ side: 'right', out: 0.25, down: 0.2 }), sizes).charms[0]).toMatchObject({ x: 1695, y: 200 })
  })

  it('grows its bead by its own size', () => {
    expect(placeWinter(room, one({ size: 0.5 }), sizes).charms[0]!.bead).toBe(3)
  })

  it('shrinks a charm that doesn’t fit until it lies whole, clear of the box and the screen’s edge', () => {
    // 300px wide in 300px of black: 268px between the two 16px clears.
    expect(placeWinter(room, one({ id: 'wide' }), sizes).charms[0]!.bead).toBeCloseTo((6 * 268) / 300)
  })

  it('counts the charm’s angle in what it needs', () => {
    const narrow = { ...room, box: { left: 120, right: 1800 } }
    expect(placeWinter(narrow, one({ id: 'square' }), sizes).charms[0]!.bead).toBe(6)
    // Turned 45°, the 72px square needs 72√2 across; 88px is left between the clears.
    expect(placeWinter(narrow, one({ id: 'square', turn: 45 }), sizes).charms[0]!.bead).toBeCloseTo((6 * 88) / (72 * Math.SQRT2))
  })

  it('leaves out a charm that would shrink under 0.6 of its size', () => {
    expect(placeWinter(room, one({ id: 'huge' }), sizes).charms).toEqual([])
  })

  it('keeps a charm clear of the top and bottom as it drifts', () => {
    const top = one({ down: 0.05 })
    expect(placeWinter(room, top, sizes).charms[0]!.bead).toBe(6)
    // 50px from the top, 16px clear plus 16px of drift leaves 18px for a 30px half.
    expect(placeWinter({ ...room, drift: 16 }, top, sizes).charms[0]!.bead).toBeCloseTo(6 * 0.6)
  })

  it('has none of the ten under the least black beside the box, but keeps the marks', () => {
    const layout: WinterLayout = { ...one({}), marks: [{ side: 'left', out: 0.5, down: 0.1, size: 100, large: true }] }
    const placed = placeWinter({ ...room, box: { left: 100, right: 1820 } }, layout, sizes)
    expect(placed.charms).toEqual([])
    expect(placed.marks).toEqual([{ side: 'left', x: 50, y: 100, size: 120, large: true }])
  })

  it('puts the ten on the wide black and none of the small ones', () => {
    const layout: WinterLayout = { ...one({}), small: [{ id: 'small', side: 'left', down: 0.5, turn: 0, size: 0.5 }] }
    expect(placeWinter(room, layout, sizes).charms).toEqual([{ id: 'small', side: 'left', x: 150, y: 500, bead: 6, turn: 0, over: false }])
  })

  describe('where the black is narrow, the small ones', () => {
    /** A landscape iPad: 1180 × 820, 27px of black either side, the drawing area from 68 to 729, a 5px bead. */
    const iPad: WinterRoom = { ...room, width: 1180, height: 820, box: { left: 27, right: 1153 }, drawing: { top: 68, bottom: 729 }, bead: 5, scale: 1 }
    const small = (charm: Partial<WinterLayout['small'][number]>): WinterLayout => ({
      charms: [{ id: 'small', side: 'left', out: 0.5, down: 0.5, turn: 0, size: 1 }],
      small: [{ id: 'small', side: 'left', down: 0.5, turn: 0, size: 0.4, ...charm }],
      marks: [],
    })

    it('lie across the box’s edge, from the clear off the screen’s edge to the reach over the box, down the drawing area', () => {
      // Between 6px and 27 + 10 = 37px: the middle at 21.5; halfway down the drawing area at 398.5; a 2px bead.
      expect(placeWinter(iPad, small({}), sizes).charms).toEqual([{ id: 'small', side: 'left', x: 21.5, y: 398.5, bead: 2, turn: 0, over: true }])
      expect(placeWinter(iPad, small({ side: 'right' }), sizes).charms[0]).toMatchObject({ x: 1158.5 })
    })

    it('shrink to fit across, never larger than the ten’s bead times their size', () => {
      // 31px of room for a 10-bead charm: 3.1px, under the 5 × 0.8 = 4px it would be.
      expect(placeWinter(iPad, small({ size: 0.8 }), sizes).charms[0]!.bead).toBeCloseTo(3.1)
    })

    it('keep clear of the Canvas strip and the Progress bar as they drift', () => {
      // 35px under the drawing area's top: 35 − 6 clear − 16 drift leaves 13px for a 10-bead charm's half.
      expect(placeWinter({ ...iPad, drift: 16 }, small({ down: 35 / 661, size: 0.6 }), sizes).charms[0]!.bead).toBeCloseTo(2.6)
    })

    it('are left out under the least bead', () => {
      expect(placeWinter(iPad, small({ id: 'wide' }), sizes).charms).toEqual([])
      expect(placeWinter({ ...iPad, box: { left: 9, right: 1171 } }, small({}), sizes).charms).toEqual([])
    })
  })

  it('places each mark at its place, grown by the Homepage’s scale, whether or not it is cut at the edge', () => {
    const layout: WinterLayout = { charms: [], small: [], marks: [{ side: 'right', out: 0.9, down: 0.7, size: 225, large: true }] }
    expect(placeWinter(room, layout, sizes).marks).toEqual([{ side: 'right', x: 1890, y: 700, size: 270, large: true }])
  })

  it('places the signed-off layout’s ten charms and three marks on a 1920 × 1080 screen', () => {
    const placed = placeWinter({ ...room, height: 1080, box: { left: 204, right: 1716 }, drawing: { top: 68, bottom: 989 }, drift: 16 })
    expect(placed.charms).toHaveLength(10)
    expect(placed.marks).toHaveLength(3)
  })
})
