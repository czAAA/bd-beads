import { describe, expect, it } from 'vitest'
import { pictureKind } from './pictureKind'
import { jpegLike, photoPicture, photoPictureSized, pixelArtPicture, ringPicture, strokePicture, transparentPicture } from '../testUtils/samplerPictures'

// The photo or flat art detector (ticket 0889, ADR 0010), tuned on the sampler's reference suite (ticket 0888).

describe('pictureKind', () => {
  it('reads the suite’s generated photos as a photo, at any size and saved as JPEG', () => {
    expect(pictureKind(photoPicture())).toBe('photo')
    expect(pictureKind(photoPictureSized(800, 600))).toBe('photo')
    expect(pictureKind(jpegLike(photoPictureSized(1000, 500), 90))).toBe('photo')
  })

  it('reads the suite’s pixel art, line art and logo as flat art', () => {
    expect(pictureKind(pixelArtPicture(32))).toBe('flat')
    expect(pictureKind(pixelArtPicture(200))).toBe('flat')
    expect(pictureKind(ringPicture())).toBe('flat')
    expect(pictureKind(strokePicture())).toBe('flat')
    expect(pictureKind(transparentPicture())).toBe('flat')
  })

  it('reads an anti-aliased logo and line art as flat art, though their edges add colors', () => {
    expect(pictureKind(strokePicture({ antialiased: true }))).toBe('flat')
    expect(pictureKind(ringPicture({ antialiased: true, thickness: 1 }))).toBe('flat')
  })

  it('reads flat art saved as JPEG as flat art, though its blocks ring and its edges smear', () => {
    expect(pictureKind(jpegLike(pixelArtPicture(200), 75))).toBe('flat')
    expect(pictureKind(jpegLike(strokePicture({ antialiased: true }), 75))).toBe('flat')
    expect(pictureKind(jpegLike(ringPicture({ size: 200, antialiased: true }), 75))).toBe('flat')
  })
})
