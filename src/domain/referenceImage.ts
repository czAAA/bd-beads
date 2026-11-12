import type { Project } from './project'

// The Project's one reference image (ReferenceImage card, ticket 0790, ADR 0089): a picture laid on the Canvas to bead
// over or copy from. The Project keeps only its settings here; its bytes are kept beside the library (ADR 0089). A view
// like Background: saved with the Project, never an Undo step, never held by Row progress.

/** The four opacities a reference image is drawn at; a new one's is 50. */
export const OPACITY_STEPS = [25, 50, 75, 100] as const
export type OpacityStep = (typeof OPACITY_STEPS)[number]

/** The picture as it is stored (made smaller, ADR 0089): its file name, media type, size in pixels and bytes. */
export interface ReferencePicture {
  name: string
  type: string
  width: number
  height: number
  bytes: number
}

/** Where the picture lies, in the Canvas's grid px (a bead 20 across at zoom 1): its centre, its width (its height
 * follows its shape) and its own turn in degrees clockwise, which adds to the Canvas's orientation. */
export interface ReferencePlace {
  x: number
  y: number
  width: number
  angle: number
}

export interface ReferenceImage {
  picture: ReferencePicture
  place: ReferencePlace
  opacity: OpacityStep
  shown: boolean
}

/** A box in the Canvas's grid px: what a new picture is fitted inside. */
export interface ReferenceBox {
  x: number
  y: number
  width: number
  height: number
}

/** A point in the Canvas's grid px. */
interface Point {
  x: number
  y: number
}

/** The smallest and largest width a picture can be resized to, in grid px. */
export interface WidthLimits {
  min: number
  max: number
}

/** A corner a picture is resized from. */
export type ReferenceCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
export const REFERENCE_CORNERS: readonly ReferenceCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

/** Snaps to a quarter turn within this many degrees; Shift snaps to every `FINE_TURN_STEP`. */
const QUARTER_SNAP_DEGREES = 4
export const FINE_TURN_STEP = 15

/** How tall the picture is drawn: its width in its own shape. */
export function referenceHeight({ picture, place }: Pick<ReferenceImage, 'picture' | 'place'>): number {
  return (place.width * picture.height) / picture.width
}

/** The place that fits a picture inside a box, centred and upright: a new picture's, and Fit to Canvas's. */
export function fittedPlace(picture: ReferencePicture, box: ReferenceBox): ReferencePlace {
  const scale = Math.min(box.width / picture.width, box.height / picture.height)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: picture.width * scale, angle: 0 }
}

/** A picture just added: fitted inside the Canvas's box, shown at 50%. */
export function newReferenceImage(picture: ReferencePicture, box: ReferenceBox): ReferenceImage {
  return { picture, place: fittedPlace(picture, box), opacity: 50, shown: true }
}

/** Replace image: the new picture keeps the place, the turn and the width, its height following its own shape; shown. */
export function replacedPicture(image: ReferenceImage, picture: ReferencePicture): ReferenceImage {
  return { ...image, picture, shown: true }
}

/** The angle kept within a whole turn, 0 up to 360. */
function normalized(angle: number): number {
  const turned = angle % 360
  return turned < 0 ? turned + 360 : turned === 0 ? 0 : turned
}

/** Degrees as radians, which the canvas and Math turn by. */
export const radians = (degrees: number) => (degrees * Math.PI) / 180
const clampWidth = (width: number, { min, max }: WidthLimits) => Math.min(max, Math.max(min, width))

/** A vector turned clockwise by `angle` degrees (grid px run right and down). */
function turned({ x, y }: Point, angle: number): Point {
  const [cos, sin] = [Math.cos(radians(angle)), Math.sin(radians(angle))]
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

/** The picture moved by a distance in grid px. */
export function movedBy(place: ReferencePlace, dx: number, dy: number): ReferencePlace {
  return { ...place, x: place.x + dx, y: place.y + dy }
}

/** The picture resized by a factor about its centre, within the limits (`+` and `−` in Adjust). */
export function scaledBy(place: ReferencePlace, factor: number, limits: WidthLimits): ReferencePlace {
  return { ...place, width: clampWidth(place.width * factor, limits) }
}

/** The picture turned by some degrees (`[` and `]` in Adjust). */
export function turnedBy(place: ReferencePlace, degrees: number): ReferencePlace {
  return { ...place, angle: normalized(place.angle + degrees) }
}

/** Where a grid point lies on the picture, as fractions of its width and height from its own top-left (0 up to 1), or
 * undefined off it: what Convert to beads samples and what decides the positions the picture covers (ticket 0883). */
export function pointOnPicture(place: ReferencePlace, height: number, point: Point): { u: number; v: number } | undefined {
  const local = turned({ x: point.x - place.x, y: point.y - place.y }, -place.angle)
  const u = local.x / place.width + 0.5
  const v = local.y / height + 0.5
  return u >= 0 && u < 1 && v >= 0 && v < 1 ? { u, v } : undefined
}

/** The width and height of the box round a rectangle turned by `angle` degrees. */
export function turnedExtent(width: number, height: number, angle: number): { width: number; height: number } {
  const [cos, sin] = [Math.abs(Math.cos(radians(angle))), Math.abs(Math.sin(radians(angle)))]
  return { width: width * cos + height * sin, height: width * sin + height * cos }
}

const CORNER_SIGNS: Record<ReferenceCorner, Point> = {
  'top-left': { x: -1, y: -1 },
  'top-right': { x: 1, y: -1 },
  'bottom-right': { x: 1, y: 1 },
  'bottom-left': { x: -1, y: 1 },
}

/** The picture resized by dragging a corner to `point`: it keeps its shape (`aspect`, height over width), the opposite
 * corner stays put, and the pointer is read along the turned picture's diagonal. */
export function resizedFromCorner(place: ReferencePlace, aspect: number, corner: ReferenceCorner, point: Point, limits: WidthLimits): ReferencePlace {
  const sign = CORNER_SIGNS[corner]
  const [width, height] = [place.width, place.width * aspect]
  const fixed = { x: place.x, y: place.y }
  const offset = turned({ x: (-sign.x * width) / 2, y: (-sign.y * height) / 2 }, place.angle)
  fixed.x += offset.x
  fixed.y += offset.y
  const local = turned({ x: point.x - fixed.x, y: point.y - fixed.y }, -place.angle)
  const diagonal = { x: sign.x * width, y: sign.y * height }
  const scale = (local.x * diagonal.x + local.y * diagonal.y) / (diagonal.x ** 2 + diagonal.y ** 2)
  const resized = clampWidth(width * scale, limits)
  const half = turned({ x: (sign.x * resized) / 2, y: (sign.y * resized * aspect) / 2 }, place.angle)
  return { ...place, x: fixed.x + half.x, y: fixed.y + half.y, width: resized }
}

/** An angle snapped as the Turn handle snaps it: to a quarter turn within 4°, else to the whole degree; `fine` (Shift)
 * to every 15°. @internal Its test checks the snapping on its own. */
export function snappedAngle(angle: number, fine: boolean): number {
  if (fine) return normalized(Math.round(angle / FINE_TURN_STEP) * FINE_TURN_STEP)
  const quarter = Math.round(angle / 90) * 90
  return normalized(Math.abs(angle - quarter) <= QUARTER_SNAP_DEGREES ? quarter : Math.round(angle))
}

/** The picture turned so its Turn handle points at `point`: the handle stands below the picture's bottom edge (ticket
 * 0883), or above its top edge where there was no room below. */
export function turnedToward(place: ReferencePlace, point: Point, { below, fine }: { below: boolean; fine: boolean }): ReferencePlace {
  const pointing = (Math.atan2(point.y - place.y, point.x - place.x) * 180) / Math.PI
  return { ...place, angle: snappedAngle(pointing + (below ? -90 : 90), fine) }
}

/** The Project with its reference image set, or taken off with `undefined`. Stamping the change is the caller's. */
export function withReferenceImage(project: Project, image: ReferenceImage | undefined): Project {
  const { referenceImage: _old, ...rest } = project
  return image ? { ...rest, referenceImage: image } : rest
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isPositive = (value: unknown): value is number => isNumber(value) && value > 0

function readPicture(stored: unknown): ReferencePicture | undefined {
  const picture = stored as Partial<ReferencePicture> | null
  if (typeof picture !== 'object' || picture === null) return undefined
  const { name, type, width, height, bytes } = picture
  if (typeof name !== 'string' || typeof type !== 'string' || !type.startsWith('image/') || !isPositive(width) || !isPositive(height)) return undefined
  return { name, type, width, height, bytes: isNumber(bytes) && bytes >= 0 ? bytes : 0 }
}

function readPlace(stored: unknown): ReferencePlace | undefined {
  const place = stored as Partial<ReferencePlace> | null
  if (typeof place !== 'object' || place === null) return undefined
  const { x, y, width, angle } = place
  if (!isNumber(x) || !isNumber(y) || !isPositive(width)) return undefined
  return { x, y, width, angle: isNumber(angle) ? normalized(angle) : 0 }
}

/** A stored reference image as this build reads it (ADR 0089): none where its picture or place can't be read; an
 * opacity off the four steps reads as 50%, a missing shown as shown. */
export function readReferenceImage(stored: unknown): ReferenceImage | undefined {
  const image = stored as Partial<Record<keyof ReferenceImage, unknown>> | null
  if (typeof image !== 'object' || image === null) return undefined
  const picture = readPicture(image.picture)
  const place = readPlace(image.place)
  if (!picture || !place) return undefined
  const opacity = (OPACITY_STEPS as readonly unknown[]).includes(image.opacity) ? (image.opacity as OpacityStep) : 50
  return { picture, place, opacity, shown: image.shown !== false }
}
