import { ImageConversionError, validateImagePixelCount, type DecodeImage } from '../domain/imageConversion'

// The browser's part of Convert image: decoding PNG/JPEG/GIF/WebP bytes to pixels. Apart from
// domain/imageConversion.ts, whose pure functions are unit-tested, because jsdom decodes no images; callers take a
// `DecodeImage` so a test can pass synthetic pixels.

/** What both decode paths hand back: something drawable, with the size it decoded to. */
interface DecodedSource {
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

/** An animated GIF decodes as its first frame on either path; deliberate, since a Project is a still picture. */
async function decodeSource(file: Blob): Promise<DecodedSource> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { drawable: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  }
  return decodeViaImageElement(file)
}

// Reads a chosen picture's pixels, throwing an ImageConversionError if undecodable or past the resolution limit. Format
// and size are checked earlier (validateImageFile); the real dimensions first become known here, so the resolution
// limit is enforced here.
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
