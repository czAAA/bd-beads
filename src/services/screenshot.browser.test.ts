import { describe, expect, it } from 'vitest'
import { SCREENSHOT_MAX_BYTES } from '../domain/feedbackReport'
import { shrinkScreenshot } from './screenshot'

/** A photo-like PNG of `width` × `height`: noise that doesn't compress, so it has to be shrunk. */
async function noisyPhoto(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(width, height)
  for (let at = 0; at < pixels.data.length; at += 4) {
    pixels.data[at] = (at * 7) % 251
    pixels.data[at + 1] = (at * 13) % 241
    pixels.data[at + 2] = (at * 29) % 239
    pixels.data[at + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  const blob = await new Promise<Blob>((done) => canvas.toBlob((made) => done(made!), 'image/png'))
  return new File([blob], 'IMG_1.png', { type: 'image/png' })
}

describe('shrinkScreenshot in a real browser (ticket 1180)', () => {
  it('shrinks a large detailed picture under the cap as a JPEG or WebP, with its longest side at most 1600', async () => {
    const result = await shrinkScreenshot(await noisyPhoto(2400, 1800))
    if (!result.ok) throw new Error(`not shrunk: ${result.reason}`)
    expect(result.size).toBeLessThanOrEqual(SCREENSHOT_MAX_BYTES)
    expect(['image/jpeg', 'image/webp']).toContain(result.screenshot.type)
    const bytes = Uint8Array.from(atob(result.screenshot.data), (char) => char.charCodeAt(0))
    expect(bytes.length).toBe(result.size)
    const image = await createImageBitmap(new Blob([bytes], { type: result.screenshot.type }))
    expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(1600)
  })

  it('says unreadable for a file that is no picture', async () => {
    expect(await shrinkScreenshot(new File(['not a picture'], 'notes.png', { type: 'image/png' }))).toEqual({ ok: false, reason: 'unreadable' })
  })
})
