import { ImageConversionError, validateImageFile, validateImagePixelCount } from '../domain/imageConversion'
import type { ReferencePicture } from '../domain/referenceImage'
import { decodeSource } from './imageDecode'

// A reference image's picture in the browser (ADR 0089, ticket 0790): a picked file checked as Convert image checks it,
// then made smaller to be kept, and a kept picture decoded to be drawn. jsdom decodes no images, so the flow takes these
// as dependencies and a test hands in its own.

/** A picture made ready to keep: its bytes and what the Project records of them. */
export interface PreparedPicture {
  blob: Blob
  picture: ReferencePicture
}

/** A kept picture decoded: what the canvas draws, the address the Project panel's thumbnail shows, and its release. */
export interface DrawablePicture {
  image: CanvasImageSource
  url: string
  release: () => void
}

/** The longest side a stored picture has, and the most bytes it takes (ReferenceImage card). */
const MAX_SIDE_PX = 2048
const MAX_STORED_BYTES = 1024 * 1024
/** The qualities a lossy picture is tried at, best first, before it is made smaller. */
const QUALITIES = [0.9, 0.8, 0.7, 0.6]
/** Each further try is this much smaller, down to `MIN_SIDE_PX`. */
const STEP_DOWN = 0.8
const MIN_SIDE_PX = 64

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Whether any pixel of the drawn picture lets the Canvas through: such a picture is kept as WebP or PNG, never JPEG. */
function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = context.getImageData(0, 0, width, height)
  for (let at = 3; at < data.length; at += 4) if (data[at]! < 255) return true
  return false
}

/** The smallest of the tries at one size within the byte cap, or the last one where none is. */
async function encoded(canvas: HTMLCanvasElement, transparent: boolean): Promise<Blob | null> {
  let last: Blob | null = null
  for (const quality of QUALITIES) {
    last = await canvasBlob(canvas, 'image/webp', quality)
    // A browser that can't write WebP writes PNG instead: fall back to JPEG for an opaque picture.
    if (!last || last.type !== 'image/webp') break
    if (last.size <= MAX_STORED_BYTES) return last
  }
  if (last?.type === 'image/webp') return last
  if (transparent) return canvasBlob(canvas, 'image/png')
  for (const quality of QUALITIES) {
    last = await canvasBlob(canvas, 'image/jpeg', quality)
    if (!last || last.size <= MAX_STORED_BYTES) return last
  }
  return last
}

/** A picked picture made ready to keep (ReferenceImage card): refused as Convert image refuses one (ImageConversionError),
 * else drawn at most 2048 px on its longest side, WebP where the browser writes it (else JPEG, PNG with transparency),
 * stepped down until it is at most 1 MB. */
export async function preparePicture(file: File): Promise<PreparedPicture> {
  const rejection = validateImageFile(file)
  if (rejection) throw new ImageConversionError(rejection)
  const source = await decodeSource(file).catch(() => {
    throw new ImageConversionError('decodeFailed')
  })
  try {
    if (source.width === 0 || source.height === 0) throw new ImageConversionError('decodeFailed')
    const tooMany = validateImagePixelCount(source)
    if (tooMany) throw new ImageConversionError(tooMany)
    let scale = Math.min(1, MAX_SIDE_PX / Math.max(source.width, source.height))
    let transparent: boolean | undefined
    for (;;) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(source.width * scale))
      canvas.height = Math.max(1, Math.round(source.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new ImageConversionError('decodeFailed')
      context.drawImage(source.drawable, 0, 0, canvas.width, canvas.height)
      transparent ??= hasTransparency(context, canvas.width, canvas.height)
      const blob = await encoded(canvas, transparent)
      if (!blob) throw new ImageConversionError('decodeFailed')
      if (blob.size <= MAX_STORED_BYTES || Math.max(canvas.width, canvas.height) * STEP_DOWN < MIN_SIDE_PX) {
        return { blob, picture: { name: file.name, type: blob.type, width: canvas.width, height: canvas.height, bytes: blob.size } }
      }
      scale *= STEP_DOWN
    }
  } finally {
    source.release()
  }
}

/** A kept picture decoded for the canvas and the thumbnail. */
export async function drawablePicture(blob: Blob): Promise<DrawablePicture> {
  const source = await decodeSource(blob)
  const url = URL.createObjectURL(blob)
  return {
    image: source.drawable,
    url,
    release: () => {
      source.release()
      URL.revokeObjectURL(url)
    },
  }
}
