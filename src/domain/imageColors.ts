import { channelsOf, colorDistance, toHex, toOklab, type Oklab, type Rgb } from './color'

/** The colors a Convert image (ticket 58) takes from a picture: reduced to a buyable count with no dithering (ticket
 * 177, ADR 0010); convertColors.ts then matches each to the chosen source. */

/** The closest of `colors` to `hex` by how alike they look (colorDistance), or undefined when there are none to
 * choose from. */
export function nearestColor(colors: readonly string[], hex: string): string | undefined {
  const target = toOklab(channelsOf(hex))
  let best: string | undefined
  let bestDistance = Infinity

  for (const candidate of colors) {
    const distance = colorDistance(target, toOklab(channelsOf(candidate)))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }

  return best
}

/** One color of a picture and how many cells sampled it, the unit median cut works in. */
interface WeightedColor {
  hex: string
  rgb: Rgb
  count: number
}

type Channel = keyof Rgb

const CHANNELS: readonly Channel[] = ['r', 'g', 'b']

/** How far a box's colors spread along one channel. */
function channelRange(box: readonly WeightedColor[], channel: Channel): number {
  let min = Infinity
  let max = -Infinity
  for (const color of box) {
    min = Math.min(min, color.rgb[channel])
    max = Math.max(max, color.rgb[channel])
  }
  return max - min
}

/** The channel a box spreads widest along — the one median cut splits it on. */
function widestChannel(box: readonly WeightedColor[]): Channel {
  return CHANNELS.reduce((widest, channel) =>
    channelRange(box, channel) > channelRange(box, widest) ? channel : widest,
  )
}

/** Splits a box at the cell-count median of its widest channel, so a color covering most of the picture pulls the
 * split towards itself rather than counting like a stray bead. */
function splitBox(box: readonly WeightedColor[]): [WeightedColor[], WeightedColor[]] {
  const channel = widestChannel(box)
  const sorted = [...box].sort((a, b) => a.rgb[channel] - b.rgb[channel])
  const total = sorted.reduce((sum, color) => sum + color.count, 0)

  let taken = 0
  let at = 0
  while (at < sorted.length - 1 && taken + sorted[at]!.count <= total / 2) {
    taken += sorted[at]!.count
    at += 1
  }
  // Both halves have to hold something, or the split hasn't reduced anything.
  const cut = Math.min(Math.max(at, 1), sorted.length - 1)

  return [sorted.slice(0, cut), sorted.slice(cut)]
}

/** The one color that stands in for a box: its cell-weighted average, so it lands where most of the picture is. */
function representative(box: readonly WeightedColor[]): Rgb {
  const total = box.reduce((sum, color) => sum + color.count, 0)
  const sum = box.reduce(
    (totals, color) => ({
      r: totals.r + color.rgb.r * color.count,
      g: totals.g + color.rgb.g * color.count,
      b: totals.b + color.rgb.b * color.count,
    }),
    { r: 0, g: 0, b: 0 },
  )

  return { r: sum.r / total, g: sum.g / total, b: sum.b / total }
}

/** A box with how far it spreads along its widest channel, worked out once: the Colors slider asks for thousands of
 * boxes from a photo (ticket 0747), and only the two halves of a split change. */
interface MeasuredBox {
  colors: WeightedColor[]
  spread: number
}

function measured(colors: WeightedColor[]): MeasuredBox {
  return { colors, spread: colors.length > 1 ? channelRange(colors, widestChannel(colors)) : -1 }
}

/** Median cut down to at most `maxColors` boxes by splitting the widest box until done. Over k-means (fixed steps,
 * no unlucky start) and a fixed octree (adapts to where flat artwork's few colors crowd the cube). */
function medianCut(colors: WeightedColor[], maxColors: number): WeightedColor[][] {
  const boxes: MeasuredBox[] = [measured(colors)]

  while (boxes.length < maxColors) {
    let widest = 0
    for (let at = 1; at < boxes.length; at += 1) {
      if (boxes[at]!.spread > boxes[widest]!.spread) widest = at
    }
    // A box of one color cannot split: a spread of -1 says so.
    if (boxes[widest]!.spread < 0) break

    const [left, right] = splitBox(boxes[widest]!.colors)
    boxes[widest] = measured(left)
    boxes.push(measured(right))
  }

  return boxes.map((box) => box.colors)
}

/** A picture's colors reduced to a buyable count (ticket 177, ADR 0010), before any snap: the Convert image wizard
 * matches each to its source afterwards, so a remap or an empty survives a change of source (spec 0645). */
export interface ReducedColors {
  /** The colors the reduction kept, each a box's cell-weighted average, most of the picture first. */
  colors: { hex: string; count: number }[]
  /** Every sampled hex to the kept color it became: itself when nothing was reduced. */
  byHex: Map<string, string>
}

/** The color a box of the reduction stands for. */
function boxColor(box: readonly WeightedColor[]): string {
  // A box of one is that color itself, untouched.
  return box.length === 1 ? box[0]!.hex : toHex(representative(box))
}

/** How far a sampled color must be, in OKLab, from every color kept to be a distinct color the reduction lost: a blue
 * eye among browns, not a shade. */
const DISTINCT_DISTANCE = 0.12
/** The least share of the picture, and the fewest beads, a distinct color and its near shades must cover to take a
 * slot: fewer are a photo's specks. The six blue beads of a cat's eyes in a 650-bead piece are kept; one bead is not. */
const DISTINCT_SHARE = 0.004
const DISTINCT_BEADS = 3

/** A kept color with its OKLab place, as the rescue reads it. */
interface KeptColor {
  box: WeightedColor[]
  lab: Oklab
}

// Distinct colors keep a slot (ticket 0772): median cut splits where most of the picture is, so a small distinct color
// ends in a box whose average is nothing like it. Such a color, far from every color kept and covering enough with its
// near shades, takes the slot of the two kept colors nearest each other; every sampled color then joins the nearest.
/** The boxes with every distinct color given a slot back (see above); within the limit, or with none, as they were. */
function keepDistinctColors(boxes: WeightedColor[][], maxColors: number): WeightedColor[][] {
  if (boxes.length < maxColors || boxes.length < 2) return boxes
  const labs = new Map<string, Oklab>()
  const labOf = (color: WeightedColor) => {
    let lab = labs.get(color.hex)
    if (!lab) {
      lab = toOklab(color.rgb)
      labs.set(color.hex, lab)
    }
    return lab
  }
  const all = boxes.flat()
  const total = all.reduce((sum, color) => sum + color.count, 0)
  let kept: KeptColor[] = boxes.map((box) => ({ box, lab: toOklab(representative(box)) }))

  for (let round = 0; round < maxColors; round += 1) {
    const nearestKept = (lab: Oklab) => kept.reduce((best, candidate) => Math.min(best, colorDistance(lab, candidate.lab)), Infinity)
    // The lost color: far from every kept color (first from its own box's, which is cheap), with the most beads among
    // its near shades, weighted by how far it is.
    let lost: { color: WeightedColor; distance: number; weight: number } | undefined
    for (const { box, lab: own } of kept) {
      for (const color of box) {
        const lab = labOf(color)
        if (colorDistance(lab, own) < DISTINCT_DISTANCE) continue
        const distance = nearestKept(lab)
        if (distance < DISTINCT_DISTANCE) continue
        let support = 0
        for (const other of all) if (colorDistance(lab, labOf(other)) < DISTINCT_DISTANCE / 2) support += other.count
        if (support < Math.max(DISTINCT_BEADS, DISTINCT_SHARE * total)) continue
        const weight = support * distance
        if (!lost || weight > lost.weight) lost = { color, distance, weight }
      }
    }
    if (!lost) break
    // The two kept colors nearest each other give up a slot, unless they are farther apart than the lost color is.
    let pair: [number, number] | undefined
    let pairDistance = Infinity
    for (let a = 0; a < kept.length; a += 1) {
      for (let b = a + 1; b < kept.length; b += 1) {
        const distance = colorDistance(kept[a]!.lab, kept[b]!.lab)
        if (distance < pairDistance) {
          pairDistance = distance
          pair = [a, b]
        }
      }
    }
    if (!pair || pairDistance >= lost.distance) break
    const centres = [...kept.filter((_, at) => at !== pair![0] && at !== pair![1]).map((color) => color.lab), toOklab(representative([...kept[pair[0]]!.box, ...kept[pair[1]]!.box])), labOf(lost.color)]
    const next: WeightedColor[][] = centres.map(() => [])
    for (const color of all) {
      const lab = labOf(color)
      let best = 0
      let bestDistance = Infinity
      centres.forEach((centre, at) => {
        const distance = colorDistance(lab, centre)
        if (distance < bestDistance) {
          bestDistance = distance
          best = at
        }
      })
      next[best]!.push(color)
    }
    kept = next.filter((box) => box.length > 0).map((box) => ({ box, lab: toOklab(representative(box)) }))
  }
  return kept.map((color) => color.box)
}

/** At most `maxColors` colors for sampled cell colors, ordered by coverage. Up to `maxColors` distinct colors skip median
 * cut; two boxes that average to one hex count as one color. A distinct color the cut lost takes a slot back
 * (keepDistinctColors). */
export function reducePictureColors(counts: ReadonlyMap<string, number>, maxColors: number): ReducedColors {
  const sampled: WeightedColor[] = [...counts].map(([hex, count]) => ({ hex, rgb: channelsOf(hex), count }))
  const boxes = sampled.length === 0 ? [] : sampled.length <= maxColors ? sampled.map((color) => [color]) : keepDistinctColors(medianCut(sampled, maxColors), maxColors)

  const byHex = new Map<string, string>()
  const coverage = new Map<string, number>()
  for (const box of boxes) {
    const kept = boxColor(box)
    for (const color of box) {
      byHex.set(color.hex, kept)
      coverage.set(kept, (coverage.get(kept) ?? 0) + color.count)
    }
  }

  const colors = [...coverage]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => (b.count === a.count ? a.hex.localeCompare(b.hex) : b.count - a.count))
  return { colors, byHex }
}
