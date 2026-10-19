import { fromHex } from '../domain/color'
import { cachedSprite, type Sprite } from './sprites'

// How a single bead looks (ADR 0018): the one part of the Project renderer that knows. The renderer decides where a
// bead goes and how big; a `BeadDrawer` decides what is drawn. Only one look exists, but a richer one (glossy, faceted)
// is another function handed to `renderProject`, not a rewrite.

/** The drawing calls the renderer and the bead drawer use: the part of CanvasRenderingContext2D they need, so a test
 * can stand in for a real canvas. */
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
  | 'arc'
  | 'roundRect'
  | 'drawImage'
  | 'createPattern'
  | 'imageSmoothingEnabled'
  | 'closePath'
  | 'fill'
  | 'fillStyle'
  | 'globalAlpha'
  | 'globalCompositeOperation'
  | 'stroke'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineCap'
  | 'lineJoin'
  | 'setLineDash'
  | 'fillText'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'translate'
  | 'rotate'
>

/** The white tint of dark's rim (`bead-rim`, dark). */
const WHITE_RIM = 'rgba(255,255,255,.16)'

// The colors a Project is drawn in, one set per theme (DESIGN.md §4.2). Copied from the design system's tokens, not
// read from CSS, so the renderer draws the same in a canvas, an export and a test; projectThemes.test.ts keeps them
// equal to tokens.json.
export interface ProjectTheme {
  /** The Canvas the editor draws on (`box`): the drawing area's own background, which a finished row on it fades
   * toward. Exports and the Convert image preview use `background`, the board, instead. */
  canvas: string
  /** The Position marks on the Canvas, dots or squares (`position-mark`). */
  positionMark: string
  /** The rectangle round a piece (`line-strong`), and round the piece being drawn (`muted`). */
  pieceLine: string
  /** The Frame's line and handles (`ink`). */
  frameLine: string
  /** Ruler numbers: regular (`ruler`) and every 5th, bold (`body`). */
  ruler: string
  rulerStrong: string
  /** The board: behind everything, what shows through the gaps and what a finished row fades toward (`board`). */
  background: string
  /** The faint rim round every bead (`bead-rim`). */
  rim: string
  /** The rim of a near-black bead, where a dark `rim` would vanish: white in light and dark, the theme's own `rim`
   * in high contrast. */
  rimOnBlack: string
  /** An empty bead: tinted rather than blank, so "nothing painted here yet" doesn't read as a blank board
   * (`bead-empty`). */
  emptyBead: string
  /** The mark that shows where the weaver has got to: the current-row outline (`marker`). */
  marker: string
  /** The outline of a hover preview that has no color to show (`bead-outline`). */
  outline: string
  /** A bead in a finished row: its own color at `opacity` over the board in every theme (ticket 352), never grey;
   * `grey` is the greyscale option. */
  finished: { grey: boolean; opacity: number }
  /** The keyboard's bead cursor ring (`focus-ring`) and its width: 2px, 3px in high contrast (BeadCursor card). */
  cursor: string
  cursorWidth: number
  /** The dashed outline the Tour puts on beads to paint and on frames to select or paste into (`tour-highlight`;
   * black in high contrast). */
  tourMark: string
}

/** How much of a finished bead's own color shows over the board while finished rows are dimmed (ticket 352). */
const FINISHED_OPACITY = 0.5

/** The light theme (BeadBoard card). */
export const LIGHT_THEME: ProjectTheme = {
  canvas: '#fafafa',
  positionMark: '#d8d2cc',
  pieceLine: '#c7c7c7',
  frameLine: '#1f1f1f',
  ruler: '#6a6a6a',
  rulerStrong: '#4a4a4a',
  background: '#e8e3df',
  rim: 'rgba(20,20,19,.12)',
  rimOnBlack: WHITE_RIM,
  emptyBead: '#d8d2cc',
  marker: '#1d4ed8',
  outline: '#1f1f1f',
  finished: { grey: false, opacity: FINISHED_OPACITY },
  cursor: '#c23604',
  cursorWidth: 2,
  tourMark: '#f2c94c',
}

/** The dark theme: a white rim, so two beads of one color stay apart. */
export const DARK_THEME: ProjectTheme = {
  canvas: '#202020',
  positionMark: '#3c3c3c',
  pieceLine: '#3a3a3a',
  frameLine: '#ffffff',
  ruler: '#8c8c8c',
  rulerStrong: '#cccccc',
  background: '#202020',
  rim: WHITE_RIM,
  rimOnBlack: WHITE_RIM,
  emptyBead: '#3c3c3c',
  marker: '#faff69',
  outline: '#ffffff',
  finished: { grey: false, opacity: FINISHED_OPACITY },
  cursor: '#faff69',
  cursorWidth: 2,
  tourMark: '#f2c94c',
}

/** High contrast: light-based, with a stronger rim and black marks. Bead colors never change. */
const CONTRAST_THEME: ProjectTheme = {
  canvas: '#ffffff',
  positionMark: '#b8b0a8',
  pieceLine: '#000000',
  frameLine: '#000000',
  ruler: '#3d3d3d',
  rulerStrong: '#1f1f1f',
  background: '#e8e3df',
  rim: 'rgba(0,0,0,.35)',
  rimOnBlack: 'rgba(0,0,0,.35)',
  emptyBead: '#b8b0a8',
  marker: '#000000',
  outline: '#000000',
  finished: { grey: false, opacity: FINISHED_OPACITY },
  cursor: '#000000',
  cursorWidth: 3,
  tourMark: '#000000',
}

/** PNG and PDF exports and the Convert image preview: always light, whatever the app's theme, on the `print-board`. */
export const PRINT_THEME: ProjectTheme = { ...LIGHT_THEME, background: '#f7f3ec' }

/** The theme a renderer uses when it isn't told one. */
export const DEFAULT_THEME = LIGHT_THEME

export const PROJECT_THEMES: Readonly<Record<'light' | 'dark' | 'contrast', ProjectTheme>> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  contrast: CONTRAST_THEME,
}

/** Everything a bead drawer is told about the bead it is drawing. Positions and sizes are in the Project's own px at
 * zoom 1: the renderer has already set the transform for zoom and rotation. */
export interface BeadShape {
  x: number
  y: number
  size: number
  /** The bead's own width and height where it isn't `size` square (Right-angle weave, ticket 482): a bead lying the
   * other way is the same bead turned a quarter. */
  width?: number
  height?: number
  /** 0 for a square bead. */
  cornerRadius: number
  /** The bead's color, or null for an empty one. */
  color: string | null
  /** Whether the bead is in a finished row, drawn faded and in greys. */
  dimmed: boolean
  // With `dimmed`: the color the faded bead sits over, so it is drawn as opaque pieces already blended with it. What a
  // bead faded on the overlay layer needs, to cover the bead on the cells layer under it.
  backdrop?: string
  /** Device pixels per px of the bead's own space (zoom times pixel ratio): how big the bead is on the screen's own
   * grid of pixels, for a look that keeps bitmaps of its beads. */
  deviceScale: number
  theme: ProjectTheme
}

export type BeadDrawer = (context: DrawingContext, bead: BeadShape) => void

/** The gap between two neighbouring beads, in the Project's own px (ticket 458): each bead stands half of it in from
 * its cell on every side. */
export const BEAD_GAP_PX = 1

/** How far a bead stands in from its cell on each side. */
const GAP_PX = BEAD_GAP_PX / 2

/** Width of the faint rim inside each bead's edge, in the Project's own px. */
const RIM_PX = 0.75

/** Below this luma (0-255) a bead is near-black. */
const NEAR_BLACK_LUMA = 45

function luma(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function isNearBlack(color: string): boolean {
  const rgb = parseHex(color)
  return !!rgb && luma(rgb) < NEAR_BLACK_LUMA
}

// A color's grey, worked out directly: canvas filters (`ctx.filter = 'grayscale(1)'`) are missing on iPad Safari. The
// weights are CSS grayscale()'s, so the result is the grey the DOM grid showed.
export function greyscale(color: string): string {
  const rgb = parseHex(color)
  if (!rgb) {
    return color
  }
  const grey = Math.round(luma(rgb))
  return `rgb(${grey}, ${grey}, ${grey})`
}

/** How much brighter the current row's beads are than the todo rows (ticket 352). */
export const CURRENT_ROW_BRIGHTNESS = 0.1

/** The color lifted toward white by `amount` (0 to 1): the current row's 10% brighter beads (ticket 352). A color it
 * cannot read comes back as it was. */
export function brighten(color: string, amount: number): string {
  const rgb = parseHex(color)
  if (!rgb) {
    return color
  }
  const [r, g, b] = rgb.map((channel) => Math.round(channel + (255 - channel) * amount))
  return `rgb(${r}, ${g}, ${b})`
}

/** Reads #rgb and #rrggbb, the forms a Project's colors are stored in, and the rgb(r, g, b) that greyscale makes. */
function parseHex(color: string): [number, number, number] | undefined {
  const rgb = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(color.trim())
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  }
  const channels = fromHex(color.trim())
  return channels && [channels.r, channels.g, channels.b]
}

// A rounded rectangle as a path, corners cut by `radius` (0 for square). Left open on purpose: a fill closes every
// subpath itself, and closePath made a path of a whole row's beads slow (it costs by the subpaths already in the path).
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

// A filled square, or rounded square, as cheaply as a canvas can: a rectangle, or the browser's own roundRect (a fast
// path that arcs don't get); arcs where a browser has no roundRect yet.
function fillShape(context: DrawingContext, x: number, y: number, width: number, height: number, radius: number): void {
  if (radius <= 0) {
    context.fillRect(x, y, width, height)
    return
  }
  context.beginPath()
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, radius)
  } else {
    roundedRectPath(context, x, y, width, height, radius)
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

// Blends worked out so far: a Project has few colors but thousands of beads, and re-parsing per bead is what a scroll
// or framing drag would pay.
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
function finishedColor(color: string, theme: ProjectTheme, backdrop = theme.background): string {
  return fadeOver(theme.finished.grey ? greyscale(color) : color, backdrop, theme.finished.opacity)
}

// The bead drawn straight onto a context, every shape an opaque fill: the bead a gap in from its cell and a faint rim
// just inside its edge. A finished bead is the same shapes in its faded colors, so it covers whatever is under it (the
// bead on the cells layer, when drawn on the overlay).
function drawBeadShapes(context: DrawingContext, { x, y, size, width = size, height = size, cornerRadius, color, dimmed, backdrop, theme }: BeadShape): void {
  const own = color ?? theme.emptyBead
  const fill = dimmed ? finishedColor(own, theme, backdrop) : own
  const outerWidth = width - GAP_PX * 2
  const outerHeight = height - GAP_PX * 2
  // A corner is at most half the shorter side: a round bead drawn longer than wide is a pill.
  const outerRadius = Math.min(Math.max(0, cornerRadius - GAP_PX), outerWidth / 2, outerHeight / 2)

  context.fillStyle = blendOver(isNearBlack(own) ? theme.rimOnBlack : theme.rim, fill)
  fillShape(context, x + GAP_PX, y + GAP_PX, outerWidth, outerHeight, outerRadius)
  context.fillStyle = fill
  fillShape(context, x + GAP_PX + RIM_PX, y + GAP_PX + RIM_PX, outerWidth - RIM_PX * 2, outerHeight - RIM_PX * 2, Math.max(0, outerRadius - RIM_PX))
}

function spriteFor(bead: BeadShape): Sprite | undefined {
  const pixels = Math.max(1, Math.round(bead.size * bead.deviceScale))
  const { theme } = bead
  const key = ['bead', pixels, bead.cornerRadius, bead.dimmed ? 'd' : 'p', bead.backdrop ?? '', bead.color ?? '', theme.background, theme.rim, theme.emptyBead].join('|')
  return cachedSprite(key, pixels, bead.size, (context) => drawBeadShapes(context, { ...bead, x: 0, y: 0 }))
}

// The design system's bead (BeadBoard card): a square (rounded for peyote) bead with a faint rim; finished rows faded.
// Redrawn thousands of times per drag/scroll, so a square is two rectangles and rounded or faded is a cached bitmap;
// batching a row into one path was slower (many subpaths cost more than their sum).
export const drawFlatBead: BeadDrawer = (context, bead) => {
  const sprite = (bead.cornerRadius > 0 || bead.dimmed) && bead.width === undefined ? spriteFor(bead) : undefined
  if (sprite) {
    context.drawImage(sprite, bead.x, bead.y, bead.size, bead.size)
    return
  }
  drawBeadShapes(context, bead)
}
