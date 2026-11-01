import type { PixelCrop } from './convertSize'
import type { GridDimensions } from './grid'
import { reducePictureColors } from './imageColors'
import { NO_COLOR, packedToHex, sampleLatticePacked, type PixelData } from './imageConversion'
import type { PreviewLattice } from './imageFraming'
import type { SubjectMask } from './subjectMask'
import { columnCycle, DEFAULT_TECHNIQUE, rowCycle, TECHNIQUES } from './weave'

/** Beads a color region needs at the widest Width to count as a detail to keep (spec 0761's "a few beads"): a 2 × 2
 * block's worth. Smaller ones are a photo's noise, which no Width should be held up for. */
const MIN_REGION_BEADS = 4
/** How much wider than the narrowest Width that keeps every region a mark may be and still be preferred. */
const MARK_REACH = 1.25

/** What the sizing rule makes of a Width: the grid and the picture pixels each bead stands for (convertSize's Sizing). */
interface WidthSampling {
  grid: GridDimensions
  pixelsPerBead: { x: number; y: number }
}

/** What the suggestion is measured from: the part of the picture woven, Cut out's mask and Auto-fix lighting as the
 * beads read them, how many colors the regions are told apart by, the Width slider's range and marks, and the sizing
 * rule at any Width (the Height following, linked). */
export interface SuggestedWidthInput {
  image: PixelData
  part: PixelCrop
  mask?: SubjectMask
  adjust?: (packed: number) => number
  colors: number
  range: { min: number; max: number }
  marks: readonly number[]
  sizingAt: (width: number) => WidthSampling
}

/** The color regions of the subject at the widest Width: each bead's reduced color, the region it belongs to, the
 * regions big enough to keep, and the beads as a small picture of their colors to sample again. */
interface RegionMap {
  columns: number
  rows: number
  colors: Int32Array
  region: Int32Array
  wanted: Set<number>
  picture: PixelData
}

/** A Technique laying its beads in a straight grid, no stagger either way: the subject is measured as plain pixels, so
 * the region map and every Width tried line up bead for bead, whatever the Project's Technique. */
const STRAIGHT = TECHNIQUES.find((technique) => rowCycle({ technique }) === 1 && columnCycle({ technique }) === 1) ?? DEFAULT_TECHNIQUE

const wholeLattice = ({ columns, rows }: GridDimensions): PreviewLattice => ({ columns, rows, frameColumn: 0, frameRow: 0 })

/** Packed colors as a picture, one pixel each, NO_COLOR transparent: what the beads' rule can sample again. */
function packedPicture(colors: Int32Array, width: number, height: number): PixelData {
  const data = new Uint8ClampedArray(colors.length * 4)
  colors.forEach((packed, at) => {
    if (packed !== NO_COLOR) data.set([(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 255], at * 4)
  })
  return { width, height, data }
}

/** Keeps the top 4 bits of each channel, and the middle of the step they leave: colors in the same 16-level step on
 * each channel count as one, as a photo's thousands of near colors only slow the reduction down. */
const NEAR_COLOR_MASK = 0xf0f0f0
const NEAR_COLOR_MIDDLE = 0x080808

/** Points read per bead along each side at the widest Width, at most: a bigger picture is first read at this many
 * centre points a bead, so the widest sampling costs about the same for a 300 px picture and a 16 megapixel photo. */
const READS_PER_BEAD = 2

/** The subject at the widest Width, by the beads' own rule (ticket 0762), from a picture no bigger than READS_PER_BEAD
 * points a bead: Cut out's mask and Auto-fix lighting applied where the picture is read. */
function widestColors({ image, part, mask, adjust }: SuggestedWidthInput, widest: WidthSampling): Int32Array {
  const { x, y } = widest.pixelsPerBead
  if (x <= READS_PER_BEAD && y <= READS_PER_BEAD) {
    return sampleLatticePacked({ image, technique: STRAIGHT, part, pixelsPerBead: widest.pixelsPerBead, lattice: wholeLattice(widest.grid), rule: 'area', mask, adjust })
  }
  const read = { columns: widest.grid.columns * READS_PER_BEAD, rows: widest.grid.rows * READS_PER_BEAD }
  const points = sampleLatticePacked({ image, technique: STRAIGHT, part, pixelsPerBead: { x: x / READS_PER_BEAD, y: y / READS_PER_BEAD }, lattice: wholeLattice(read), rule: 'centre', mask, adjust })
  return sampleLatticePacked({
    image: packedPicture(points, read.columns, read.rows),
    technique: STRAIGHT,
    part: { x: 0, y: 0, width: read.columns, height: read.rows },
    pixelsPerBead: { x: READS_PER_BEAD, y: READS_PER_BEAD },
    lattice: wholeLattice(widest.grid),
    rule: 'area',
  })
}

/** The subject's beads at the widest Width, their colors reduced as the Colors slider would, cut into regions of one
 * color touching side by side. */
function regionMap(input: SuggestedWidthInput, widest: WidthSampling): RegionMap {
  const { columns, rows } = widest.grid
  const sampled = widestColors(input, widest)
  const counts = new Map<number, number>()
  for (let at = 0; at < sampled.length; at += 1) {
    if (sampled[at] === NO_COLOR) continue
    const near = (sampled[at]! & NEAR_COLOR_MASK) | NEAR_COLOR_MIDDLE
    sampled[at] = near
    counts.set(near, (counts.get(near) ?? 0) + 1)
  }
  const { byHex } = reducePictureColors(new Map([...counts].map(([packed, count]) => [packedToHex(packed), count])), input.colors)
  const kept = new Map([...counts.keys()].map((packed) => [packed, Number.parseInt(byHex.get(packedToHex(packed))!.slice(1), 16)]))
  const colors = Int32Array.from(sampled, (packed) => (packed === NO_COLOR ? NO_COLOR : kept.get(packed)!))

  const region = new Int32Array(colors.length).fill(-1)
  const wanted = new Set<number>()
  const stack: number[] = []
  let regions = 0
  for (let start = 0; start < colors.length; start += 1) {
    if (colors[start] === NO_COLOR || region[start] !== -1) continue
    const id = regions++
    let size = 0
    region[start] = id
    stack.push(start)
    while (stack.length > 0) {
      const at = stack.pop()!
      size += 1
      const column = at % columns
      for (const next of [column > 0 ? at - 1 : -1, column < columns - 1 ? at + 1 : -1, at - columns, at + columns]) {
        if (next >= 0 && next < colors.length && region[next] === -1 && colors[next] === colors[at]) {
          region[next] = id
          stack.push(next)
        }
      }
    }
    if (size >= MIN_REGION_BEADS) wanted.add(id)
  }

  return { columns, rows, colors, region, wanted, picture: packedPicture(colors, columns, rows) }
}

/** Whether every region to keep still has a bead at a Width: the region map sampled again by the beads' rule at that
 * Width, a bead counting for a region of its color that lies under it. */
function keepsEveryRegion(map: RegionMap, at: WidthSampling, widest: WidthSampling): boolean {
  if (map.wanted.size === 0) return true
  const per = { x: at.pixelsPerBead.x / widest.pixelsPerBead.x, y: at.pixelsPerBead.y / widest.pixelsPerBead.y }
  const part = { x: 0, y: 0, width: map.columns, height: map.rows }
  const beads = sampleLatticePacked({ image: map.picture, technique: STRAIGHT, part, pixelsPerBead: per, lattice: wholeLattice(at.grid), rule: 'area' })
  const hit = new Set<number>()
  for (let row = 0; row < at.grid.rows; row += 1) {
    const y0 = Math.floor(row * per.y)
    const y1 = Math.min(map.rows, Math.max(y0 + 1, Math.ceil((row + 1) * per.y)))
    for (let column = 0; column < at.grid.columns; column += 1) {
      const color = beads[row * at.grid.columns + column]!
      if (color === NO_COLOR) continue
      const x0 = Math.floor(column * per.x)
      const x1 = Math.min(map.columns, Math.max(x0 + 1, Math.ceil((column + 1) * per.x)))
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const cell = y * map.columns + x
          const id = map.region[cell]!
          if (map.colors[cell] === color && map.wanted.has(id) && !hit.has(id)) {
            hit.add(id)
            if (hit.size === map.wanted.size) return true
          }
        }
      }
    }
  }
  return false
}

/** Suggested Width (ticket 0770, spec 0761): the narrowest Width at which every color region of the subject a few beads
 * big at the widest Width still has a bead, a mark preferred when at most a quarter wider. Cheap: the picture is sampled
 * once, at the widest Width, and the range is halved over that small region map (fewer beads lose regions). */
export function suggestedWidth(input: SuggestedWidthInput): number {
  const { range } = input
  const widest = input.sizingAt(range.max)
  const map = regionMap(input, widest)
  const tried = new Map<number, boolean>()
  const keeps = (width: number) => {
    let known = tried.get(width)
    if (known === undefined) {
      known = keepsEveryRegion(map, input.sizingAt(width), widest)
      tried.set(width, known)
    }
    return known
  }
  let low = range.min
  let high = range.max
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (keeps(middle)) high = middle
    else low = middle + 1
  }
  const mark = [...input.marks].sort((a, b) => a - b).find((width) => width >= range.min && width <= high * MARK_REACH && keeps(width))
  return mark ?? high
}
