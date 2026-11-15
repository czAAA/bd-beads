import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSize } from '../domain/imageConversion'
import { decodeImageFile } from './imageDecode'

/** A stand-in for what createImageBitmap hands back: jsdom decodes no real image bytes (see imageDecode.ts). */
function fakeBitmap(width: number, height: number) {
  return { width, height, close: vi.fn() }
}

/** A 2D context handing back `pixels`, or a blank canvas-sized picture for none; undefined gives no context at all. */
function stubCanvas(pixels: number[] | undefined) {
  const drawImage = vi.fn()
  const getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => ({ data: pixels?.length ? new Uint8ClampedArray(pixels) : new Uint8ClampedArray(width * height * 4) }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    pixels === undefined ? null : ({ drawImage, getImageData } as unknown as CanvasRenderingContext2D),
  )
  return { drawImage, getImageData }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('decodeImageFile', () => {
  it('hands back the decoded picture pixel data', async () => {
    const bitmap = fakeBitmap(2, 1)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const canvas = stubCanvas([1, 2, 3, 255, 4, 5, 6, 255])

    const image = await decodeImageFile(new Blob(['not really a png'], { type: 'image/png' }))

    expect(image).toEqual({ width: 2, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]) })
    // One draw of one bitmap: an animated GIF is decoded as its first frame, which is what gets converted.
    expect(canvas.drawImage).toHaveBeenCalledTimes(1)
    expect(canvas.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2, 1)
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('reads a 20 MP photo smaller, within the limit, and says its own size (ticket 0931)', async () => {
    const bitmap = fakeBitmap(5472, 3648)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const canvas = stubCanvas([])

    const image = await decodeImageFile(new Blob([], { type: 'image/jpeg' }))

    expect(image.ownSize).toEqual({ width: 5472, height: 3648 })
    expect([image.width, image.height]).toEqual([readSize(bitmap).width, readSize(bitmap).height])
    expect(image.data).toHaveLength(image.width * image.height * 4)
    expect(canvas.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, image.width, image.height)
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('says a picture the device has no memory to draw even smaller has too many pixels', async () => {
    const bitmap = fakeBitmap(8064, 6048)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const canvas = stubCanvas([])
    canvas.getImageData.mockImplementation(() => {
      throw new RangeError('out of memory')
    })

    await expect(decodeImageFile(new Blob([], { type: 'image/jpeg' }))).rejects.toMatchObject({ reason: 'tooManyPixels' })
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('reports a corrupt or undecodable file as a decode failure', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('broken')))

    await expect(decodeImageFile(new Blob(['rubbish'], { type: 'image/png' }))).rejects.toMatchObject({
      reason: 'decodeFailed',
    })
  })

  it('reports an empty picture as a decode failure', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(0, 0)))

    await expect(decodeImageFile(new Blob([], { type: 'image/png' }))).rejects.toMatchObject({
      reason: 'decodeFailed',
    })
  })

  it('reports a browser that will not give a 2D context as a decode failure', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fakeBitmap(2, 2)))
    stubCanvas(undefined)

    await expect(decodeImageFile(new Blob([], { type: 'image/png' }))).rejects.toMatchObject({
      reason: 'decodeFailed',
    })
  })

  it('falls back to an image element where createImageBitmap is missing', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    })
    const canvas = stubCanvas([9, 9, 9, 255])

    // jsdom never loads the src, so the element's own load event is what a test has to supply.
    const created: HTMLImageElement[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = realCreateElement(tag) as HTMLElement
      if (tag === 'img') {
        created.push(element as HTMLImageElement)
      }
      return element
    })

    const decoding = decodeImageFile(new Blob([], { type: 'image/png' }))
    await vi.waitFor(() => expect(created).toHaveLength(1))
    const element = created[0]!
    Object.defineProperty(element, 'naturalWidth', { value: 1 })
    Object.defineProperty(element, 'naturalHeight', { value: 1 })
    element.dispatchEvent(new Event('load'))

    await expect(decoding).resolves.toEqual({ width: 1, height: 1, data: new Uint8ClampedArray([9, 9, 9, 255]) })
    expect(canvas.drawImage).toHaveBeenCalledWith(element, 0, 0, 1, 1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('reports an image element that fails to load as a decode failure', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })

    const created: HTMLImageElement[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = realCreateElement(tag) as HTMLElement
      if (tag === 'img') {
        created.push(element as HTMLImageElement)
      }
      return element
    })

    const decoding = decodeImageFile(new Blob([], { type: 'image/png' }))
    await vi.waitFor(() => expect(created).toHaveLength(1))
    created[0]!.dispatchEvent(new Event('error'))

    await expect(decoding).rejects.toMatchObject({ reason: 'decodeFailed' })
  })
})
