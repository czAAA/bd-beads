import { clamp } from './clamp'
import { toOklab } from './color'

/** The color a bead takes from the picture pixels its area covers (ticket 0762, ADR 0010): the color most of the area
 * has, unless a thin, strongly contrasting line crosses it, which then wins. The pixels are grouped into color families
 * (OKLab); the bead is the mean of the winning family, or no bead where the transparent pixels win. */

/** How close two pixels' colors must be, in OKLab, to be one family: wide enough that a photo's noise is one family,
 * narrow enough that a shine or a shadow is its own. Tuned against the reference suite. */
const FAMILY_DISTANCE = 0.07
/** How far a family must be from the largest, in OKLab, to be a line that can win: an outline or stroke, not a shade. */
const LINE_CONTRAST = 0.2
/** The smallest share of the bead's area a line must cover to win. */
const MIN_LINE_SHARE = 0.08
/** A line is judged in a window round the bead, the bead's area grown by this much of it each side: a line along the
 * bead's edge is the edge of a region inside the bead, and a line only round it. */
const WINDOW_GROWTH = 1
/** The share of the window that must lie beyond a line on each side, so a region's edge is not taken for a line. */
const MIN_SIDE_SHARE = 0.08
/** How much of the window's width along it a line must span: one that runs through, not a speck. */
const LINE_SPAN = 0.5
/** The fewest pixels across a bead for a line to be told from what is round it: in a smaller bead the majority, or
 * the centre pixel on a tie, decides alone. */
const MIN_LINE_BEAD = 3
/** How many times longer than thick a family must be to be a line. */
const LINE_ELONGATION = 2
/** How much of its length a line must cover without a break: specks in a row are not a line. */
const LINE_CONTINUITY = 0.85
/** How many of a line's measured crossings must have their middle in the bead for the bead to take it: each line is
 * then a bead thick, and a sliver along the bead's edge, its middle in the next bead, is the next bead's. */
const LINE_INSIDE = 0.5
/** How thick a line may be, against the bead's narrower side: one a bead thick or more is a region, which the
 * majority already keeps, so pixel art's one-cell lines never steal a neighbour's bead. */
const LINE_THICKNESS = 1

/** What a pixel on the edge of a bead's area counts for in its majority, half of one inside (a quarter in a corner):
 * an edge row is shared with the next bead's cell where the cells are not whole pixels, as pixel art enlarged by a
 * fraction is, so the cell's own color still wins. */
const EDGE_WEIGHT = 0.5

/** At most this many pixels are looked at along each side of a bead: a larger area is read every few pixels. */
const MAX_SIDE = 12
/** At most this many of a family's pixels in a bead are measured for its thickness. */
const RUN_SAMPLES = 12
/** At most this many families are kept; a pixel past them joins the nearest. */
const MAX_FAMILIES = 16
/** The winner where the pixels too transparent to weave cover most of the bead: no bead. */
const TRANSPARENT = -1

/** OKLab of every color at 5 bits a channel, built once: a photo has too many colors to convert each exactly, and the
 * families are far wider than the rounding. */
let oklabTable: Float32Array | undefined
function oklabOf(): Float32Array {
  if (oklabTable) return oklabTable
  const table = new Float32Array(32 * 32 * 32 * 3)
  const level = (step: number) => Math.min(255, step * 8 + 4)
  for (let r = 0; r < 32; r += 1) {
    for (let g = 0; g < 32; g += 1) {
      for (let b = 0; b < 32; b += 1) {
        const { l, a, b: blue } = toOklab({ r: level(r), g: level(g), b: level(b) })
        table.set([l, a, blue], ((r << 10) | (g << 5) | b) * 3)
      }
    }
  }
  oklabTable = table
  return table
}

/** A packed color's place among the colors at 5 bits a channel, and in the OKLab table. */
const BINS = 32 * 32 * 32
const binOf = (packed: number) => (((packed >> 19) & 31) << 10) | (((packed >> 11) & 31) << 5) | ((packed >> 3) & 31)
const tableIndex = (packed: number) => binOf(packed) * 3

/** The pixels of a bead's area, in whole picture pixels: from x0 and y0 up to, not including, x1 and y1. */
export interface PixelArea {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Pixels looked at in a stretch of the picture, every `step` pixels: each one's packed color and place, and whether
 * it belongs to the line being judged. */
class Samples {
  readonly colors: Int32Array
  readonly xs: Int32Array
  readonly ys: Int32Array
  readonly member: Uint8Array
  total = 0
  stepX = 1
  stepY = 1

  constructor(size: number) {
    this.colors = new Int32Array(size)
    this.xs = new Int32Array(size)
    this.ys = new Int32Array(size)
    this.member = new Uint8Array(size)
  }

  /** Reads an area, at most `side` pixels along each side of it; whether every pixel read is the same color. */
  read(area: PixelArea, side: number, pixelAt: (x: number, y: number) => number): boolean {
    this.stepX = Math.max(1, Math.ceil((area.x1 - area.x0) / side))
    this.stepY = Math.max(1, Math.ceil((area.y1 - area.y0) / side))
    let total = 0
    let same = true
    for (let y = area.y0; y < area.y1; y += this.stepY) {
      for (let x = area.x0; x < area.x1; x += this.stepX) {
        const packed = pixelAt(x, y)
        this.colors[total] = packed
        this.xs[total] = x
        this.ys[total] = y
        same &&= packed === this.colors[0]
        total += 1
      }
    }
    this.total = total
    return same
  }
}

/** A reader of bead areas (see the module comment) over a picture's pixels, each a packed 0xRRGGBB or `empty` where
 * too transparent to weave, as imageConversion reads them; each call is one bead, its area and its true centre in
 * picture pixels. Its working space is made once for a whole lattice, since a Schema has tens of thousands of beads. */
export function beadAreaReader(
  picture: { width: number; height: number },
  pixelAt: (x: number, y: number) => number,
  empty: number,
): (area: PixelArea, centreX: number, centreY: number) => number {
  const lab = oklabOf()
  const cell = new Samples(MAX_SIDE * MAX_SIDE)
  const windowSide = Math.ceil(MAX_SIDE * (1 + 2 * WINDOW_GROWTH))
  const around = new Samples(windowSide * windowSide)
  const centroid = new Float64Array(MAX_FAMILIES * 3)
  const count = new Int32Array(MAX_FAMILIES)
  const sums = new Float64Array(MAX_FAMILIES * 3)
  // How much of the bead each family covers, a pixel on the area's edge counting EDGE_WEIGHT.
  const weight = new Float64Array(MAX_FAMILIES)
  let transparentWeight = 0
  // The bead's pixels counted by color at 5 bits a channel (see groupFamilies), emptied after each bead, the colors
  // it holds listed.
  const binCount = new Int32Array(BINS)
  const binWeight = new Float32Array(BINS)
  const binSums = new Int32Array(BINS * 3)
  const touched = new Int32Array(MAX_SIDE * MAX_SIDE)
  const candidates: number[] = []
  const covered = new Uint8Array(windowSide * 2)

  /** The squared OKLab distance from a color (its place in the OKLab table) to a family's centroid. */
  function distanceTo(at: number, index: number): number {
    const dl = lab[at]! - centroid[index * 3]!
    const da = lab[at + 1]! - centroid[index * 3 + 1]!
    const db = lab[at + 2]! - centroid[index * 3 + 2]!
    return dl * dl + da * da + db * db
  }

  /** The family whose centroid is nearest a color (its place in the OKLab table). */
  function nearest(at: number, families: number): number {
    let best = 0
    let bestDistance = Infinity
    for (let index = 0; index < families; index += 1) {
      const distance = distanceTo(at, index)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    return best
  }

  /** Groups the bead's pixels into families. The pixels are first counted by their color at 5 bits a channel, so a
   * family is found among a few dozen colors, not every pixel; the commonest colors seed the families, each color
   * joining the first within FAMILY_DISTANCE or starting one, then each is placed again on the nearest centroid. */
  function groupFamilies(area: PixelArea): number {
    const { colors, xs, ys, total, stepX, stepY } = cell
    let distinct = 0
    transparentWeight = 0
    for (let at = 0; at < total; at += 1) {
      const x = xs[at]!
      const y = ys[at]!
      const near = (x === area.x0 || x + stepX >= area.x1 ? EDGE_WEIGHT : 1) * (y === area.y0 || y + stepY >= area.y1 ? EDGE_WEIGHT : 1)
      const packed = colors[at]!
      if (packed === empty) {
        transparentWeight += near
        continue
      }
      const bin = binOf(packed)
      if (binCount[bin] === 0) touched[distinct++] = bin
      binCount[bin] += 1
      binWeight[bin] += near
      binSums[bin * 3]! += (packed >> 16) & 0xff
      binSums[bin * 3 + 1]! += (packed >> 8) & 0xff
      binSums[bin * 3 + 2]! += packed & 0xff
    }
    // Commonest first, so the families start where most of the bead is.
    for (let at = 1; at < distinct; at += 1) {
      const bin = touched[at]!
      let to = at
      while (to > 0 && binCount[touched[to - 1]!]! < binCount[bin]!) {
        touched[to] = touched[to - 1]!
        to -= 1
      }
      touched[to] = bin
    }

    const limit = FAMILY_DISTANCE * FAMILY_DISTANCE
    let families = 0
    for (let at = 0; at < distinct; at += 1) {
      const bin = touched[at]!
      const color = bin * 3
      let index = 0
      for (; index < families; index += 1) {
        if (distanceTo(color, index) <= limit) break
      }
      if (index === families) {
        if (families < MAX_FAMILIES) count[families++] = 0
        else index = nearest(color, families)
      }
      const n = (count[index] += binCount[bin]!)
      const share = binCount[bin]! / n
      for (let channel = 0; channel < 3; channel += 1) {
        centroid[index * 3 + channel]! += (lab[color + channel]! - centroid[index * 3 + channel]!) * share
      }
    }
    for (let index = 0; index < families; index += 1) {
      count[index] = 0
      weight[index] = 0
      sums[index * 3] = 0
      sums[index * 3 + 1] = 0
      sums[index * 3 + 2] = 0
    }
    for (let at = 0; at < distinct; at += 1) {
      const bin = touched[at]!
      const index = families === 1 ? 0 : nearest(bin * 3, families)
      count[index] += binCount[bin]!
      weight[index] += binWeight[bin]!
      for (let channel = 0; channel < 3; channel += 1) sums[index * 3 + channel]! += binSums[bin * 3 + channel]!
      binCount[bin] = 0
      binWeight[bin] = 0
      binSums[bin * 3] = 0
      binSums[bin * 3 + 1] = 0
      binSums[bin * 3 + 2] = 0
    }
    return families
  }

  // The family being judged as a line, the bead's winner it would beat, and whether the window round the bead is read.
  let line = 0
  let under = TRANSPARENT
  let windowRead = false
  const byCount = (one: number, other: number) => count[other]! - count[one]!

  /** Whether a pixel belongs to the line being judged: its family's color, or a blend of it and the winner's that is
   * nearer the line's, so an anti-aliased line counts as the crisp line it was drawn as. */
  function inLine(packed: number): boolean {
    if (packed === empty) return false
    const at = tableIndex(packed)
    const limit = FAMILY_DISTANCE * FAMILY_DISTANCE
    const toLine = distanceTo(at, line)
    if (toLine <= limit) return true
    if (under === TRANSPARENT || toLine >= distanceTo(at, under)) return false
    // Off the line's color, but between it and the winner's?
    let along = 0
    let length = 0
    for (let channel = 0; channel < 3; channel += 1) {
      const span = centroid[under * 3 + channel]! - centroid[line * 3 + channel]!
      along += (lab[at + channel]! - centroid[line * 3 + channel]!) * span
      length += span * span
    }
    const t = along / length
    let off = 0
    for (let channel = 0; channel < 3; channel += 1) {
      const blend = centroid[line * 3 + channel]! + t * (centroid[under * 3 + channel]! - centroid[line * 3 + channel]!)
      off += (lab[at + channel]! - blend) ** 2
    }
    return off <= limit
  }

  /** Marks the pixels of some samples that belong to the line being judged; how many do. */
  function markLine(samples: Samples): number {
    let marked = 0
    for (let at = 0; at < samples.total; at += 1) {
      const member = inLine(samples.colors[at]!)
      samples.member[at] = member ? 1 : 0
      if (member) marked += 1
    }
    return marked
  }

  /** Reads the window round the bead: the bead's area grown by WINDOW_GROWTH of it each side, cut to the picture. */
  function readWindow(area: PixelArea) {
    const growX = Math.ceil((area.x1 - area.x0) * WINDOW_GROWTH)
    const growY = Math.ceil((area.y1 - area.y0) * WINDOW_GROWTH)
    around.read(
      {
        x0: Math.max(0, area.x0 - growX),
        y0: Math.max(0, area.y0 - growY),
        x1: Math.min(picture.width, area.x1 + growX),
        y1: Math.min(picture.height, area.y1 + growY),
      },
      windowSide,
      pixelAt,
    )
  }

  /** How many pixels of the line follow a pixel one way, up to `reach`; past it, reach + 1, the run cut off. */
  function runFrom(x: number, y: number, dx: number, dy: number, reach: number): number {
    let steps = 0
    for (let nx = x + dx, ny = y + dy; nx >= 0 && ny >= 0 && nx < picture.width && ny < picture.height; nx += dx, ny += dy) {
      if (!inLine(pixelAt(nx, ny))) break
      steps += 1
      if (steps > reach) break
    }
    return steps
  }

  /** How thick the line is, and how often its middle is in the bead: through some of its pixels, its runs across and
   * down the picture, the shorter its thickness with its middle in the bead, the longer covering half the bead. Runs,
   * not a fit: pixel art's cells are whole both ways however they stair-step, so a sliver of one is the next bead's. */
  function crossing(area: PixelArea, members: number): { thickness: number; inside: number } {
    const { xs, ys, member, total } = cell
    const reach = Math.max(area.x1 - area.x0, area.y1 - area.y0)
    const every = Math.max(1, Math.floor(members / RUN_SAMPLES))
    const middleIn = (at: number, before: number, after: number, low: number, high: number) => {
      const middle = at + 0.5 + (after - before) / 2
      return middle >= low && middle < high
    }
    const covers = (at: number, before: number, after: number, low: number, high: number) =>
      2 * (Math.min(at + after + 1, high) - Math.max(at - before, low)) >= Math.min(before + after + 1, high - low)
    let runs = 0
    let thickness = 0
    let inside = 0
    let seen = 0
    for (let at = 0; at < total; at += 1) {
      if (!member[at] || seen++ % every !== 0) continue
      const x = xs[at]!
      const y = ys[at]!
      const left = runFrom(x, y, -1, 0, reach)
      const right = runFrom(x, y, 1, 0, reach)
      const up = runFrom(x, y, 0, -1, reach)
      const down = runFrom(x, y, 0, 1, reach)
      runs += 1
      thickness += Math.min(left + right, up + down) + 1
      const acrossIsX = left + right <= up + down
      const across = acrossIsX ? middleIn(x, left, right, area.x0, area.x1) : middleIn(y, up, down, area.y0, area.y1)
      const along = acrossIsX ? covers(y, up, down, area.y0, area.y1) : covers(x, left, right, area.x0, area.x1)
      if (across && along) inside += 1
    }
    return { thickness: thickness / runs, inside: inside / runs }
  }

  /** Whether the family being judged is a line through the bead: thinner than a bead, its middle in the bead, and
   * running through the window round the bead, long and unbroken, with other pixels beyond it on both sides. */
  function isLine(area: PixelArea, members: number): boolean {
    const { thickness, inside } = crossing(area, members)
    if (thickness > LINE_THICKNESS * Math.min(area.x1 - area.x0, area.y1 - area.y0) || inside < LINE_INSIDE) return false
    if (!windowRead) readWindow(area)
    windowRead = true
    const n = markLine(around)
    if (n === 0) return false
    const { xs, ys, member, total, stepX, stepY } = around
    let meanX = 0
    let meanY = 0
    for (let at = 0; at < total; at += 1) {
      if (!member[at]) continue
      meanX += xs[at]!
      meanY += ys[at]!
    }
    meanX /= n
    meanY /= n
    let sxx = 0
    let syy = 0
    let sxy = 0
    for (let at = 0; at < total; at += 1) {
      if (!member[at]) continue
      const dx = xs[at]! - meanX
      const dy = ys[at]! - meanY
      sxx += dx * dx
      syy += dy * dy
      sxy += dx * dy
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const ux = Math.cos(angle)
    const uy = Math.sin(angle)
    let alongMin = Infinity
    let alongMax = -Infinity
    let before = 0
    let beyond = 0
    for (let at = 0; at < total; at += 1) {
      const dx = xs[at]! - meanX
      const dy = ys[at]! - meanY
      if (member[at]) {
        const along = ux * dx + uy * dy
        alongMin = Math.min(alongMin, along)
        alongMax = Math.max(alongMax, along)
        continue
      }
      const across = ux * dy - uy * dx
      if (across < 0) before += 1
      else if (across > 0) beyond += 1
    }
    if (before < MIN_SIDE_SHARE * total || beyond < MIN_SIDE_SHARE * total) return false
    const step = Math.max(stepX, stepY)
    const span = alongMax - alongMin + step
    const box = { left: xs[0]!, top: ys[0]!, right: xs[total - 1]!, bottom: ys[total - 1]! }
    if (span < LINE_ELONGATION * thickness || span < LINE_SPAN * chord(meanX, meanY, ux, uy, box)) return false
    // Unbroken: its pixels cover nearly every step along it.
    const steps = Math.min(covered.length, Math.ceil(span / step))
    covered.fill(0, 0, steps)
    for (let at = 0; at < total; at += 1) {
      if (!member[at]) continue
      const along = ux * (xs[at]! - meanX) + uy * (ys[at]! - meanY)
      covered[Math.min(steps - 1, Math.floor((along - alongMin) / step))] = 1
    }
    let filled = 0
    for (let at = 0; at < steps; at += 1) filled += covered[at]!
    return filled >= LINE_CONTINUITY * steps
  }

  return (area, centreX, centreY) => {
    // A flat area, as every bead of pixel art on a mark is: its one color, exactly.
    if (cell.read(area, MAX_SIDE, pixelAt)) return cell.colors[0]!
    const { total } = cell
    const families = groupFamilies(area)

    // The family covering most of the bead wins, its edge pixels counting less; a tie goes to the family of the centre
    // pixel, the one a moving preview shows.
    const centrePixel = pixelAt(clamp(Math.floor(centreX), area.x0, area.x1 - 1), clamp(Math.floor(centreY), area.y0, area.y1 - 1))
    const centre = centrePixel === empty ? TRANSPARENT : nearest(tableIndex(centrePixel), families)
    let winner = TRANSPARENT
    let most = 0
    let opaque = 0
    for (let index = 0; index < families; index += 1) {
      opaque += weight[index]!
      if (weight[index]! > most || (weight[index] === most && centre === index)) {
        winner = index
        most = weight[index]!
      }
    }
    // No bead only where most of the area is transparent, as a pixel is past half transparent.
    if (transparentWeight > opaque || (transparentWeight === opaque && centre === TRANSPARENT)) winner = TRANSPARENT

    // A thin, strongly contrasting line through the bead wins over it: the largest such.
    if (Math.min(area.x1 - area.x0, area.y1 - area.y0) >= MIN_LINE_BEAD) {
      candidates.length = 0
      for (let index = 0; index < families; index += 1) {
        if (index === winner || count[index]! < (MIN_LINE_SHARE / 2) * total) continue
        if (winner !== TRANSPARENT && distanceSquared(centroid, index, winner) < LINE_CONTRAST * LINE_CONTRAST) continue
        candidates.push(index)
      }
      if (candidates.length > 1) candidates.sort(byCount)
      windowRead = false
      under = winner
      for (const index of candidates) {
        line = index
        const members = markLine(cell)
        if (members >= MIN_LINE_SHARE * total && isLine(area, members)) {
          winner = index
          break
        }
      }
    }

    if (winner === TRANSPARENT) return empty
    const n = count[winner]!
    return (Math.round(sums[winner * 3]! / n) << 16) | (Math.round(sums[winner * 3 + 1]! / n) << 8) | Math.round(sums[winner * 3 + 2]! / n)
  }
}

function distanceSquared(centroid: Float64Array, one: number, other: number): number {
  const dl = centroid[one * 3]! - centroid[other * 3]!
  const da = centroid[one * 3 + 1]! - centroid[other * 3 + 1]!
  const db = centroid[one * 3 + 2]! - centroid[other * 3 + 2]!
  return dl * dl + da * da + db * db
}

/** How long the line through a point, along a direction, runs inside a box. */
function chord(x: number, y: number, ux: number, uy: number, box: { left: number; top: number; right: number; bottom: number }): number {
  let from = -Infinity
  let to = Infinity
  for (const [at, step, low, high] of [
    [x, ux, box.left, box.right],
    [y, uy, box.top, box.bottom],
  ] as const) {
    if (Math.abs(step) < 1e-9) continue
    const one = (low - at) / step
    const other = (high - at) / step
    from = Math.max(from, Math.min(one, other))
    to = Math.min(to, Math.max(one, other))
  }
  return Math.max(0, to - from)
}
