import { computed, type Ref } from 'vue'
import type { Rect } from '../../domain/canvas'
import { framedAround } from '../../domain/changeFrame'
import { fillBlanks } from '../../domain/fillBlanks'
import { canvasWeave } from '../../domain/layerWeave'
import type { Project } from '../../domain/project'
import { referenceHeight, type ReferencePlace } from '../../domain/referenceImage'
import type { Translations } from '../../i18n/translations'
import { marginSheetPx } from '../../rendering/projectRenderer'
import { placeOnScreen } from '../../rendering/referenceImage'
import { gridBox, type Region, type SurfaceView } from '../../rendering/surfaceView'
import { useMediaQuery } from '../ui/useMediaQuery'
import { pictureBarPlace, pictureBounds, type ScreenBox } from './pictureBarPlacement'

/** What the layout reads: the open Project, the surface's view, the picture's place now, the box it covers, the margin
 * sheet on screen, and whether Set Frame around the picture is hovered and Convert to beads open. */
export interface PictureBarLayoutDeps {
  project: () => Project | undefined
  view: () => SurfaceView | undefined
  place: () => ReferencePlace | undefined
  covered: () => Rect | undefined
  /** The Frame Set Frame around the picture would set. */
  framed: () => Rect | undefined
  sheet: () => ScreenBox | undefined
  framePreviewOn: Ref<boolean>
  converting: () => boolean
  messages: () => Translations
}

/** The bar's height in screen px: the Tool pill's 40, 52 on a coarse pointer (ReferenceImage card). */
const BAR_HEIGHT_PX = 40
const COARSE_BAR_HEIGHT_PX = 52

// The reference image's picture bar laid out on the canvas box (ReferenceImage card, ticket 0883): the picture's box on
// screen, the bar's top the popover is level with, and the two previews' boxes, all in screen px through the view.
export function usePictureBarLayout(deps: PictureBarLayoutDeps) {
  const coarse = useMediaQuery('(pointer: coarse)')
  const barHeight = computed(() => (coarse.value ? COARSE_BAR_HEIGHT_PX : BAR_HEIGHT_PX))

  /** A region of grid space as the box round it on screen. */
  function onScreen(view: SurfaceView, { x, y, width, height }: Region): ScreenBox {
    const corners = [view.gridToPoint(x, y), view.gridToPoint(x + width, y), view.gridToPoint(x, y + height), view.gridToPoint(x + width, y + height)]
    const xs = corners.map((corner) => corner.x)
    const ys = corners.map((corner) => corner.y)
    return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  }

  const picture = computed<ScreenBox | undefined>(() => {
    const view = deps.view()
    const place = deps.place()
    const image = deps.project()?.referenceImage
    if (!view || !place || !image) return undefined
    return pictureBounds(placeOnScreen(view, place, referenceHeight({ picture: image.picture, place })))
  })

  const barTop = computed(() => {
    const view = deps.view()
    return picture.value && view ? pictureBarPlace(picture.value, { width: 0, height: barHeight.value }, view.viewport, deps.sheet()).top : 0
  })

  /** Set Frame around the picture's preview: the Frame it would make, its line and margin sheet, and its tag. */
  const framePreview = computed(() => {
    const project = deps.project()
    const view = deps.view()
    const box = deps.framed()
    if (!deps.framePreviewOn.value || !project || !view || !box) return undefined
    const made = framedAround(project, box)
    const sheet = made.kind === 'changed' ? marginSheetPx(made.project) : undefined
    if (!sheet) return undefined
    const tag = fillBlanks(deps.messages().referenceImage.frameAround.tag, { size: `${box.columns}×${box.rows}` })
    return { line: onScreen(view, sheet.footprint), sheet: onScreen(view, sheet.sheet), tag }
  })

  /** Convert to beads' preview line round the beads it will make. */
  const convertPreview = computed(() => {
    const project = deps.project()
    const view = deps.view()
    const box = deps.covered()
    if (!deps.converting() || !project || !view || !box) return undefined
    return { box: onScreen(view, gridBox(canvasWeave(project), box)), label: deps.messages().referenceImage.convert.preview }
  })

  return { barHeight, picture, barTop, framePreview, convertPreview }
}
