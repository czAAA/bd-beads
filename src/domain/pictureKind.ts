import { ALPHA_THRESHOLD, type PixelData } from './imageConversion'

/** What a picture is to the converter (ADR 0010, decision D-2; ticket 0889): a photograph or flat art. It sets defaults
 * and nothing else: Width opens at 60 for a photo and on a mark for flat art, and Clean up stray beads (ticket 0906). */
export type PictureKind = 'photo' | 'flat'

/** The most colors flat art has, counted as pictureKind counts them; a picture with more is a photo. Tuned on the
 * sampler's reference suite (ticket 0888): its flat pictures saved as JPEG have up to about 100, its photos 145 or more. */
const FLAT_ART_MOST_COLORS = 120

/** Bits kept of each channel, so a JPEG's or a gradient edge's near-equal shades count as one color. */
const CHANNEL_BITS = 5
/** A color counts only where it holds this share of the opaque pixels, and at least LEAST_PIXELS: the stray shades of
 * anti-aliased edges and JPEG blocks are each too few to count, a photo's many shades are not. */
const LEAST_SHARE = 1 / 2000
const LEAST_PIXELS = 3

/** Whether a picture is a photo or flat art (ticket 0889), by how many distinct colors it has: those, at five bits a
 * channel, that each hold enough of its opaque pixels. More than FLAT_ART_MOST_COLORS is a photo. */
export function pictureKind(image: PixelData): PictureKind {
  const drop = 8 - CHANNEL_BITS
  const counts = new Uint32Array(1 << (CHANNEL_BITS * 3))
  let opaque = 0
  for (let at = 0; at < image.data.length; at += 4) {
    // A pixel too transparent to weave is not counted.
    if (image.data[at + 3]! < ALPHA_THRESHOLD) continue
    opaque += 1
    counts[((image.data[at]! >> drop) << (CHANNEL_BITS * 2)) | ((image.data[at + 1]! >> drop) << CHANNEL_BITS) | (image.data[at + 2]! >> drop)]! += 1
  }
  const least = Math.max(LEAST_PIXELS, opaque * LEAST_SHARE)
  let colors = 0
  for (const count of counts) if (count >= least) colors += 1
  return colors > FLAT_ART_MOST_COLORS ? 'photo' : 'flat'
}
