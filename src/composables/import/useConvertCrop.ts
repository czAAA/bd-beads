import { computed, shallowRef, type Ref, type ShallowRef } from 'vue'
import { keptCrop, keptMoved, keptPulled, type KeptPart, type StaggerCycles, type WovenPlace } from '../../domain/convertKeep'
import { partFlipped, partTurned, type CropHandle, type PixelCrop, type SizeSide } from '../../domain/convertSize'
import type { GridDimensions } from '../../domain/grid'
import type { PixelData } from '../../domain/imageConversion'
import type { PreviewLattice } from '../../domain/imageFraming'

/** The beads as they stand: where they lie on the picture, the Frame's size and the lattice round it. */
export type CropBeads = WovenPlace & { grid: GridDimensions; lattice: PreviewLattice }

/** What the crop needs of the wizard: the picture, the beads at rest and as shown, the stagger, and the sizes it sets. */
export interface ConvertCropDeps {
  image: ShallowRef<PixelData | undefined>
  rest: () => CropBeads | undefined
  shown: () => CropBeads | undefined
  cycles: () => StaggerCycles
  width: Ref<number>
  height: Ref<number>
  lead: Ref<SizeSide>
  /** A pull on a part of the picture converts it again: the wizard's approximate preview while it moves. */
  beginMove: () => void
  endMove: () => void
}

/** The crop on the picture (ConvertImage card DS-1, ticket 0898): one crop that keeps a part of the beads as they are,
 * then, once the Width moves or the picture turns, is the part of the picture converted again. Never remembered (ADR
 * 0010): a new picture opens on the whole. */
export function useConvertCrop({ image, rest, shown, cycles, width, height, lead, beginMove, endMove }: ConvertCropDeps) {
  /** The beads kept as they are, in the Frame's rows and columns: nothing converted again. */
  const kept = shallowRef<KeptPart>()
  /** The part of the picture converted, once the Width moved after a crop or the picture turned with one. */
  const cut = shallowRef<PixelCrop>()
  /** The sizes before the crop, which Keep all puts back. */
  let before: { width: number; height: number; lead: SizeSide } | undefined
  /** The beads and the crop a drag or a key began on. */
  let start: { beads: CropBeads; rect: KeptPart } | undefined

  const frameRect = (beads: CropBeads): KeptPart => ({ row: beads.lattice.frameRow, column: beads.lattice.frameColumn, rows: beads.grid.rows, columns: beads.grid.columns })

  /** The crop in the lattice's beads, as the preview draws its handles round it, and whether anything is cropped. */
  const crop = computed(() => {
    const beads = shown()
    if (!beads) return undefined
    const part = kept.value
    const rect = part && !cut.value ? { row: beads.lattice.frameRow + part.row, column: beads.lattice.frameColumn + part.column, rows: part.rows, columns: part.columns } : frameRect(beads)
    return { rect, cropped: !!part || !!cut.value }
  })

  /** The picture pixels the crop holds, none while nothing is cropped. */
  function cropPixels(): PixelCrop | undefined {
    const beads = rest()
    const picture = image.value
    if (cut.value) return cut.value
    return kept.value && beads && picture ? keptCrop(kept.value, beads, picture) : undefined
  }

  /** The beads a part of the picture makes at the bead size on show. */
  function holdBeadSize(part: PixelCrop, per: { x: number; y: number }) {
    width.value = Math.max(1, Math.round(part.width / per.x))
    height.value = Math.max(1, Math.round(part.height / per.y))
    lead.value = 'width'
  }

  function remember() {
    before ??= { width: width.value, height: height.value, lead: lead.value }
  }

  function beginCrop() {
    const beads = rest()
    const at = crop.value
    if (!beads || !at) return
    start = { beads, rect: at.rect }
    if (cut.value) beginMove()
  }

  /** Lays a new crop in the lattice's beads the drag began on: the kept beads, or a part of the picture at that bead size. */
  function place(rect: KeptPart) {
    const from = start
    const picture = image.value
    if (!from || !picture) return
    remember()
    if (!cut.value) {
      const { grid } = from.beads
      const whole = rect.row === 0 && rect.column === 0 && rect.rows === grid.rows && rect.columns === grid.columns
      kept.value = whole ? undefined : rect
      // Dragged back onto the whole, nothing is cropped: the next crop takes the sizes it begins from.
      if (whole) before = undefined
      return
    }
    const part = keptCrop(rect, from.beads, picture)
    holdBeadSize(part, from.beads.pixelsPerBead)
    cut.value = part
  }

  /** A handle moves its edge or corner by whole beads (Handle card), from where the drag or key began. */
  function pullCrop(handle: CropHandle, columns: number, rows: number) {
    if (start) place(keptPulled(start.rect, handle, columns, rows, start.beads.lattice, cycles()))
  }

  /** A drag inside the crop moves it whole, kept on the picture. */
  function shiftCrop(columns: number, rows: number) {
    if (start) place(keptMoved(start.rect, columns, rows, start.beads.lattice, cycles()))
  }

  function endCrop() {
    if (start && cut.value) endMove()
    start = undefined
  }

  /** The Width or Height moves after a crop: the kept beads become the part of the picture they stand on, so the new
   * size converts that part again at more or less detail. */
  function beforeResize() {
    const part = kept.value
    const pixels = cropPixels()
    if (!part || !pixels) return
    cut.value = pixels
    kept.value = undefined
    width.value = part.columns
    height.value = part.rows
  }

  /** Turn 90° or Flip with a crop: the part turns or flips with the picture, at the bead size on show. `picture` is the
   * picture before it turned. Whether there was a crop to take along. */
  function moveWith(picture: PixelData, how: 'turn' | 'flip'): boolean {
    const pixels = cropPixels()
    const beads = rest()
    if (!pixels || !beads) return false
    const part = how === 'turn' ? partTurned(pixels, picture) : partFlipped(pixels, picture)
    holdBeadSize(part, beads.pixelsPerBead)
    cut.value = part
    kept.value = undefined
    return true
  }

  /** Keep all: the whole picture back, at the sizes it had before the crop. */
  function keepAll() {
    if (before) {
      width.value = before.width
      height.value = before.height
      lead.value = before.lead
    }
    before = undefined
    kept.value = undefined
    cut.value = undefined
  }

  return {
    kept,
    cut,
    crop,
    cropPixels,
    beginCrop,
    pullCrop,
    shiftCrop,
    endCrop,
    /** A focused handle's arrow: one bead, ten with Shift. */
    nudgeCrop: (handle: CropHandle, columns: number, rows: number) => {
      beginCrop()
      pullCrop(handle, columns, rows)
      endCrop()
    },
    beforeResize,
    moveWith,
    keepAll,
  }
}
