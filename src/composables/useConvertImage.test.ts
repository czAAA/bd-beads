import { describe, expect, it } from 'vitest'
import { useConvertImage } from './useConvertImage'
import {
  DEFAULT_MAX_IMAGE_COLORS,
  MAX_IMAGE_COLORS,
  MIN_IMAGE_COLORS,
  type PixelData,
} from '../domain/imageConversion'
import { CENTERED_PAN, CONVERT_MAX_ZOOM, CONVERT_MIN_ZOOM } from '../domain/imageFraming'

const image: PixelData = { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) }

describe('useConvertImage', () => {
  it('is not framing until a picture is handed over', () => {
    const state = useConvertImage()

    expect(state.isFraming.value).toBe(false)

    state.start(image)

    expect(state.isFraming.value).toBe(true)
    expect(state.image.value).toBe(image)
  })

  it('starts at the scale that covers the frame, centred', () => {
    const state = useConvertImage()
    state.start(image)

    expect(state.zoom.value).toBe(CONVERT_MIN_ZOOM)
    expect(state.zoomPercent.value).toBe(100)
    expect(state.pan.value).toEqual(CENTERED_PAN)
    expect(state.maxColors.value).toBe(DEFAULT_MAX_IMAGE_COLORS)
  })

  it('zooms within 100% to 800%', () => {
    const state = useConvertImage()
    state.start(image)

    state.zoomOut()
    expect(state.zoom.value).toBe(CONVERT_MIN_ZOOM)

    state.zoomIn()
    expect(state.zoomPercent.value).toBe(125)

    for (let step = 0; step < 100; step += 1) {
      state.zoomIn()
    }
    expect(state.zoom.value).toBe(CONVERT_MAX_ZOOM)
  })

  it('puts the picture back where it started on reset, without leaving framing', () => {
    const state = useConvertImage()
    state.start(image)

    state.zoomIn()
    state.setPan({ x: 0.1, y: 0.9 })
    state.resetZoom()

    expect(state.zoom.value).toBe(CONVERT_MIN_ZOOM)
    expect(state.pan.value).toEqual(CENTERED_PAN)
    expect(state.isFraming.value).toBe(true)
  })

  it('keeps the colour count inside its range', () => {
    const state = useConvertImage()
    state.start(image)

    state.setMaxColors(0)
    expect(state.maxColors.value).toBe(MIN_IMAGE_COLORS)

    state.setMaxColors(1000)
    expect(state.maxColors.value).toBe(MAX_IMAGE_COLORS)
  })

  it('keeps nothing on cancel, so re-entering starts from a clean slate', () => {
    const state = useConvertImage()
    state.start(image)
    state.zoomIn()
    state.setPan({ x: 0, y: 0 })
    state.setMaxColors(3)

    state.cancel()

    expect(state.isFraming.value).toBe(false)
    expect(state.image.value).toBeUndefined()

    state.start(image)

    expect(state.zoom.value).toBe(CONVERT_MIN_ZOOM)
    expect(state.pan.value).toEqual(CENTERED_PAN)
    expect(state.maxColors.value).toBe(DEFAULT_MAX_IMAGE_COLORS)
  })
})
