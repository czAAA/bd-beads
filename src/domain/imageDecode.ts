import { validateImagePixelCount, type ImageRejection, type PixelData } from './imageConversion'

/**
 * The one part of Convert image that is the browser's job rather than this app's: turning a chosen file's PNG/JPEG/
 * GIF/WebP bytes into pixels. Kept apart from imageConversion.ts on purpose — everything there is a pure function over
 * already-decoded pixel data and is unit-tested as such, while this is a thin adapter over browser APIs that only a
 * real browser implements (jsdom decodes no image bytes and paints no canvas).
 *
 * Callers take it as a `DecodeImage`, so a test can hand over synthetic pixel data instead.
 */

/** How a picture is turned into pixels. The real one is decodeImageFile; a test supplies its own. */
export type DecodeImage = (file: Blob) => Promise<PixelData>

/** A file that can't be converted, carrying which of the localised reasons to show (see ImageRejection). */
export class ImageConversionError extends Error {
  readonly reason: ImageRejection

  constructor(reason: ImageRejection) {
    super(`Image cannot be converted: ${reason}`)
    this.name = 'ImageConversionError'
    this.reason = reason
  }
}

/** What both decode paths hand back: something drawable, with the size it decoded to. */
interface DecodedSource {
  drawable: CanvasImageSource
  width: number
  height: number
  release: () => void
}

/**
 * Decodes through an `<img>` element, for a browser without createImageBitmap. The object URL has to outlive the load,
 * and is revoked either way so a refused picture doesn't leak one.
 */
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

/**
 * An animated GIF decodes as its first frame here, whichever path runs: createImageBitmap produces one bitmap, and an
 * `<img>` drawn to a canvas paints whatever frame it is showing, which is the first one at load. That is deliberate —
 * a Pattern is a still picture, so there is nothing an animation's later frames could become.
 */
async function decodeSource(file: Blob): Promise<DecodedSource> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { drawable: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  }
  return decodeViaImageElement(file)
}

/**
 * Reads a chosen picture's pixels, throwing an ImageConversionError for a file the browser can't decode or one past
 * the resolution limit. File format and file size are checked before this is ever reached (see validateImageFile) —
 * this is where a picture's real dimensions first become known, so the resolution limit is enforced here, before the
 * pixels are read out.
 */
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

    const rejection = validateImagePixelCount({ width, height })
    if (rejection) {
      throw new ImageConversionError(rejection)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new ImageConversionError('decodeFailed')
    }

    context.drawImage(source.drawable, 0, 0)
    return { width, height, data: context.getImageData(0, 0, width, height).data }
  } finally {
    source.release()
  }
}
