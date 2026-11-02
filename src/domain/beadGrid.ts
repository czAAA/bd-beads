import { luma as lumaOf } from './color'
import type { PixelCrop } from './convertSize'
import type { GridDimensions } from './grid'
import { NO_COLOR, pixelPackedAt, unpacked, type PixelData } from './imageConversion'
import type { ImageSize } from './imageFraming'

// A photo of beadwork (ticket 0772, spec 0761): the regular grid its beads lie on, found from the picture, so each
// sampled cell can be exactly one bead. Rings with holes repeat at the pitch; a landscape, flat artwork and pixel art
// have no such grid.

/** A bead grid over a picture: the pixels from one bead's centre to the next each way, where its first cell begins,
 * and how many whole cells the picture holds. */
export interface BeadGrid {
  pitch: { x: number; y: number }
  origin: { x: number; y: number }
  columns: number
  rows: number
}

/** The share of a bead's half-width its hole reaches, and where its ring begins and ends: measured on photos of fused
 * and seed beads, where the hole is a quarter of the bead across. */
const BEAD_HOLE = 0.22
export const BEAD_RING = { inner: 0.35, outer: 0.8 }

/** The longest side the picture is read at: a grid is found as well on a small copy, in a fraction of the time. */
const READ_SIDE = 800
/** The fewest and most pixels a bead may be across on the copy: finer is noise, coarser leaves too few beads. */
const MIN_PITCH = 6
const MAX_PITCH_SHARE = 1 / 8
/** How much the pitch may differ between the axes: a photo taken a little aslant, not a different grid. */
const AXIS_TOLERANCE = 0.25
/** How strong a period must be in the edge profile's autocorrelation to be a candidate pitch. */
const MIN_PERIOD = 0.1
/** How many candidate pitches each axis keeps. */
const CANDIDATES = 3
/** Offsets tried along each axis, as fractions of the pitch; then, round the best, this many finer steps each side,
 * each a fraction of a coarse step. */
const OFFSET_STEPS = 8
const FINE_STEPS = 4
/** A bead wider than this on the copy is read every other pixel: enough for a mean, half the work. */
const STRIDE_ABOVE_HALF = 8
/** The hole-ring contrast at the best offset against the mean over offsets: a grid aligns; noise is the same anywhere. */
const MIN_PEAK = 1.5
/** The least hole-ring contrast, in luma, for the cells to be beads at all. */
const MIN_CONTRAST = 8
/** Among the pitches that pass, the smallest wins when its contrast is at least this share of the strongest: a grid
 * two beads wide is a grid too, and a weaker one. */
const HARMONIC_SHARE = 0.5
/** The share of neighbouring pixels that are the very same above which the picture is flat artwork, not a photo. */
const FLAT_SHARE = 0.8
/** The profile's high-pass window, in pixels each side: the slow change of light across a photo. */
const TREND_REACH = 32

interface Luma {
  width: number
  height: number
  luma: Float32Array
  /** 1 where the pixel counts, 0 where it is too transparent to weave. */
  counts: Uint8Array
}

/** The picture's luma on a copy at most READ_SIDE across, every `step`th pixel. */
function readLuma(image: PixelData, step: number): Luma {
  const width = Math.floor(image.width / step)
  const height = Math.floor(image.height / step)
  const luma = new Float32Array(width * height)
  const counts = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = x * step
      const sy = y * step
      const packed = pixelPackedAt(image, sx, sy)
      const at = y * width + x
      if (packed === NO_COLOR) continue
      counts[at] = 1
      luma[at] = lumaOf(unpacked(packed))
    }
  }
  return { width, height, luma, counts }
}

/** Whether the copy is flat artwork: most pixels the very same as the one before them. A photo's noise never is. */
function isFlat({ luma, counts }: Luma): boolean {
  let same = 0
  let total = 0
  for (let at = 1; at < luma.length; at += 1) {
    if (!counts[at] || !counts[at - 1]) continue
    total += 1
    if (luma[at] === luma[at - 1]) same += 1
  }
  return total > 0 && same / total > FLAT_SHARE
}

/** The edge energy along an axis, summed across the other, with the slow trend taken out: beads' edges repeat at the
 * pitch, so this profile does. */
function edgeProfile({ width, height, luma, counts }: Luma, axis: 'x' | 'y'): Float64Array {
  const length = axis === 'x' ? width : height
  const energy = new Float64Array(length)
  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const at = y * width + x
      const before = axis === 'x' ? at - 1 : at - width
      if (!counts[at] || !counts[before]) continue
      const d = luma[at]! - luma[before]!
      energy[axis === 'x' ? x : y] += d * d
    }
  }
  const profile = new Float64Array(length)
  let sum = 0
  for (let at = 0; at < Math.min(length, TREND_REACH + 1); at += 1) sum += energy[at]!
  for (let at = 0; at < length; at += 1) {
    const from = at - TREND_REACH
    const to = at + TREND_REACH
    if (from > 0) sum -= energy[from - 1]!
    if (to < length) sum += energy[to]!
    const count = Math.min(length - 1, to) - Math.max(0, from) + 1
    profile[at] = energy[at]! - sum / count
  }
  return profile
}

/** How alike a profile is to itself shifted by `lag`, from -1 to 1. */
function autocorrelation(profile: Float64Array, lag: number): number {
  let both = 0
  let own = 0
  let shifted = 0
  for (let at = 0; at + lag < profile.length; at += 1) {
    both += profile[at]! * profile[at + lag]!
    own += profile[at]! * profile[at]!
    shifted += profile[at + lag]! * profile[at + lag]!
  }
  return both / Math.sqrt(own * shifted || 1)
}

/** The strongest periods in a profile between the pitch limits, each a peak of the autocorrelation, best first. */
function periods(profile: Float64Array, max: number): { lag: number; strength: number }[] {
  const reach = Math.min(max + 1, Math.floor(profile.length / 2) - 1)
  if (reach < MIN_PITCH) return []
  const at = new Float64Array(reach + 1)
  for (let lag = MIN_PITCH - 1; lag <= reach; lag += 1) at[lag] = autocorrelation(profile, lag)
  const found: { lag: number; strength: number }[] = []
  for (let lag = MIN_PITCH; lag < reach; lag += 1) {
    if (at[lag]! > at[lag - 1]! && at[lag]! >= at[lag + 1]! && at[lag]! > MIN_PERIOD) found.push({ lag, strength: at[lag]! })
  }
  return found.sort((a, b) => b.strength - a.strength).slice(0, CANDIDATES)
}

/** A period to a fraction of a pixel: the peak of the parabola through the autocorrelation round it. */
function refined(profile: Float64Array, lag: number): number {
  const before = autocorrelation(profile, lag - 1)
  const own = autocorrelation(profile, lag)
  const after = autocorrelation(profile, lag + 1)
  const curve = before - 2 * own + after
  return curve === 0 ? lag : lag + (0.5 * (before - after)) / curve
}

/** The mean contrast between each cell's hole and its ring, for a pitch and offset: beads lined up on the grid show
 * their holes; off the grid, or with no beads, the two read alike. Cells outside the mask are left out. */
function holeContrast({ width, height, luma, counts }: Luma, pitch: { x: number; y: number }, offset: { x: number; y: number }): number {
  const columns = Math.floor((width - offset.x) / pitch.x)
  const rows = Math.floor((height - offset.y) / pitch.y)
  const half = Math.min(pitch.x, pitch.y) / 2
  const stride = half > STRIDE_ABOVE_HALF ? 2 : 1
  let total = 0
  let cells = 0
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const centreX = offset.x + (column + 0.5) * pitch.x
      const centreY = offset.y + (row + 0.5) * pitch.y
      let hole = 0
      let holes = 0
      let ring = 0
      let rings = 0
      for (let dy = -half; dy <= half; dy += stride) {
        for (let dx = -half; dx <= half; dx += stride) {
          const x = Math.round(centreX + dx)
          const y = Math.round(centreY + dy)
          if (x < 0 || y < 0 || x >= width || y >= height || !counts[y * width + x]) continue
          const d = Math.hypot(dx / (pitch.x / 2), dy / (pitch.y / 2))
          const value = luma[y * width + x]!
          if (d <= BEAD_HOLE) {
            hole += value
            holes += 1
          } else if (d >= BEAD_RING.inner && d <= BEAD_RING.outer) {
            ring += value
            rings += 1
          }
        }
      }
      if (holes === 0 || rings === 0) continue
      total += Math.abs(ring / rings - hole / holes)
      cells += 1
    }
  }
  return cells === 0 ? 0 : total / cells
}

interface Fit {
  pitch: { x: number; y: number }
  offset: { x: number; y: number }
  contrast: number
  peak: number
}

/** The offset at which a pitch fits the picture best, with how clearly it peaks over the other offsets tried: first
 * the coarse steps over the whole pitch, then the fine steps round the best of those. */
function fitOf(read: Luma, pitch: { x: number; y: number }): Fit {
  let best: Fit = { pitch, offset: { x: 0, y: 0 }, contrast: -1, peak: 0 }
  let sum = 0
  const stepX = pitch.x / OFFSET_STEPS
  const stepY = pitch.y / OFFSET_STEPS
  for (let i = 0; i < OFFSET_STEPS; i += 1) {
    for (let j = 0; j < OFFSET_STEPS; j += 1) {
      const offset = { x: i * stepX, y: j * stepY }
      const contrast = holeContrast(read, pitch, offset)
      sum += contrast
      if (contrast > best.contrast) best = { pitch, offset, contrast, peak: 0 }
    }
  }
  const mean = sum / (OFFSET_STEPS * OFFSET_STEPS)
  const coarse = best.offset
  for (let i = -FINE_STEPS; i <= FINE_STEPS; i += 1) {
    for (let j = -FINE_STEPS; j <= FINE_STEPS; j += 1) {
      if (i === 0 && j === 0) continue
      const offset = { x: coarse.x + (i / FINE_STEPS) * stepX, y: coarse.y + (j / FINE_STEPS) * stepY }
      if (offset.x < 0 || offset.y < 0 || offset.x >= pitch.x || offset.y >= pitch.y) continue
      const contrast = holeContrast(read, pitch, offset)
      if (contrast > best.contrast) best = { pitch, offset, contrast, peak: 0 }
    }
  }
  return { ...best, peak: mean > 0 ? best.contrast / mean : 0 }
}

/** The bead grid a picture holds, or none: for a photo of beadwork, the pitch each way to a fraction of a pixel and
 * where the first whole cell begins. Flat artwork is never a grid, nor is a picture whose edges repeat at no period,
 * nor one whose cells show no hole against their ring. Read once per picture: Cut out's mask takes no part. */
export function detectBeadGrid(image: PixelData): BeadGrid | undefined {
  const step = Math.max(1, Math.ceil(Math.max(image.width, image.height) / READ_SIDE))
  const read = readLuma(image, step)
  if (read.width < MIN_PITCH * 2 || read.height < MIN_PITCH * 2 || isFlat(read)) return undefined
  const maxPitch = Math.floor(Math.min(read.width, read.height) * MAX_PITCH_SHARE)
  const alongX = edgeProfile(read, 'x')
  const alongY = edgeProfile(read, 'y')
  const fits: Fit[] = []
  for (const x of periods(alongX, maxPitch)) {
    for (const y of periods(alongY, maxPitch)) {
      if (Math.abs(x.lag - y.lag) > AXIS_TOLERANCE * Math.max(x.lag, y.lag)) continue
      fits.push(fitOf(read, { x: refined(alongX, x.lag), y: refined(alongY, y.lag) }))
    }
  }
  const passing = fits.filter((fit) => fit.peak >= MIN_PEAK && fit.contrast >= MIN_CONTRAST)
  if (passing.length === 0) return undefined
  const strongest = Math.max(...passing.map((fit) => fit.contrast))
  const chosen = passing.filter((fit) => fit.contrast >= HARMONIC_SHARE * strongest).sort((a, b) => a.pitch.x - b.pitch.x)[0]!
  const pitch = { x: chosen.pitch.x * step, y: chosen.pitch.y * step }
  const origin = { x: chosen.offset.x * step, y: chosen.offset.y * step }
  const columns = Math.floor((image.width - origin.x) / pitch.x)
  const rows = Math.floor((image.height - origin.y) / pitch.y)
  return columns > 0 && rows > 0 ? { pitch, origin, columns, rows } : undefined
}

/** A part over the grid's whole cells, in whole pixels: the Width of `columns` beads then puts one bead on each cell.
 * The rounding moves a bead's centre by under half a pixel over the whole grid. */
export function beadGridPart(grid: BeadGrid, image: ImageSize): PixelCrop {
  const x = Math.round(grid.origin.x)
  const y = Math.round(grid.origin.y)
  return {
    x,
    y,
    width: Math.min(image.width - x, Math.round(grid.columns * grid.pitch.x)),
    height: Math.min(image.height - y, Math.round(grid.rows * grid.pitch.y)),
  }
}

/** Whether a part with a Schema's dimensions lies on the grid: every cell one bead, so the sampler may read each from
 * its ring. A Height moved off the grid's rows takes the cells off it. */
export function onBeadGrid(grid: BeadGrid, part: PixelCrop, dimensions: GridDimensions, image: ImageSize): boolean {
  const snapped = beadGridPart(grid, image)
  return (
    dimensions.columns === grid.columns &&
    dimensions.rows === grid.rows &&
    part.x === snapped.x &&
    part.y === snapped.y &&
    part.width === snapped.width &&
    part.height === snapped.height
  )
}
