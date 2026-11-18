import { describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import { byTestid, expectTouchScreen, hitAreaProblems, roundCornerInset } from '../../testUtils/hitAreas'
import { tokenPx } from '../../testUtils/tokenPx'
import { RADIAL_PLACES } from '../../domain/radialToolbox'
import RadialToolbox from './RadialToolbox.vue'

// On touch every item of the Radial toolbox takes a finger (tickets 0962, 1064): its slice is its hit area, and the
// square touch pad every control gets there does not reach into a neighbour's.
describe('RadialToolbox hit areas on touch (ticket 1064)', () => {
  it('gives every item a touch-target hit area that lies over no other', async () => {
    expectTouchScreen()
    const props = { open: true, center: { x: 195, y: 400 }, activeTool: 'paint', canUndo: true, canRedo: false, recents: ['#1f77b4'] }
    const { root } = await mountAt(RadialToolbox, props, { locale: 'en', width: 390, text: false })
    const tiles = byTestid(root, RADIAL_PLACES.map((place) => `radial-${place.id}`))
    // A tile's corners are round (`radius-lg`): its own drawing starts where they cross its box's diagonal.
    expect(hitAreaProblems(tiles, tokenPx(document.body, '--touch-target'), roundCornerInset(tokenPx(document.body, '--radius-lg')))).toEqual([])
  })
})
