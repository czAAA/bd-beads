import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { channelsOf, luma, toHex } from '../../domain/color'
import type { PixelData } from '../../domain/imageConversion'
import { convertAt, drawPicture, PIXEL_ART, PIXEL_ART_PALETTE, pixelArtPicture, previewBeads } from '../../testUtils/samplerPictures'
import { useConvertImageWizard } from './useConvertImageWizard'

/** A dim street at night: a near-black sky over dim, warm-lit walls and windows. */
const nightPicture = (): PixelData =>
  drawPicture(60, 60, (x, y) => (y < 24 ? [6, 6, 12] : (x >> 3) % 2 ? [70, 50, 25] : [30 + (y >> 2), 24, 18]))
const lightness = (beads: readonly (readonly (string | undefined)[])[]) => {
  const hexes = beads.flat().filter((hex): hex is string => !!hex)
  return hexes.reduce((sum, hex) => sum + luma(channelsOf(hex)), 0) / hexes.length
}

describe('Auto-fix lighting in the Convert image wizard (ticket 0907)', () => {
  it('opens off for a dark picture; on lightens its beads at once and off puts them back exactly', async () => {
    const wizard = await convertAt(nightPicture(), 30)
    expect(wizard.lighting.on.value).toBe(false)
    const before = previewBeads(wizard)
    const foundBefore = wizard.found.value.map((color) => [color.pictureHex, color.count])

    wizard.lighting.setOn(true)
    await nextTick()
    const lit = previewBeads(wizard)
    expect(lightness(lit)).toBeGreaterThan(lightness(before) * 1.5)
    // The found colors and counts follow the lit beads.
    expect(wizard.found.value.map((color) => color.pictureHex)).not.toEqual(foundBefore.map(([hex]) => hex))
    expect(wizard.found.value.reduce((sum, color) => sum + color.count, 0)).toBe(30 * 30)

    wizard.lighting.setOn(false)
    await nextTick()
    expect(previewBeads(wizard)).toEqual(before)
    expect(wizard.found.value.map((color) => [color.pictureHex, color.count])).toEqual(foundBefore)
  })

  it('opens off for pixel art, which keeps its own colors bead for bead, and off again after on', async () => {
    const wizard = await convertAt(pixelArtPicture(8 * 6), PIXEL_ART[0]!.length)
    expect(wizard.lighting.on.value).toBe(false)
    const own = new Set(PIXEL_ART_PALETTE.map(toHex))
    const before = previewBeads(wizard)
    expect(before.flat().every((hex) => own.has(hex!))).toBe(true)
    wizard.lighting.setOn(true)
    await nextTick()
    wizard.lighting.setOn(false)
    await nextTick()
    expect(previewBeads(wizard)).toEqual(before)
  })

  it('works with the background found and removed, a removed background staying empty', async () => {
    const wizard = await convertAt(nightPicture(), 30)
    wizard.setRemoveBackground(true)
    wizard.removeFound()
    await nextTick()
    const empty = (beads: readonly (readonly (string | undefined)[])[]) => beads.flat().filter((hex) => hex === undefined).length
    const emptyOff = empty(previewBeads(wizard))
    expect(emptyOff).toBeGreaterThan(0)
    wizard.lighting.setOn(true)
    await nextTick()
    // The sky is still found and removed on the lit beads; nothing removed is filled again.
    expect(empty(previewBeads(wizard))).toBe(emptyOff)
    expect(wizard.found.value.reduce((sum, color) => sum + color.count, 0)).toBe(30 * 30 - emptyOff)
  })

  it('is not remembered: a new picture opens with it off', async () => {
    const pictures = [nightPicture(), nightPicture()]
    let next = 0
    const wizard = effectScope().run(() =>
      useConvertImageWizard({
        start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
        decodeImage: async () => pictures[next++]!,
        loadCatalog: () => Promise.reject(new Error('no catalog')),
      }),
    )!
    await wizard.setFile(new File(['x'], 'night.png', { type: 'image/png' }))
    wizard.lighting.setOn(true)
    await wizard.setFile(new File(['x'], 'night.png', { type: 'image/png' }))
    expect(wizard.lighting.on.value).toBe(false)
  })
})
