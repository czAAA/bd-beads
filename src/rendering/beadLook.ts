import { BLACK, contrastRatio, fromHex, luma, mix, toHex, WHITE, type Rgb } from '../domain/color'
import { autoMarginColor, marginLookOn, type MarginLook } from './marginLook'
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
  | 'createRadialGradient'
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
  | 'scale'
  | 'transform'
  | 'getTransform'
  | 'shadowColor'
  | 'shadowBlur'
  | 'shadowOffsetY'
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
  /** The Position marks on the Canvas (`position-mark`). */
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
  /** The faint rim round every bead (`bead-rim`), where `ownColorRim` is off. */
  rim: string
  /** Whether a bead sits in a rim of its own color with a satin light (ticket 1003, BeadBoard card, Canvas look): the
   * screen in light and dark. High contrast and exports keep the flat bead in `rim`. */
  ownColorRim: boolean
  /** The rim of a near-black bead, where a dark `rim` would vanish: white in light and dark, the theme's own `rim`
   * in high contrast. */
  rimOnBlack: string
  /** An empty bead: tinted rather than blank, so "nothing painted here yet" doesn't read as a blank board
   * (`bead-empty`). */
  emptyBead: string
  /** The mark that shows where the weaver has got to: the current-row outline (`marker`). */
  marker: string
  /** The Mirror's Area (`mirror`, ContextBar card, ticket 0806): Mirror mode's rubber band, a Canvas Area's line, the
   * Axis lines, Radial's ring and the hover preview's outline inside the Area, so it is never taken for a Selection. */
  mirror: string
  /** Edit Frame's hot corners and edge bars on the Frame's line (`accent`, MarginSheet card, ticket 0657). */
  accent: string
  /** The outline of a hover preview that has no color to show (`bead-outline`). */
  outline: string
  /** A bead in a finished row: its own color at `opacity` over the board in every theme (ticket 352), never grey;
   * `grey` is the greyscale option. */
  finished: { grey: boolean; opacity: number }
  /** The Frame's margin sheet on the Canvas (MarginSheet card, ticket 0656): Auto on `canvas` until one is picked. */
  margin: MarginLook
}

/** A theme with its Auto margin sheet on its own canvas. */
function withAutoMargin(look: 'light' | 'dark', theme: Omit<ProjectTheme, 'margin'>): ProjectTheme {
  return { ...theme, margin: marginLookOn(autoMarginColor(theme.canvas, look), theme) }
}

/** How much of a finished bead's own color shows over the board while finished rows are dimmed (ticket 352). */
const FINISHED_OPACITY = 0.5

/** The light theme (BeadBoard card). */
export const LIGHT_THEME: ProjectTheme = withAutoMargin('light', {
  canvas: '#fafafa',
  positionMark: '#d8d2cc',
  pieceLine: '#c7c7c7',
  frameLine: '#1f1f1f',
  ruler: '#6a6a6a',
  rulerStrong: '#4a4a4a',
  background: '#e8e3df',
  rim: 'rgba(20,20,19,.12)',
  ownColorRim: true,
  rimOnBlack: WHITE_RIM,
  emptyBead: '#d8d2cc',
  marker: '#1d4ed8',
  mirror: '#c026d3',
  accent: '#fa520f',
  outline: '#1f1f1f',
  finished: { grey: false, opacity: FINISHED_OPACITY },
})

/** The dark theme: a white rim, so two beads of one color stay apart.
 * @internal Tests draw in the dark theme. */
export const DARK_THEME: ProjectTheme = withAutoMargin('dark', {
  canvas: '#202020',
  positionMark: '#3c3c3c',
  pieceLine: '#3a3a3a',
  frameLine: '#ffffff',
  ruler: '#8c8c8c',
  rulerStrong: '#cccccc',
  background: '#202020',
  rim: WHITE_RIM,
  ownColorRim: true,
  rimOnBlack: WHITE_RIM,
  emptyBead: '#3c3c3c',
  marker: '#faff69',
  mirror: '#b79cff',
  accent: '#faff69',
  outline: '#ffffff',
  finished: { grey: false, opacity: FINISHED_OPACITY },
})

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
  ownColorRim: false,
  rimOnBlack: 'rgba(0,0,0,.35)',
  emptyBead: '#b8b0a8',
  marker: '#000000',
  mirror: '#6d28d9',
  accent: '#a82c00',
  outline: '#000000',
  finished: { grey: false, opacity: FINISHED_OPACITY },
  // White paper with a black edge whatever is picked (MarginSheet card); the inner border is `margin-line`.
  margin: { fill: '#ffffff', line: '#595959', edge: '#000000', edgeWidth: 2, ruler: '#3d3d3d', rulerStrong: '#1f1f1f' },
}

/** PNG and PDF exports: always light, whatever the app's theme, on the `print-board`, in the flat bead. */
export const PRINT_THEME: ProjectTheme = { ...LIGHT_THEME, background: '#f7f3ec', ownColorRim: false }

const flatLooks = new WeakMap<ProjectTheme, ProjectTheme>()

/** A theme in the flat bead, one object per theme so its colors stay kept: what the beads the overlay lifts are drawn
 * in where the Canvas is in the draft look, so they stay as they were (ticket 1003). */
export function flatLook(theme: ProjectTheme): ProjectTheme {
  if (!theme.ownColorRim) return theme
  let look = flatLooks.get(theme)
  if (!look) {
    look = { ...theme, ownColorRim: false }
    flatLooks.set(theme, look)
  }
  return look
}

/** The theme a renderer uses when it isn't told one. */
export const DEFAULT_THEME = LIGHT_THEME

export const PROJECT_THEMES: Readonly<Record<'light' | 'dark' | 'contrast', ProjectTheme>> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  contrast: CONTRAST_THEME,
}

/** Everything a bead drawer is told about the bead it is drawing. Positions and sizes are in the Project's own px at
 * zoom 1: the renderer has already set the transform for zoom and rotation.
 * @internal Tests type the shapes they draw. */
export interface BeadShape {
  x: number
  y: number
  size: number
  /** The bead's own width and height where it isn't `size` square (a Bead's cell, ADR 0068, ticket 0724). */
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

function isNearBlack(color: string): boolean {
  const rgb = parseColor(color)
  return !!rgb && luma(rgb) < NEAR_BLACK_LUMA
}

/** A color's grey, worked out directly: canvas filters (`ctx.filter = 'grayscale(1)'`) are missing on iPad Safari. The
 * weights are CSS grayscale()'s, so the result is the grey the DOM grid showed.
 * @internal Tests check a dimmed bead's grey. */
export function greyscale(color: string): string {
  const rgb = parseColor(color)
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
  const rgb = parseColor(color)
  return rgb ? rgbText(mix(rgb, WHITE, amount)) : color
}

/** Reads #rgb and #rrggbb, the forms a Project's colors are stored in, and the rgb(r, g, b) that greyscale, a fade and
 * a lit row make: what the draft look's pixels are read from too (ticket 0676). */
export function parseColor(color: string): Rgb | undefined {
  const rgb = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(color.trim())
  return rgb ? { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) } : fromHex(color.trim())
}

/** A color as the canvas `rgb(r, g, b)` this file writes, each channel rounded. */
function rgbText({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
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

/** A color faded to a fraction of itself over another: what a translucent bead over a known backdrop comes to.
 * @internal Tests check a faded bead's color. */
export function fadeOver(color: string, backdrop: string, opacity: number): string {
  const top = parseColor(color)
  const under = parseColor(backdrop)
  return top && under ? rgbText(mix(under, top, opacity)) : color
}

// Blends worked out so far: a Project has few colors but thousands of beads, and re-parsing per bead is what a scroll
// or framing drag would pay.
const blends = new Map<string, string>()

/** A translucent rgba(r,g,b,a) over an opaque color, as one opaque color; anything else is returned as it is.
 * @internal Tests check a translucent color laid over another. */
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
  return fadeOver(toHex({ r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) }), backdrop, Number(rgba[4]))
}

/** A finished row's bead: its color, or its grey, faded toward the board (or the backdrop it is drawn over). */
function finishedColor(color: string, theme: ProjectTheme, backdrop = theme.background): string {
  return fadeOver(theme.finished.grey ? greyscale(color) : color, backdrop, theme.finished.opacity)
}

/** A bead's two colors, its rim and its fill, its satin light where it has one, and the last bitmap made of it: worked
 * out once per color and theme, not for each of the thousands of beads a draw lays down (ticket 0676). */
interface BeadInk {
  rim: string
  fill: string
  /** With the own-color rim (ticket 1003): the light's color and its opacity at the centre and at 45% of its radius. */
  satin?: { color: Rgb; centre: number; middle: number }
  sprite?: { pixels: number; size: number; width: number; height: number; radius: number; image: Sprite | undefined }
}

/** How far the own-color rim moves the bead's color toward black, or toward white where that stays too close to it
 * (BeadBoard card, Canvas look, ticket 1003). */
const RIM_TOWARD_BLACK = 0.18
const RIM_TOWARD_WHITE = 0.11
/** The least contrast the darker rim keeps off the bead's color before the lighter one is taken. */
const RIM_LEAST_CONTRAST = 1.3

/** The own-color rim of a bead (ticket 1003): its color 18% toward black, or 11% toward white where the darker one stands
 * under 1.3:1 off it (near-black and very deep colors).
 * @internal Tests check the rule on the card's colors. */
export function ownRim(color: string): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  const darker = rounded(mix(rgb, BLACK, RIM_TOWARD_BLACK))
  return rgbText(contrastRatio(rgb, darker) < RIM_LEAST_CONTRAST ? mix(rgb, WHITE, RIM_TOWARD_WHITE) : darker)
}

function rounded({ r, g, b }: Rgb): Rgb {
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) }
}

/** The satin light (ticket 1003): the bead's color halfway to white, 38% opaque at its centre and 21% at 45% of its
 * radius, scaled down so its lift at the centre is at most 3 plus 7.5% of the bead's luma (levels of 255). */
const SATIN_TOWARD_WHITE = 0.5
const SATIN_CENTRE = 0.38
const SATIN_MIDDLE = 0.21
const SATIN_MIDDLE_AT = 0.45
const SATIN_LIFT_BASE = 3
const SATIN_LIFT_SHARE = 0.075

/** Where the light sits in the body and how big it is, as shares of the body's width and height. */
const SATIN_CENTRE_X = 0.5
const SATIN_CENTRE_Y = 0.46
const SATIN_RADIUS_X = 0.4
const SATIN_RADIUS_Y = 0.44

/** A bead's color where its satin light is brightest (ticket 1003): the light at its centre opacity over the body.
 * @internal The visual check reads a bead's centre pixel against it. */
export function satinCentre(color: Rgb): Rgb {
  const satin = satinOf(rgbText(color))
  return satin ? mix(color, satin.color, satin.centre) : color
}

/** The least corner a body in an own-color rim keeps, in the Project's own px. */
const OWN_BODY_LEAST_RADIUS = 1.25

function satinOf(color: string): BeadInk['satin'] {
  const rgb = parseColor(color)
  if (!rgb) return undefined
  const light = rounded(mix(rgb, WHITE, SATIN_TOWARD_WHITE))
  const lift = (luma(light) - luma(rgb)) * SATIN_CENTRE
  const allowed = SATIN_LIFT_BASE + SATIN_LIFT_SHARE * luma(rgb)
  const scale = lift > allowed ? allowed / lift : 1
  return { color: light, centre: SATIN_CENTRE * scale, middle: SATIN_MIDDLE * scale }
}

const inks = new WeakMap<ProjectTheme, { plain: Map<string, BeadInk>; dimmed: Map<string, BeadInk> }>()

/** A bead's colors, kept per theme; one faded over a backdrop of its own (the overlay's) is worked out afresh. */
function inkOf({ color, dimmed, backdrop, theme }: Pick<BeadShape, 'color' | 'dimmed' | 'backdrop' | 'theme'>): BeadInk {
  if (backdrop !== undefined) return mixInk(color, dimmed, backdrop, theme)
  let known = inks.get(theme)
  if (!known) {
    known = { plain: new Map(), dimmed: new Map() }
    inks.set(theme, known)
  }
  const byColor = dimmed ? known.dimmed : known.plain
  let ink = byColor.get(color ?? '')
  if (!ink) {
    ink = mixInk(color, dimmed, backdrop, theme)
    byColor.set(color ?? '', ink)
  }
  return ink
}

function mixInk(color: string | null, dimmed: boolean, backdrop: string | undefined, theme: ProjectTheme): BeadInk {
  const own = color ?? theme.emptyBead
  const fill = dimmed ? finishedColor(own, theme, backdrop) : own
  // An empty position keeps the flat bead: the rim and the light are a painted bead's (ticket 1003).
  if (theme.ownColorRim && color !== null) return { fill, rim: ownRim(fill), satin: satinOf(fill) }
  return { fill, rim: blendOver(isNearBlack(own) ? theme.rimOnBlack : theme.rim, fill) }
}

function rgbaText({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// A bead in its own-color rim (ticket 1003): the whole cell in the rim, so no Canvas shows between two beads; the body a
// gap in, flat, with the Technique's corner; and one soft light in the body's middle, gone before any edge.
function drawOwnColorBead(context: DrawingContext, { x, y, size, width = size, height = size, cornerRadius }: BeadShape, { rim, fill, satin }: BeadInk): void {
  const bodyWidth = width - GAP_PX * 2
  const bodyHeight = height - GAP_PX * 2
  const radius = Math.min(Math.max(OWN_BODY_LEAST_RADIUS, cornerRadius - GAP_PX), bodyWidth / 2, bodyHeight / 2)
  context.fillStyle = rim
  context.fillRect(x, y, width, height)
  context.fillStyle = fill
  fillShape(context, x + GAP_PX, y + GAP_PX, bodyWidth, bodyHeight, radius)
  if (!satin) return
  const light = context.createRadialGradient(0, 0, 0, 0, 0, 1)
  light.addColorStop(0, rgbaText(satin.color, satin.centre))
  light.addColorStop(SATIN_MIDDLE_AT, rgbaText(satin.color, satin.middle))
  light.addColorStop(1, rgbaText(satin.color, 0))
  context.save()
  context.translate(x + GAP_PX + bodyWidth * SATIN_CENTRE_X, y + GAP_PX + bodyHeight * SATIN_CENTRE_Y)
  context.scale(bodyWidth * SATIN_RADIUS_X, bodyHeight * SATIN_RADIUS_Y)
  context.fillStyle = light
  context.beginPath()
  context.arc(0, 0, 1, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

// The bead drawn straight onto a context, every shape an opaque fill: the bead a gap in from its cell and a faint rim
// just inside its edge. A finished bead is the same shapes in its faded colors, so it covers whatever is under it (the
// bead on the cells layer, when drawn on the overlay).
function drawBeadShapes(context: DrawingContext, { x, y, size, width = size, height = size, cornerRadius }: BeadShape, { rim, fill }: BeadInk): void {
  const outerWidth = width - GAP_PX * 2
  const outerHeight = height - GAP_PX * 2
  // A corner is at most half the shorter side: a round bead drawn longer than wide is a pill.
  const outerRadius = Math.min(Math.max(0, cornerRadius - GAP_PX), outerWidth / 2, outerHeight / 2)

  context.fillStyle = rim
  fillShape(context, x + GAP_PX, y + GAP_PX, outerWidth, outerHeight, outerRadius)
  context.fillStyle = fill
  fillShape(context, x + GAP_PX + RIM_PX, y + GAP_PX + RIM_PX, outerWidth - RIM_PX * 2, outerHeight - RIM_PX * 2, Math.max(0, outerRadius - RIM_PX))
}

/** The bitmap of a bead at its size on the screen: the ink's own last one while the size holds, as it does through a
 * draw. */
function spriteFor(bead: BeadShape, ink: BeadInk, draw: (context: DrawingContext, bead: BeadShape, ink: BeadInk) => void): Sprite | undefined {
  const { size, width = size, height = size, cornerRadius } = bead
  const pixels = Math.max(1, Math.round(size * bead.deviceScale))
  const made = ink.sprite
  if (made && made.pixels === pixels && made.size === size && made.width === width && made.height === height && made.radius === cornerRadius) {
    return made.image
  }
  const [across, down] = [Math.max(1, Math.round(width * bead.deviceScale)), Math.max(1, Math.round(height * bead.deviceScale))]
  const key = `bead|${pixels}|${size}|${width}x${height}|${cornerRadius}|${ink.rim}|${ink.fill}|${ink.satin ? 'satin' : 'flat'}`
  const image = cachedSprite(key, across, width, (context) => draw(context, { ...bead, x: 0, y: 0 }, ink), down)
  ink.sprite = { pixels, size, width, height, radius: cornerRadius, image }
  return image
}

/** The one color a bead is drawn in where it is too small to show its rim (the draft look, ticket 0676): its own, or
 * the empty bead's, faded in a finished row. Kept per theme with the full look's. */
export function beadFill(color: string | null, dimmed: boolean, theme: ProjectTheme): string {
  return inkOf({ color, dimmed, theme }).fill
}

/** The design system's bead (BeadBoard card): in its own-color rim with a satin light on screen (ticket 1003), flat with
 * a faint rim in exports and high contrast; finished rows faded. Redrawn thousands of times per drag or scroll, so a flat
 * square is two rectangles and every other bead a cached bitmap (a gradient per bead is too slow; so was one path a row). */
export const drawFlatBead: BeadDrawer = (context, bead) => {
  const ink = inkOf(bead)
  const ownColor = ink.satin !== undefined
  const draw = ownColor ? drawOwnColorBead : drawBeadShapes
  const asBitmap = ownColor || ((bead.cornerRadius > 0 || bead.dimmed) && bead.width === undefined)
  const sprite = asBitmap ? spriteFor(bead, ink, draw) : undefined
  if (sprite) {
    context.drawImage(sprite, bead.x, bead.y, bead.width ?? bead.size, bead.height ?? bead.size)
    return
  }
  draw(context, bead, ink)
}

/** An empty bead over a reference image (ReferenceImage card, ticket 0790): its rim kept opaque so the grid stays
 * readable, its fill (the empty bead's) at `opacity`, so the picture reads through it. Square or rounded as any bead. */
export function drawSeeThroughBead(context: DrawingContext, { x, y, size, width = size, height = size, cornerRadius, theme }: BeadShape, opacity: number): void {
  const outerWidth = width - GAP_PX * 2
  const outerHeight = height - GAP_PX * 2
  const outerRadius = Math.min(Math.max(0, cornerRadius - GAP_PX), outerWidth / 2, outerHeight / 2)
  const inner = [x + GAP_PX + RIM_PX, y + GAP_PX + RIM_PX, outerWidth - RIM_PX * 2, outerHeight - RIM_PX * 2, Math.max(0, outerRadius - RIM_PX)] as const
  context.beginPath()
  roundedRectPath(context, x + GAP_PX, y + GAP_PX, outerWidth, outerHeight, outerRadius)
  roundedRectPath(context, ...inner)
  context.fillStyle = blendOver(theme.rim, theme.emptyBead)
  context.fill('evenodd')
  const alpha = context.globalAlpha
  context.globalAlpha = alpha * opacity
  context.fillStyle = theme.emptyBead
  fillShape(context, ...inner)
  context.globalAlpha = alpha
}

/** A letter on a dark bead (ticket 0573; printed-output.md, Color + letters).
 * @internal Tests check the letter drawn on a dark bead. */
export const LETTER_ON_DARK = '#ffffff'
/** A letter on a light bead: the design system's `ink`, which is the same in every theme because bead colors are.
 * @internal Tests check the letter drawn on a light bead. */
export const LETTER_ON_LIGHT = '#1f1f1f'

/** Below this luma (0-255) a bead is dark enough for a white letter. */
const DARK_BEAD_LUMA = 140

/** How tall a letter is, as a share of the bead's shorter side. */
const LETTER_HEIGHT_SHARE = 0.56

/** A letter's width in em, and what a second letter adds: a two-letter label shrinks to stay inside the bead. */
const LETTER_WIDTH_EM = 0.62
const LETTER_BASE_EM = 0.38

/** Sans capitals sit a little high when centred on the middle baseline; this lowers them, in em. */
const LETTER_DROP_EM = 0.04

/** What `drawBeadLetter` needs: the bead's box as the renderer passed it to the bead drawer, and its color. */
export interface BeadLetter {
  x: number
  y: number
  size: number
  width?: number
  height?: number
  /** The bead's color as painted (a hex), which the letter is chosen against. */
  color: string
  letter: string
  dimmed: boolean
  theme: ProjectTheme
}

/** The Swatch letter's color on a bead of `color`: white on a dark one, `ink` on a light one (ticket 0573). The margin's
 * title block letters its legend the same way (ticket 0657). */
export function letterInk(color: string): string {
  const rgb = parseColor(color)
  return rgb && luma(rgb) < DARK_BEAD_LUMA ? LETTER_ON_DARK : LETTER_ON_LIGHT
}

/** The Swatch letter centred on a bead (ticket 0573): white on a dark bead, `ink` on a light one, judged on the color
 * the bead shows (a finished row's faded one included). A finished bead keeps its letter at the same fade. It reads
 * upright on screen however the Canvas, the Frame or the bead is turned (ticket 0728). */
export function drawBeadLetter(context: DrawingContext, { x, y, size, width = size, height = size, color, letter, dimmed, theme }: BeadLetter): void {
  const shown = dimmed ? finishedColor(color, theme) : color
  const side = Math.min(width, height)
  const fontSize = (side * LETTER_HEIGHT_SHARE) / Math.max(1, letter.length * LETTER_WIDTH_EM + LETTER_BASE_EM)
  context.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = letterInk(shown)
  // Undo the turn (and any mirror) the bead is drawn at, keeping its size: the letter stands upright on the screen.
  const { a, b, c, d } = context.getTransform()
  const det = a * d - b * c
  const kept = Math.sqrt(Math.abs(det)) / det
  context.save()
  context.translate(x + width / 2, y + height / 2)
  if (det !== 0) context.transform(d * kept, -b * kept, -c * kept, a * kept, 0, 0)
  context.fillText(letter, 0, fontSize * LETTER_DROP_EM)
  context.restore()
}
