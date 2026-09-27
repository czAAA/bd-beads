import { cachedSprite, type Sprite } from './sprites'

/**
 * How a single bead looks (ADR 0018): the one part of the Pattern renderer that knows. The renderer decides where a
 * bead goes and how big it is; a `BeadDrawer` decides what is drawn there. Only one look exists — the design system's flat
 * square or rounded bead on the board — but a richer one (glossy, faceted) is a different function handed to
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
 * The colors a Pattern is drawn in, one set per theme (DESIGN.md §4.2). The values are copied from the design system's
 * tokens rather than read from CSS, so the renderer draws the same in a canvas, an export and a test, none of which have
 * a stylesheet to ask; patternThemes.test.ts keeps them equal to tokens.json.
 */
export interface PatternTheme {
  /** The board: behind everything, what shows through the gaps and what a finished row fades toward (`board`). */
  background: string
  /** The faint rim round every bead (`bead-rim`), or null for none: dark draws none. */
  rim: string | null
  /** An empty bead: tinted rather than blank, so "nothing painted here yet" doesn't read as a blank board (`bead-empty`). */
  emptyBead: string
  /** Brick stitch's seam between rows (`bead-seam`). */
  seam: string
  /** The mark that shows where the weaver has got to: the current-row outline (`marker`). */
  marker: string
  /** The outline of a hover preview that has no color to show (`bead-outline`). */
  outline: string
  /**
   * How a bead in a finished row is drawn: its own color, or its grey, at `opacity` over the board. Light fades the
   * color (28%), so a finished row still reads as the Pattern; dark greys it (45%).
   */
  finished: { grey: boolean; opacity: number }
  /** The keyboard's bead cursor ring (`focus-ring`) and its width: 2px, 3px in high contrast (BeadCursor card). */
  cursor: string
  cursorWidth: number
}

/** The light theme (BeadBoard card). */
export const LIGHT_THEME: PatternTheme = {
  background: '#e8e3df',
  rim: 'rgba(20,20,19,.12)',
  emptyBead: '#d8d2cc',
  seam: '#1f1f1f',
  marker: '#1f1f1f',
  outline: '#1f1f1f',
  finished: { grey: false, opacity: 0.28 },
  cursor: '#c23604',
  cursorWidth: 2,
}

/** The dark theme: no rim, finished rows in grey. */
export const DARK_THEME: PatternTheme = {
  background: '#1a1a1a',
  rim: null,
  emptyBead: '#2a2a2a',
  seam: '#888888',
  marker: '#faff69',
  outline: '#ffffff',
  finished: { grey: true, opacity: 0.45 },
  cursor: '#faff69',
  cursorWidth: 2,
}

/** High contrast: light-based, with a stronger rim and black marks. Bead colors never change. */
export const CONTRAST_THEME: PatternTheme = {
  background: '#e8e3df',
  rim: 'rgba(0,0,0,.35)',
  emptyBead: '#b8b0a8',
  seam: '#000000',
  marker: '#000000',
  outline: '#000000',
  finished: { grey: false, opacity: 0.28 },
  cursor: '#000000',
  cursorWidth: 3,
}

/** PNG and PDF exports and the Convert image preview: always light, whatever the app's theme, on the `print-board`. */
export const PRINT_THEME: PatternTheme = { ...LIGHT_THEME, background: '#f7f3ec' }

/** The theme a renderer uses when it isn't told one. */
export const DEFAULT_THEME = LIGHT_THEME

export const PATTERN_THEMES: Readonly<Record<'light' | 'dark' | 'contrast', PatternTheme>> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  contrast: CONTRAST_THEME,
}

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

/** The gap between two beads is twice this: each bead stands this far in from its cell on every side, in the Pattern's own px. */
export const GAP_PX = 1

/** Width of the faint rim inside each bead's edge, in the Pattern's own px. */
export const RIM_PX = 0.75

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

/**
 * Blends worked out so far. Every square bead on screen asks for its rim over its own color, and a Pattern has only a
 * handful of colors, so parsing them again for each of thousands of beads is what a scroll or a framing drag would pay.
 */
const blends = new Map<string, string>()

/** A translucent rgba(r,g,b,a) over an opaque color, as one opaque color; anything else is returned as it is. */
export function blendOver(color: string, backdrop: string): string {
  const key = `${color}|${backdrop}`
  let blended = blends.get(key)
  if (blended === undefined) {
    blended = blendUncached(color, backdrop)
    if (blends.size > 4096) blends.clear()
    blends.set(key, blended)
  }
  return blended
}

function blendUncached(color: string, backdrop: string): string {
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(color.trim())
  if (!rgba) {
    return color
  }
  const hex = `#${[rgba[1], rgba[2], rgba[3]].map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`
  return fadeOver(hex, backdrop, Number(rgba[4]))
}

/** A finished row's bead: its color, or its grey, faded toward the board (or the backdrop it is drawn over). */
export function finishedColor(color: string, theme: PatternTheme, backdrop = theme.background): string {
  return fadeOver(theme.finished.grey ? greyscale(color) : color, backdrop, theme.finished.opacity)
}

/**
 * The bead drawn straight onto a context, every shape an opaque fill: the bead a gap in from its cell, and in light a
 * faint rim just inside its edge. A finished bead is the same shapes in the colors its fade comes to, so it covers
 * whatever is under it (a finished bead drawn on the overlay covers the bead on the cells layer).
 */
function drawBeadShapes(context: DrawingContext, { x, y, size, cornerRadius, color, dimmed, backdrop, theme }: BeadShape): void {
  const own = color ?? theme.emptyBead
  const fill = dimmed ? finishedColor(own, theme, backdrop) : own
  const outerSize = size - GAP_PX * 2
  const outerRadius = Math.max(0, cornerRadius - GAP_PX)

  if (!theme.rim) {
    context.fillStyle = fill
    fillShape(context, x + GAP_PX, y + GAP_PX, outerSize, outerRadius)
    return
  }
  context.fillStyle = blendOver(theme.rim, fill)
  fillShape(context, x + GAP_PX, y + GAP_PX, outerSize, outerRadius)
  context.fillStyle = fill
  fillShape(context, x + GAP_PX + RIM_PX, y + GAP_PX + RIM_PX, outerSize - RIM_PX * 2, Math.max(0, outerRadius - RIM_PX))
}

function spriteFor(bead: BeadShape): Sprite | undefined {
  const pixels = Math.max(1, Math.round(bead.size * bead.deviceScale))
  const { theme } = bead
  const key = ['bead', pixels, bead.cornerRadius, bead.dimmed ? 'd' : 'p', bead.backdrop ?? '', bead.color ?? '', theme.background, theme.rim ?? '', theme.emptyBead].join('|')
  return cachedSprite(key, pixels, bead.size, (context) => drawBeadShapes(context, { ...bead, x: 0, y: 0 }))
}

/**
 * The design system's bead (BeadBoard card): a square (or, for peyote, rounded) bead in its color on the board, a gap
 * from its neighbours, with a faint rim in light; a finished row's beads faded toward the board.
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
