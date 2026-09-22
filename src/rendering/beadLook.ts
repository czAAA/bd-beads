import { cachedSprite, type Sprite } from './sprites'

/**
 * How a single bead looks (ADR 0018): the one part of the Pattern renderer that knows. The renderer decides where a
 * bead goes and how big it is; a `BeadDrawer` decides what is drawn there. Only today's look exists — a flat square or
 * rounded bead with a thin paper-colored rim — but a richer one (glossy, faceted) is a different function handed to
 * `renderPattern`, not a rewrite of it.
 */

/** The drawing calls the renderer and the bead drawer use: the part of CanvasRenderingContext2D they need, so a test can stand in for a real canvas. */
export type DrawingContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'setTransform'
  | 'clearRect'
  | 'fillRect'
  | 'beginPath'
  | 'rect'
  | 'clip'
  | 'moveTo'
  | 'lineTo'
  | 'arcTo'
  | 'roundRect'
  | 'drawImage'
  | 'imageSmoothingEnabled'
  | 'closePath'
  | 'fill'
  | 'fillStyle'
  | 'globalAlpha'
>

/**
 * The colors a Pattern is drawn in. The defaults are the app's own (style.css): the values are copied rather than read
 * from CSS so the renderer draws the same in a canvas, an export and a test, none of which have a stylesheet to ask.
 */
export interface PatternTheme {
  /** Behind everything: what shows through the gaps and what a finished row is dimmed against. */
  background: string
  /** The rim around every bead. */
  rim: string
  /** An empty bead: tinted rather than blank, so "nothing painted here yet" doesn't read as a blank canvas. */
  emptyBead: string
  /** Brick stitch's seam between rows. */
  seam: string
  /** The mark that shows where the weaver has got to (the Row progress marker). */
  marker: string
  /** The dark outline of a hover preview that has no color to show. */
  outline: string
}

export const DEFAULT_THEME: PatternTheme = {
  background: '#ffffff', // --color-paper-solid
  rim: '#f2faef', // --color-paper
  emptyBead: '#c7cdd5', // --color-ink (#1d3658) 25% over --color-paper-solid
  seam: '#1d3658', // --color-ink
  marker: '#447a9c', // --color-wedgewood
  outline: '#1d3658', // --color-ink
}

/** How faded a finished row is: the same 0.35 the DOM grid gave it. */
export const DIMMED_OPACITY = 0.35

/** Everything a bead drawer is told about the bead it is drawing. Positions and sizes are in the Pattern's own px at zoom 1: the renderer has already set the transform for zoom and rotation. */
export interface BeadShape {
  x: number
  y: number
  size: number
  /** 0 for a square bead. */
  cornerRadius: number
  /** The bead's color, or null for an empty one. */
  color: string | null
  /** Whether the bead is in a finished row, drawn faded and in greys. */
  dimmed: boolean
  /**
   * With `dimmed`: the color the faded bead sits over, so that it is drawn as opaque pieces already blended with it
   * instead of translucent ones over whatever is beneath. What a bead faded on the overlay layer needs, to cover the bead
   * on the cells layer under it.
   */
  backdrop?: string
  /** Device pixels per px of the bead's own space (zoom times pixel ratio): how big the bead is on the screen's own grid of pixels, for a look that keeps bitmaps of its beads. */
  deviceScale: number
  theme: PatternTheme
}

export type BeadDrawer = (context: DrawingContext, bead: BeadShape) => void

/** Width of the rim around each bead, in the Pattern's own px. */
export const RIM_PX = 1

/**
 * A color's grey, worked out directly. A finished row is drawn as its greyscale at reduced opacity, and canvas filters
 * (`ctx.filter = 'grayscale(1)'`) are missing on iPad Safari, so nothing here leans on one. The weights are the ones CSS's
 * grayscale() uses, so the result is the grey the DOM grid showed.
 */
export function greyscale(color: string): string {
  const rgb = parseHex(color)
  if (!rgb) {
    return color
  }
  const grey = Math.round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2])
  return `rgb(${grey}, ${grey}, ${grey})`
}

/** Parses #rgb and #rrggbb, the forms a Pattern's colors are stored in, and the rgb(r, g, b) that greyscale makes. */
function parseHex(color: string): [number, number, number] | undefined {
  const rgb = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(color.trim())
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  }
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match) {
    return undefined
  }
  const digits = match[1]!.length === 3 ? [...match[1]!].map((digit) => digit + digit).join('') : match[1]!
  return [0, 2, 4].map((start) => Number.parseInt(digits.slice(start, start + 2), 16)) as [number, number, number]
}

/**
 * A rounded rectangle as a path, with the corners cut by `radius` (0 for square). Left open on purpose: a fill closes
 * every subpath itself, and closePath is what made a path of a whole row's beads slow — it costs by the number of
 * subpaths already in the path.
 */
function roundedRectPath(context: DrawingContext, x: number, y: number, width: number, height: number, radius: number): void {
  if (radius <= 0) {
    context.moveTo(x, y)
    context.lineTo(x + width, y)
    context.lineTo(x + width, y + height)
    context.lineTo(x, y + height)
    return
  }
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
}

/**
 * A filled square, or rounded square, as cheaply as a canvas can: a rectangle, or the browser's own rounded rectangle,
 * which it draws by a fast path that a path built from arcs does not get. (Where a browser has no roundRect yet, the
 * same shape from arcs.)
 */
function fillShape(context: DrawingContext, x: number, y: number, size: number, radius: number): void {
  if (radius <= 0) {
    context.fillRect(x, y, size, size)
    return
  }
  context.beginPath()
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, size, size, radius)
  } else {
    roundedRectPath(context, x, y, size, size, radius)
  }
  context.fill()
}

/** A color faded to a fraction of itself over another: what a translucent bead over a known backdrop comes to. */
export function fadeOver(color: string, backdrop: string, opacity: number): string {
  const top = parseHex(color)
  const under = parseHex(backdrop)
  if (!top || !under) {
    return color
  }
  const [r, g, b] = top.map((channel, index) => Math.round(channel * opacity + under[index]! * (1 - opacity)))
  return `rgb(${r}, ${g}, ${b})`
}

/** The bead drawn straight onto a context, every shape a fill. */
function drawBeadShapes(context: DrawingContext, { x, y, size, cornerRadius, color, dimmed, backdrop, theme }: BeadShape): void {
  const fill = color ?? theme.emptyBead
  const innerSize = size - RIM_PX * 2
  const innerRadius = Math.max(0, cornerRadius - RIM_PX)

  if (!dimmed || backdrop) {
    // A faded bead over a known backdrop is the same two shapes in the colors that fade comes to.
    context.fillStyle = dimmed ? fadeOver(greyscale(theme.rim), backdrop!, DIMMED_OPACITY) : theme.rim
    fillShape(context, x, y, size, cornerRadius)
    context.fillStyle = dimmed ? fadeOver(greyscale(fill), backdrop!, DIMMED_OPACITY) : fill
    fillShape(context, x + RIM_PX, y + RIM_PX, innerSize, innerRadius)
    return
  }

  context.save()
  context.globalAlpha = DIMMED_OPACITY
  context.fillStyle = greyscale(fill)
  context.beginPath()
  roundedRectPath(context, x + RIM_PX, y + RIM_PX, innerSize, innerSize, innerRadius)
  context.fill()

  context.fillStyle = greyscale(theme.rim)
  context.beginPath()
  roundedRectPath(context, x, y, size, size, cornerRadius)
  roundedRectPath(context, x + RIM_PX, y + RIM_PX, innerSize, innerSize, innerRadius)
  context.fill('evenodd')
  context.restore()
}

function spriteFor(bead: BeadShape): Sprite | undefined {
  const pixels = Math.max(1, Math.round(bead.size * bead.deviceScale))
  const { theme } = bead
  const key = ['bead', pixels, bead.cornerRadius, bead.dimmed ? 'd' : 'p', bead.backdrop ?? '', bead.color ?? '', theme.rim, theme.emptyBead].join('|')
  return cachedSprite(key, pixels, bead.size, (context) => drawBeadShapes(context, { ...bead, x: 0, y: 0 }))
}

/**
 * Today's bead: a square (or, for peyote, rounded) bead in its color inside a thin rim in the paper color, a finished
 * row's beads in grey at reduced opacity (their rim and their bead as pieces that don't overlap, so the faded rim
 * doesn't show the bead through it).
 *
 * A Pattern of thousands of beads is redrawn on every move of a drag in the Convert image preview, and on every scroll
 * of the editor, so how cheaply a bead is drawn is what keeps those smooth. A square bead is two rectangles, the
 * cheapest fill there is; anything rounded or faded is a bitmap kept from the first time that look was drawn (batching
 * a row's beads into one path was tried, and is slower than either: a path with many subpaths costs more than the sum
 * of its parts).
 */
export const drawFlatBead: BeadDrawer = (context, bead) => {
  const sprite = bead.cornerRadius > 0 || bead.dimmed ? spriteFor(bead) : undefined
  if (sprite) {
    context.drawImage(sprite, bead.x, bead.y, bead.size, bead.size)
    return
  }
  drawBeadShapes(context, bead)
}
