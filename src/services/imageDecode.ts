import { ImageConversionError, readSize, type DecodeImage } from '../domain/imageConversion'
import type { ImageSize } from '../domain/imageFraming'

// The browser's part of Convert image: decoding PNG/JPEG/GIF/WebP bytes to pixels. Apart from
// domain/imageConversion.ts, whose pure functions are unit-tested, because jsdom decodes no images; callers take a
// `DecodeImage` so a test can pass synthetic pixels.

/** What both decode paths hand back: something drawable, with the size it decoded to. */
export interface DecodedSource {
  drawable: CanvasImageSource
  width: number
  height: number
  release: () => void
}

// Decodes through an `<img>` for browsers without createImageBitmap; the object URL outlives the load and is always
// revoked.
function decodeViaImageElement(file: Blob): Promise<DecodedSource> {
  return new Promise<DecodedSource>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const element = document.createElement('img')

    element.addEventListener('load', () => {
      URL.revokeObjectURL(url)
      resolve({
        drawable: element,
        width: element.naturalWidth,
        height: element.naturalHeight,
        release: () => {},
      })
    })
    element.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new ImageConversionError('decodeFailed'))
    })

    element.src = url
  })
}

/** An animated GIF decodes as its first frame on either path; deliberate, since a Project is a still picture. Also what
 * a reference image is read through (ticket 0790). */
export async function decodeSource(file: Blob): Promise<DecodedSource> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { drawable: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  }
  return decodeViaImageElement(file)
}

/** The pixels of a canvas `size` with the picture drawn over it. A browser without a 2D context can't read pictures at
 * all; one that can't draw or read this canvas is out of memory for it. */
function drawnPixels(drawable: CanvasImageSource, { width, height }: ImageSize): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new ImageConversionError('decodeFailed')
  try {
    context.imageSmoothingQuality = 'high'
    context.drawImage(drawable, 0, 0, width, height)
    return context.getImageData(0, 0, width, height)
  } catch {
    throw new ImageConversionError('tooManyPixels')
  }
}

// Reads a chosen picture's pixels, read smaller past the limit (readSize, ticket 0931) and its own size said then. Format
// and bytes are checked earlier (validateImageFile). Throws only for a picture the browser can't open ('decodeFailed')
// or the device has no memory to draw even smaller ('tooManyPixels').
export const decodeImageFile: DecodeImage = async (file) => {
  let source: DecodedSource
  try {
    source = await decodeSource(file)
  } catch (error) {
    throw error instanceof ImageConversionError ? error : new ImageConversionError('decodeFailed')
  }

  try {
    const { width, height } = source
    if (width === 0 || height === 0) {
      throw new ImageConversionError('decodeFailed')
    }

    const read = readSize({ width, height })
    const pixels = drawnPixels(source.drawable, read)
    const smaller = read.width !== width || read.height !== height
    return { width: read.width, height: read.height, data: pixels.data, ...(smaller && { ownSize: { width, height } }) }
  } finally {
    source.release()
  }
}
