import { watch, type Ref } from 'vue'
import type { Bead } from '../../domain/beads'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { beadColorTargets, nearestTarget, sourceTargets, type TargetColor } from '../../domain/convertColors'
import type { PixelData } from '../../domain/imageConversion'
import { beadColorAt } from '../../domain/layerBeads'
import { beadIdOfLayer } from '../../domain/layerRecord'
import type { Layer } from '../../domain/layers'
import { brandColors, defaultPalette } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { pictureColorAt } from '../../domain/referenceConvert'
import type { ReferencePlace } from '../../domain/referenceImage'
import { pressOnPicture } from '../../rendering/referenceCover'

/** The Reference image as Pick color reads it: its stored bytes, where it lies and how tall it is drawn. */
interface PickedPicture {
  blob: Blob
  place: ReferencePlace
  height: number
}

/** What Pick color from Canvas needs from the shell. */
export interface PickColorDeps {
  /** Whether Pick color from Canvas is armed: the next press on a bead takes its colour. */
  picking: Ref<boolean>
  currentProject: () => Project | null | undefined
  /** Chooses a colour as the paint colour; it joins the Palette, with its code when it has one, and the recent colours
   * (tickets 398, 1119). */
  onSelectCustomColor: (hex: string, code?: string) => void
  /** The Reference image while it is shown, else none (ticket 1119). Without it only beads are picked from. */
  picture?: () => PickedPicture | undefined
  decodePixels?: (blob: Blob) => Promise<PixelData>
  /** The Bead colors list's catalog of the Palette's Bead (ADR 0079), fetched on `load`. */
  beadColors?: { load: () => Promise<void>; catalog: Readonly<Ref<ColorCatalog | undefined>>; bead: Readonly<Ref<Bead | undefined>> }
}

/** Pick color from Canvas (ticket 398): the press that takes a bead's colour while the pick is armed. The Palette's
 * button and the Radial toolbox arm it (ticket 1089). Where there is no bead, the shown Reference image's colour there,
 * matched to the nearest code of the Palette's Bead (ticket 1119). */
export function usePickColor(deps: PickColorDeps) {
  let reading: { blob: Blob; pixels: Promise<PixelData | undefined> } | undefined

  /** Chooses the colour of the bead you see at a Canvas position, on the Canvas or in the Frame. An empty position
   * changes nothing. Returns whether a colour was taken. */
  function takeColorAt(row: number, column: number, layer?: Layer): boolean {
    const project = deps.currentProject()
    const hex = project ? beadColorAt(project, row, column, layer) : null
    if (!hex) return false
    deps.onSelectCustomColor(hex)
    return true
  }

  /** The press while armed: takes the bead's colour and ends the pick; on an empty position, the picture's under it once
   * it is read. Nothing there keeps it armed. Returns whether the press was consumed, which is whenever the pick is armed. */
  function pickColorAt(row: number, column: number, layer?: Layer): boolean {
    if (!deps.picking.value) return false
    if (takeColorAt(row, column, layer)) deps.picking.value = false
    else void takePictureColorAt(row, column, layer)
    return true
  }

  /** The picture's colour at the centre of the bead pressed, read from its bytes so its opacity never changes it, as the
   * nearest bead colour; never the picture's own colour (ticket 1119). */
  async function takePictureColorAt(row: number, column: number, layer?: Layer): Promise<void> {
    const project = deps.currentProject()
    const shown = deps.picture?.()
    const at = project && shown ? pressOnPicture(project, { row, column }, layer, shown.place, shown.height) : undefined
    if (!project || !shown || !at) return
    const [pixels, targets] = await Promise.all([pixelsOf(shown.blob), targetsFor(project)])
    const hex = pixels && pictureColorAt(pixels, at)
    if (!hex || !deps.picking.value || deps.currentProject()?.id !== project.id) return
    const match = nearestTarget(hex, targets)
    deps.onSelectCustomColor(match.hex, match.code)
    deps.picking.value = false
  }

  /** The picture's pixels, decoded once per picture; one that fails to decode is tried again on the next press. */
  function pixelsOf(blob: Blob): Promise<PixelData | undefined> {
    if (!deps.decodePixels) return Promise.resolve(undefined)
    if (reading?.blob === blob) return reading.pixels
    const read = {
      blob,
      pixels: deps.decodePixels(blob).catch(() => {
        if (reading === read) reading = undefined
        return undefined
      }),
    }
    reading = read
    return read.pixels
  }

  /** The codes of the Palette's Bead in its size, discontinued ones left out, as Convert matches to; its default colors
   * where it has no catalog or it can't be fetched. */
  async function targetsFor(project: Project): Promise<readonly TargetColor[]> {
    await deps.beadColors?.load()
    const catalog = deps.beadColors?.catalog.value
    const bead = deps.beadColors?.bead.value
    const codes = catalog && bead ? beadColorTargets(catalog, bead.size, brandColors(bead.brand.id)) : []
    return codes.length > 0 ? codes : sourceTargets('default', defaultPalette(beadIdOfLayer(project, 'frame')), [])!
  }

  // The picture and the catalog are fetched once the pick is armed over a shown picture, so the press has them at hand.
  watch(deps.picking, (armed) => {
    const shown = armed ? deps.picture?.() : undefined
    if (!shown) return
    void pixelsOf(shown.blob)
    void deps.beadColors?.load()
  })

  return { pickColorAt }
}
