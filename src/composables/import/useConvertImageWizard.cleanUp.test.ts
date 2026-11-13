import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { convertAt, loneBeads, photoPicture, pixelArtPicture, PIXEL_ART, previewBeads, transparentPicture } from '../../testUtils/samplerPictures'
import { useConvertImageWizard } from './useConvertImageWizard'

/** Two pictures opened one after the other in one wizard. */
async function opened(...pictures: PixelData[]) {
  let next = 0
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => pictures[next++]!,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  const open = async () => {
    await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
    wizard.setSource('exact')
    await nextTick()
  }
  await open()
  return { wizard, open }
}

describe('Clean up in the Convert image wizard (ticket 0906)', () => {
  it('opens on at Medium for a photo, with Small colors join at 10, and cleans its lone beads', async () => {
    const wizard = await convertAt(photoPicture(), 60)
    const { cleanUp } = wizard
    expect(cleanUp.on.value).toBe(true)
    expect(cleanUp.strength.value).toBe('medium')
    expect(cleanUp.leastBeads.value).toBe(10)
    expect(cleanUp.lone.value).toBeGreaterThan(0)
    expect(cleanUp.cleaned.value).toBeGreaterThan(0)
    const cleaned = loneBeads(previewBeads(wizard))

    cleanUp.setOn(false)
    await nextTick()
    // Off brings the speckles back at once.
    expect(loneBeads(previewBeads(wizard))).toBeGreaterThan(cleaned)
    expect(cleanUp.cleaned.value).toBe(0)
    expect(cleanUp.changedBeads.value).toBeUndefined()
  })

  it('cleans at least as many beads at Strong as at Light, the found colors still counting every bead', async () => {
    const wizard = await convertAt(photoPicture(), 60)
    const counted = () => wizard.found.value.reduce((sum, color) => sum + color.count, 0)
    const beads = counted()
    wizard.cleanUp.setStrength('light')
    await nextTick()
    const light = wizard.cleanUp.cleaned.value
    wizard.cleanUp.setStrength('strong')
    await nextTick()
    expect(wizard.cleanUp.cleaned.value).toBeGreaterThanOrEqual(light)
    expect(counted()).toBe(beads)
    // The changed beads are those the preview rings.
    expect(wizard.cleanUp.changedBeads.value?.reduce((sum, one) => sum + one, 0)).toBe(wizard.cleanUp.cleaned.value)
  })

  it('opens off for flat art, so pixel art converts bead for bead', async () => {
    const wizard = await convertAt(pixelArtPicture(8 * 6), PIXEL_ART[0]!.length)
    expect(wizard.pictureKind.value).toBe('flat')
    expect(wizard.cleanUp.on.value).toBe(false)
    expect(wizard.cleanUp.flatArt.value).toBe(true)
    expect(wizard.cleanUp.leastBeads.value).toBe(1)
    expect(wizard.cleanUp.lone.value).toBeGreaterThan(0)
    expect(wizard.cleanUp.cleaned.value).toBe(0)
  })

  it('keeps what the person set for that picture, and a new picture opens at its own defaults', async () => {
    const { wizard, open } = await opened(pixelArtPicture(48), photoPicture())
    wizard.cleanUp.setOn(true)
    wizard.cleanUp.setStrength('strong')
    wizard.turn()
    await nextTick()
    expect(wizard.cleanUp.on.value).toBe(true)
    expect(wizard.cleanUp.strength.value).toBe('strong')

    await open()
    expect(wizard.cleanUp.on.value).toBe(true)
    expect(wizard.cleanUp.strength.value).toBe('medium')
    expect(wizard.cleanUp.leastBeads.value).toBe(10)
  })

  it('makes empty, at a tap on a cleaned bead, the color it shows', async () => {
    const wizard = await convertAt(photoPicture(), 60)
    // The whole picture has no margin round it: a lattice bead is the Frame's bead of the same index.
    const index = wizard.cleanUp.changedBeads.value!.indexOf(1)
    const shown = wizard.beadColors.value[index]!
    wizard.toggleEmptyAtBead(index)
    await nextTick()
    expect(wizard.beadColors.value[index]).toBeUndefined()
    expect(wizard.beadColors.value).not.toContain(shown)
  })

  it('steps Small colors join from off to 50', async () => {
    const wizard = await convertAt(photoPicture(), 60)
    wizard.cleanUp.setLeastBeads(0)
    expect(wizard.cleanUp.leastBeads.value).toBe(1)
    wizard.cleanUp.setLeastBeads(80)
    expect(wizard.cleanUp.leastBeads.value).toBe(50)
  })

  it('never fills an empty place, at Strong', async () => {
    const wizard = await convertAt(transparentPicture(), 40)
    wizard.cleanUp.setOn(true)
    wizard.cleanUp.setStrength('strong')
    await nextTick()
    const beads = previewBeads(wizard)
    expect(beads.every((row) => row.slice(0, 20).every((hex) => hex === undefined))).toBe(true)
  })

  it('is no step of Undo and Redo', async () => {
    const wizard = await convertAt(photoPicture(), 60)
    wizard.cleanUp.setOn(false)
    wizard.cleanUp.setLeastBeads(20)
    expect(wizard.canUndo.value).toBe(false)
  })
})
