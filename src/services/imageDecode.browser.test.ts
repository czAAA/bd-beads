import { describe, expect, it } from 'vitest'
import { mountAt } from '../testUtils/browserFit'
import ConvertPageHost from '../testUtils/ConvertPageHost.vue'
import { decodeImageFile } from './imageDecode'

/** A real JPEG of `width` × `height`, the left half red and the right half white, as a camera would hand one over. */
async function photo(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#e63746'
  context.fillRect(0, 0, width / 2, height)
  const blob = await new Promise<Blob>((done) => canvas.toBlob((made) => done(made!), 'image/jpeg', 0.8))
  return new File([blob], 'IMG_2041.jpeg', { type: 'image/jpeg' })
}

// A photo over 16 megapixels is read smaller, never refused (ticket 0931): the real browser decode, a 20 MP JPEG.
describe('a large photo in Convert image', () => {
  it('is read smaller by the real canvas, its colors where they were', async () => {
    const image = await decodeImageFile(await photo(5472, 3648))

    expect(image.width).toBeLessThan(5472)
    const at = (x: number) => {
      const start = (Math.floor(image.height / 2) * image.width + x) * 4
      return [image.data[start]!, image.data[start + 1]!, image.data[start + 2]!]
    }
    expect(at(10)[0]).toBeGreaterThan(200)
    expect(at(10)[1]).toBeLessThan(90)
    expect(at(image.width - 10)).toEqual([255, 255, 255])
  })

  it('gives beads with no error, the size line saying the photo’s own size', async () => {
    const file = await photo(5472, 3648)
    const start = { draft: { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: '', makerName: '' }, file }
    const mounted = await mountAt(ConvertPageHost, { start, decodeImage: decodeImageFile, loadCatalog: async () => undefined, readClipboardImage: async () => undefined }, { locale: 'en', width: 1366 })
    // Not pictureSet: its 1 s is short for a real 20 MP decode on a slow runner.
    for (let tries = 0; tries < 200 && !mounted.root.querySelector('[data-testid="convert-result"]'); tries += 1) await new Promise((done) => setTimeout(done, 25))

    expect(mounted.root.querySelector('[data-testid="convert-image-error"]')).toBeNull()
    expect(mounted.root.querySelector('[data-testid="convert-result"]')).not.toBeNull()
    expect(mounted.root.querySelector('[data-testid="convert-picture-size"]')?.textContent).toBe('5472×3648 px')
  })
})
