import { describe, expect, it } from 'vitest'
import { beadSampler } from './beadSampler'
import { NO_COLOR, pixelPackedAt, type PixelData } from './imageConversion'
import { drawPicture, type Rgba } from '../testUtils/samplerPictures'

// The sampler's rule on one bead at a time (ticket 0888). The reference suite (useConvertImageWizard.sampling.test.ts)
// checks what whole pictures come out as through the wizard.

const RED: Rgba = [200, 0, 0]
const WHITE: Rgba = [255, 255, 255]
const BLACK: Rgba = [15, 15, 15]
const GREY: Rgba = [135, 135, 135]
const CLEAR: Rgba = [0, 0, 0, 0]

/** The color of the one bead `per` pixels across whose cell is the whole picture. */
function beadOf(picture: PixelData, per = picture.width): number {
  const read = beadSampler(picture, { x: per, y: per }, (x, y) => pixelPackedAt(picture, x, y), NO_COLOR)
  return read(picture.width / 2, picture.height / 2)
}

const hex = (rgb: Rgba) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]

describe('beadSampler', () => {
  it('takes the color most of the bead has, not its centre pixel', () => {
    const picture = drawPicture(6, 6, (x, y) => (x === 3 && y === 3 ? WHITE : RED))

    expect(beadOf(picture)).toBe(hex(RED))
  })

  it('leaves out a pixel only partly inside the bead', () => {
    // A bead 4.5 px across round the middle of 6 px: the outer ring of pixels is cut, the inner 4 × 4 decides.
    const picture = drawPicture(6, 6, (x, y) => (x === 0 || y === 0 || x === 5 || y === 5 ? WHITE : RED))

    expect(beadOf(picture, 4.5)).toBe(hex(RED))
  })

  it('makes no bead where most of it is transparent', () => {
    const picture = drawPicture(6, 6, (x) => (x < 4 ? CLEAR : RED))

    expect(beadOf(picture)).toBe(NO_COLOR)
  })

  it('lets a thin, strongly contrasting line through the bead win over its ground', () => {
    // A 1 px black line down the middle of a white field, a bead 6 px across among its neighbours.
    const picture = drawPicture(18, 18, (x) => (x === 8 ? BLACK : WHITE))

    expect(beadOf(picture, 6)).toBe(hex(BLACK))
  })

  it('keeps the ground where the contrasting color is a region, not a line', () => {
    // The right third is black: an edge, with nothing beyond it on its other side.
    const picture = drawPicture(18, 18, (x) => (x >= 10 ? BLACK : WHITE))

    expect(beadOf(picture, 6)).toBe(hex(WHITE))
  })

  it('counts a blend between two colors toward the nearer one, so no grey bead', () => {
    // One column each of white, a half-covered grey and black: the grey votes white, which then has most.
    const picture = drawPicture(3, 3, (x) => [WHITE, GREY, BLACK][x]!)

    expect(beadOf(picture)).toBe(hex(WHITE))
  })
})
