import { describe, expect, it } from 'vitest'
import { mountAt, resizeTo } from '../../testUtils/browserFit'
import { byTestid, hitAreaProblems, roundCornerInset } from '../../testUtils/hitAreas'
import { tokenPx } from '../../testUtils/tokenPx'
import { RADIAL_HOLE, RADIAL_PLACES, RADIAL_REACH, RADIAL_ROOM, radialCenterOnScreen, radialItemAt } from '../../domain/radialToolbox'
import RadialToolbox from './RadialToolbox.vue'

// What only a real browser knows about the Radial toolbox (ticket 1064): where each item answers a press, that the
// hole lets a press through, and that the ring and its name fit a phone.

const CENTER = { x: 195, y: 400 }
const props = { open: true, center: CENTER, activeTool: 'paint', canUndo: true, canRedo: true, recents: ['#1f77b4', '#2ca02c', '#ff7f0e'], beadHex: '#e63746' }
const ITEMS = RADIAL_PLACES.map((place) => `radial-${place.id}`)

/** The item whose control answers a press at a point of the screen. */
const itemAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-radial-item]')?.dataset.radialItem

describe('RadialToolbox in a browser (ticket 1064)', () => {
  it('gives every item a touch-target hit area that lies over no other (ticket 0962)', async () => {
    const { root } = await mountAt(RadialToolbox, props, { locale: 'en', width: 1280, text: false })
    // A tile's corners are round (`radius-lg`): its own drawing starts where they cross its box's diagonal.
    expect(hitAreaProblems(byTestid(root, ITEMS), tokenPx(document.body, '--touch-target'), roundCornerInset(tokenPx(document.body, '--radius-lg')))).toEqual([])
  })

  it('answers a press where the ring\'s rule says, all over the band, and nowhere in the hole or beyond the ring', async () => {
    await mountAt(RadialToolbox, props, { locale: 'en', width: 1280, text: false })
    const scale = tokenPx(document.body, '--radial-radius') / ((RADIAL_HOLE + RADIAL_REACH) / 2)
    const [hole, reach] = [RADIAL_HOLE * scale, RADIAL_REACH * scale]
    const wrong: string[] = []
    // Every 3°, off the slices' edges, which are whole degrees: a pixel there may round to either side.
    for (let angle = 1.5; angle < 360; angle += 3) {
      const radians = (angle * Math.PI) / 180
      const at = (distance: number) => ({ x: distance * Math.sin(radians), y: -distance * Math.cos(radians) })
      for (const distance of [hole + 3, (hole + reach) / 2, reach - 3]) {
        const point = at(distance)
        const answers = itemAt(CENTER.x + point.x, CENTER.y + point.y)
        if (answers !== radialItemAt(point, hole)) wrong.push(`${angle}° at ${Math.round(distance)}px: ${answers}, not ${radialItemAt(point, hole)}`)
      }
      for (const distance of [0, hole - 3, reach + 3]) {
        const point = at(distance)
        const answers = itemAt(CENTER.x + point.x, CENTER.y + point.y)
        if (answers !== undefined) wrong.push(`${angle}° at ${Math.round(distance)}px: ${answers} answers off the band`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('fits a 390px phone with the name of the item under the pointer over it, in the longest language', async () => {
    const { root } = await mountAt(RadialToolbox, { ...props, held: 'pick-color' }, { locale: 'longest', width: 390 })
    const ring = root.querySelector('[data-testid="radial-toolbox"]')!.getBoundingClientRect()
    const name = root.querySelector('[data-testid="radial-name"]')!.getBoundingClientRect()
    expect(Math.round(ring.width)).toBe(tokenPx(document.body, '--radial-radius') * 2 + tokenPx(document.body, '--pill-thickness'))
    expect([ring.left >= 0, ring.right <= window.innerWidth]).toEqual([true, true])
    expect([name.left >= 0, name.right <= window.innerWidth, name.top >= 0]).toEqual([true, true, true])
    // Centred over the ring, `space-8` above its outer edge.
    expect(Math.abs(name.left + name.width / 2 - CENTER.x)).toBeLessThanOrEqual(1)
    expect(Math.round(ring.top - name.bottom)).toBe(tokenPx(document.body, '--space-8'))
  })

  it('casts the Lifted piece\'s shadow as a filter and stands at the popover layer', async () => {
    const { root } = await mountAt(RadialToolbox, props, { locale: 'en', width: 1280, text: false })
    const band = getComputedStyle(root.querySelector('.radial-toolbox__band')!)
    expect(band.filter).toMatch(/^drop-shadow\(.+\) drop-shadow\(.+\)$/)
    expect(getComputedStyle(root.querySelector('[data-testid="radial-toolbox"]')!).zIndex).toBe(getComputedStyle(document.documentElement).getPropertyValue('--z-popover').trim())
  })
})

describe('RadialToolbox near a screen edge (ticket 1076)', () => {
  /** What of the ring opened for a press at `pressed` is nearer than `float-edge` to the screen's edge, or off it. */
  async function offScreen(pressed: { x: number; y: number }, width: number): Promise<string[]> {
    const edge = tokenPx(document.body, '--float-edge')
    const scale = edge / RADIAL_ROOM.edge
    const screen = { width: window.innerWidth, height: window.innerHeight }
    const center = radialCenterOnScreen(pressed, screen, { side: RADIAL_ROOM.side * scale, top: RADIAL_ROOM.top * scale })
    // The item with the longest name: Pick color from Canvas with the bead's hex after it.
    const moved = await mountAt(RadialToolbox, { ...props, center, held: 'pick-color' }, { locale: 'longest', width })
    const problems: string[] = []
    for (const part of ['radial-toolbox', 'radial-name']) {
      const box = moved.root.querySelector(`[data-testid="${part}"]`)!.getBoundingClientRect()
      const room = { left: box.left, top: box.top, right: screen.width - box.right, bottom: screen.height - box.bottom }
      // To the px: the name's line is a fraction of one taller than the 30 its room is counted with.
      for (const [side, left] of Object.entries(room)) if (left < edge - 1) problems.push(`${part} is ${left.toFixed(1)}px from the ${side}`)
    }
    // Every item is still in its place round the centre.
    const pick = moved.root.querySelector('[data-testid="radial-tool-erase"]')!.getBoundingClientRect()
    const erase = RADIAL_PLACES.find((place) => place.id === 'tool-erase')!
    const radius = tokenPx(document.body, '--radial-radius')
    const wanted = { x: center.x + radius * Math.sin((erase.angle * Math.PI) / 180), y: center.y - radius * Math.cos((erase.angle * Math.PI) / 180) }
    if (Math.hypot(pick.left + pick.width / 2 - wanted.x, pick.top + pick.height / 2 - wanted.y) > 1) problems.push('Eraser is not in its place')
    moved.unmount()
    return problems
  }

  // A 13-inch tablet's two widths and a desktop's.
  it.each([1024, 1366, 1920])('at each edge and in each corner of a %ipx wide screen the whole ring and its name are float-edge inside', async (width) => {
    const found: Record<string, string[]> = {}
    for (const x of [0, 0.5, 1]) {
      for (const y of [0, 0.5, 1]) {
        await resizeTo(width)
        const problems = await offScreen({ x: x * window.innerWidth, y: y * window.innerHeight }, width)
        if (problems.length > 0) found[`${x}, ${y}`] = problems
      }
    }
    expect(found).toEqual({})
  })

  it('a name with no room to stay centred is moved by the least: it stands float-edge in at the left and the right', async () => {
    await resizeTo(1024)
    const edge = tokenPx(document.body, '--float-edge')
    // The ring itself is not this component's to place: nearer a side than the flow would put it, the name must move.
    const nameAt = async (x: number) => {
      const { root, unmount } = await mountAt(RadialToolbox, { ...props, center: { x, y: 400 }, held: 'pick-color' }, { locale: 'longest', width: 1024 })
      const box = root.querySelector('[data-testid="radial-name"]')!.getBoundingClientRect()
      unmount()
      return box
    }
    const [left, middle, right] = [await nameAt(60), await nameAt(512), await nameAt(1024 - 60)]
    expect(Math.abs(middle.left + middle.width / 2 - 512)).toBeLessThanOrEqual(1)
    expect(Math.abs(left.left - edge)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(1024 - right.right - edge)).toBeLessThanOrEqual(0.5)
  })
})
