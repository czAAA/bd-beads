import { describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import { byTestid, hitAreaProblems, roundCornerInset } from '../../testUtils/hitAreas'
import { tokenPx } from '../../testUtils/tokenPx'
import { RADIAL_HOLE, RADIAL_PLACES, RADIAL_REACH, radialItemAt } from '../../domain/radialToolbox'
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
