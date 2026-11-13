import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { convertAt, photoPicture } from '../../testUtils/samplerPictures'

describe('The Colors neighbours in the Convert image wizard (ticket 0904)', () => {
  it('converts the picture at another number of colors exactly as the page would at that number', async () => {
    const wizard = await convertAt(photoPicture(), 60)
    wizard.setMaxColors(2)
    await nextTick()
    const fewer = wizard.beadsAtColors(1)
    const more = wizard.beadsAtColors(3)
    const shown = wizard.canvasGrid()

    wizard.setMaxColors(1)
    await nextTick()
    expect(fewer).toEqual(wizard.canvasGrid())
    wizard.setMaxColors(3)
    await nextTick()
    expect(more).toEqual(wizard.canvasGrid())
    expect(fewer).not.toEqual(shown)
  })

  it('follows Clean up as the page does', async () => {
    const wizard = await convertAt(photoPicture(), 60)
    wizard.cleanUp.setOn(false)
    await nextTick()
    const unclean = wizard.beadsAtColors(8)
    wizard.setMaxColors(8)
    await nextTick()
    expect(unclean).toEqual(wizard.canvasGrid())
  })
})
