import { computed, inject, onScopeDispose, provide, readonly, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import { catalogSwatches } from '../../domain/beadSwatch'
import { BACKGROUND_TOLERANCE, backgroundShare, findBackground, withoutBackground, type BackgroundMark } from '../../domain/convertBackground'
import { keptGrid } from '../../domain/convertKeep'
import { colorCatalogOf, DEFAULT_BEAD, findBead } from '../../domain/beads'
import { clamp } from '../../domain/clamp'
import type { ColorCatalog, Finish } from '../../domain/colorCatalog'
import {
  beadColorRows,
  beadColorTargets,
  convertFrame,
  matchFoundColors,
  newProjectPalette,
  sourceTargets,
  type ColorSource,
  type FoundColorChoice,
} from '../../domain/convertColors'
import {
  flipPicture,
  fullCrop,
  isLargeSchema,
  sizingFor,
  startingSize,
  turnPicture,
  type PixelCrop,
  type SizeSide,
} from '../../domain/convertSize'
import { createProjectFromImage, type CreateProjectInput } from '../../domain/createProject'
import { approximatePreviewColors, exactPreviewColors, heldColorLookup, nearestColorLookup } from '../../domain/framingPreview'
import { reducePictureColors } from '../../domain/imageColors'
import {
  DEFAULT_MAX_IMAGE_COLORS,
  ImageConversionError,
  MAX_IMAGE_COLORS,
  MIN_IMAGE_COLORS,
  NO_COLOR,
  frameColors,
  packedToHex,
  sampleLatticePacked,
  type SamplingRule,
  validateImageFile,
  type DecodeImage,
  type ImageRejection,
  type PixelData,
} from '../../domain/imageConversion'
import { partLattice } from '../../domain/imageFraming'
import { framedGrid } from '../../domain/layerBeads'
import { brandColors, createPalette, defaultPalette } from '../../domain/palette'
import type { MyBeads } from '../../domain/myBeads'
import { pictureKind } from '../../domain/pictureKind'
import type { Grid } from '../../domain/project'
import { estimatedSizeMm } from '../../domain/projectSize'
import { columnCycle, rowCycle, weaveSettings, type Technique, type TechniqueSettings } from '../../domain/weave'
import { useConvertCleanUp } from './useConvertCleanUp'
import { useConvertCrop, type CropBeads } from './useConvertCrop'
import { useConvertFinishes } from './useConvertFinishes'
import { useConvertLighting } from './useConvertLighting'
import { useConvertMyBeads } from './useConvertMyBeads'

/** What the wizard needs from outside it: the New Project form's values it starts from (its own copy, spec 0645), how
 * a picture is decoded and how a Bead's Color catalog is fetched (both services, handed in by the app shell). */
export interface ConvertImageWizardDeps {
  start: CreateProjectInput
  /** The source of the colors to open on, the device's last (ticket 0893); none is Bead colors where the Bead has them. */
  startSource?: ColorSource
  /** The Finishes to keep the match to, the device's last (ticket 0901); none is every Finish. */
  startFinishes?: readonly Finish[]
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog>
  /** Opened from the reference image's All settings (ticket 0883): the beads go on the open Project, Add to Canvas. */
  addsToCanvas?: boolean
  /** My beads, the device's list (ticket 0902); a list of the wizard's own where none is handed in. */
  myBeads?: Ref<MyBeads>
}

/** The preview's tools (ConvertImage card DS-1, the floating bar): one or none is on. Make empty leaves a color out with
 * a tap; Background keeps or removes the patch under a tap or a drag (ticket 0787). The crop on the picture took Select's
 * place (ticket 0898). */
export type ConvertTool = 'make-empty' | 'background'

/** The popovers of the quiet converter (ticket 0896, ConvertImage card DS-1): the column's three, each from its own
 * button, and Background's from the floating bar. One is open at a time; Background's is open while its tool is on. */
export type ConvertPopover = 'bead' | 'size' | 'colors' | 'background' | 'clean-up' | 'lighting'

/** Background (ConvertImage card, 2 Background; ticket 0780): off, found and hatched (1 Find), or made empty places
 * (2 Remove). */
export type BackgroundStage = 'off' | 'find' | 'removed'

/** One step of the Background tool (ticket 0787) as the wizard keeps it: in picture pixels, so a new Width, Height or
 * crop replays it on the beads that then stand there. */
interface PixelMark {
  kind: BackgroundMark['kind']
  points: readonly { x: number; y: number }[]
}

/** The unit the Width slider reads in (ConvertImage card, slide in): it moves in whole beads either way. Not the
 * device's Size unit: the wizard remembers nothing (spec 0645). */
export type ConvertSizeUnit = 'beads' | 'mm'

/** How long a moved handle has to stay still before the colors are worked out exactly (ticket 122). */
const PAUSE_MS = 150

/** The Convert image wizard's state (spec 0645, ADR 0010; ticket 0747): its own copy of the setup, the picture, the part,
 * the Width, the colors, and the preview and Project they make. It keeps nothing (the flow keeps the last choices,
 * ticket 0893): leaving drops it all, Create reads `createProject`. Run it in an effect scope, which stops its timers. */
export function useConvertImageWizard({ start, startSource, startFinishes, decodeImage, loadCatalog, addsToCanvas = false, myBeads: myBeadsList }: ConvertImageWizardDeps) {
  // The setup, a copy of the form's: Cancel leaves the form as it was.
  const name = ref(start.name ?? '')
  const makerName = ref(start.makerName ?? '')
  const beadId = ref(start.beadId)
  const technique = ref<Technique>(start.technique)
  const settings = ref<TechniqueSettings>({ ...start.techniqueSettings })
  const techniqueSettings = computed(() => weaveSettings({ technique: technique.value, techniqueSettings: settings.value }))
  const bead = computed(() => findBead(beadId.value) ?? DEFAULT_BEAD)
  const weave = computed(() => ({ technique: technique.value, techniqueSettings: techniqueSettings.value }))

  // The picture. shallowRef: megabytes of pixels never changed in place; Turn and Flip make a new one.
  const image = shallowRef<PixelData>()
  const fileName = ref('')
  const rejection = ref<ImageRejection>()
  const reading = ref(false)
  /** The file being read, for the slow picture's line ("img_2041.jpg · 9.6 MB", ticket 0896). */
  const readingFile = shallowRef<{ name: string; bytes: number }>()
  /** Photo or flat art (ticket 0889), told again for each new picture: it sets defaults only (Width, Clean up's in 0906). */
  const kind = computed(() => (image.value ? pictureKind(image.value) : undefined))

  // How big (ConvertImage card): the Width in beads, and the unit it reads in; the part is the crop's (ticket 0898).
  const widthBeads = ref(0)
  const heightBeads = ref(0)
  // Keep the picture's shape (ticket 0780, was the chain of 0757): on, the side moved last leads and the other follows the
  // picture's shape; off, each is its own.
  const linked = ref(true)
  const lead = ref<SizeSide>('width')
  const sizeUnit = ref<ConvertSizeUnit>('beads')

  // Colors.
  const catalogId = computed(() => colorCatalogOf(bead.value.id))
  const catalog = shallowRef<ColorCatalog>()
  const catalogState = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const chosenSource = ref<ColorSource | undefined>(startSource)
  const chosenColors = ref(DEFAULT_MAX_IMAGE_COLORS)
  const choices = shallowRef<ReadonlyMap<string, FoundColorChoice>>(new Map())

  // The preview's tools (ConvertImage card, the floating bar); Compare is the preview's own (ticket 0909).
  const tool = ref<ConvertTool>()
  // Background (ticket 0780).
  const background = ref<BackgroundStage>('off')
  const tolerance = ref<number>(BACKGROUND_TOLERANCE.start)
  // The Background tool's steps (ticket 0787), oldest first.
  const marks = shallowRef<readonly PixelMark[]>([])
  // Every background decision (the switch, Tolerance, Remove, Show what was found, a step, Start over) is one step of the
  // history the Tool pill's Undo and Redo walk: what stood before each one, and what was undone, the last undone first.
  interface BackgroundDecision {
    background: BackgroundStage
    tolerance: number
    marks: readonly PixelMark[]
  }
  const past = shallowRef<readonly BackgroundDecision[]>([])
  const undone = shallowRef<readonly BackgroundDecision[]>([])
  /** Whether the last step was a Tolerance change: the next one joins it, so a slider drag is one step. */
  let lastWasTolerance = false
  const decided = (): BackgroundDecision => ({ background: background.value, tolerance: tolerance.value, marks: marks.value })
  /** Records what stands now as the step a decision is about to change; a new decision drops what was undone. */
  function decide(isTolerance = false) {
    if (!(isTolerance && lastWasTolerance)) past.value = [...past.value, decided()]
    lastWasTolerance = isTolerance
    undone.value = []
  }
  function restore(state: BackgroundDecision) {
    background.value = state.background
    tolerance.value = state.tolerance
    marks.value = state.marks
    stroke = undefined
    lastWasTolerance = false
  }

  // The crop on the picture (ticket 0898): a part of the beads kept as they are, or a part of the picture converted.
  const beadsOf = (at: Sample | undefined): CropBeads | undefined =>
    at && { part: at.part, pixelsPerBead: at.pixelsPerBead, frameRow: at.lattice.frameRow, frameColumn: at.lattice.frameColumn, grid: at.grid, lattice: at.lattice }
  const crop = useConvertCrop({
    image,
    rest: () => beadsOf(rest.value),
    shown: () => beadsOf(live.value),
    cycles: () => ({ rowCycle: rowCycle(weave.value), columnCycle: columnCycle(weave.value) }),
    width: widthBeads,
    height: heightBeads,
    lead,
    beginMove: () => (moving.value = true),
    endMove: () => {
      moving.value = false
      settle()
    },
  })
  const kept = crop.kept

  /** The part of the picture to weave: the whole picture, or the part the crop holds once converted again. */
  const part = computed<PixelCrop>(() => {
    const picture = image.value
    if (!picture) return { x: 0, y: 0, width: 1, height: 1 }
    return crop.cut.value ?? fullCrop(picture)
  })

  // What is converted at rest: the live part, held while a handle moves it (until it ends or pauses), so the exact
  // conversion is not redone on every move.
  const moving = ref(false)
  const restPart = shallowRef(part.value)
  let pauseTimer: ReturnType<typeof setTimeout> | undefined
  function settle() {
    clearTimeout(pauseTimer)
    pauseTimer = undefined
    restPart.value = part.value
  }
  watch(
    part,
    () => {
      if (!moving.value) return settle()
      clearTimeout(pauseTimer)
      pauseTimer = setTimeout(settle, PAUSE_MS)
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => clearTimeout(pauseTimer))

  // --- Size ---------------------------------------------------------------------------------------------------------

  /** The one sizing rule over a part (convertSize's sizingFor), with the Width and Height asked for. The part only
   * chooses what is woven: both stay as they were, held to the part's pixels. */
  const sizingInputOf = (at: PixelCrop) => ({
    part: at,
    width: widthBeads.value,
    height: heightBeads.value,
    linked: linked.value,
    lead: lead.value,
    bead: bead.value,
    technique: technique.value,
    techniqueSettings: techniqueSettings.value,
  })
  const sizingOf = (at: PixelCrop) => sizingFor(sizingInputOf(at))
  const woven = computed(() => sizingOf(part.value))
  const dimensions = computed(() => woven.value.grid)
  /** What Width and Height read (ticket 0898): with a part of the beads kept, its size over the pixels it stands on,
   * with that part's range and marks; else the beads woven. */
  const sizing = computed(() => {
    const at = kept.value
    const pixels = at && crop.cropPixels()
    if (!at || !pixels) return woven.value
    return sizingFor({ ...sizingInputOf(pixels), width: at.columns, height: at.rows, linked: false })
  })
  // A kept part that no longer fits the beads (another Bead or Technique) goes.
  watch(dimensions, (size) => {
    const at = kept.value
    if (at && (at.row + at.rows > size.rows || at.column + at.columns > size.columns)) kept.value = undefined
  })

  /** A Width in beads as the piece's width in mm through the Bead, for the slider's labels. */
  function widthMmOf(beads: number): number {
    return Math.round(estimatedSizeMm({ columns: beads, rows: 1 }, bead.value, technique.value).widthMm)
  }

  /** A Height in beads as the piece's height in mm through the Bead, for the slider's labels. */
  function heightMmOf(beads: number): number {
    return Math.round(estimatedSizeMm({ columns: 1, rows: beads }, bead.value, technique.value).heightMm)
  }

  /** A new Width converts again: after a crop, the part it holds, at more or less detail (ticket 0898). */
  function setWidth(beads: number) {
    crop.beforeResize()
    widthBeads.value = beads
    lead.value = 'width'
  }

  function setHeight(beads: number) {
    crop.beforeResize()
    heightBeads.value = beads
    lead.value = 'height'
  }

  /** Keep the picture's shape: turning it off keeps the sizes on show, and linking again takes the shape back from the side moved last. */
  function setLinked(next: boolean) {
    if (!next && linked.value) {
      widthBeads.value = woven.value.width
      heightBeads.value = woven.value.height
    }
    linked.value = next
  }

  // --- Picture ------------------------------------------------------------------------------------------------------

  /** The Background tool's steps go (a new picture, a turn or a flip): their pixels no longer stand where they were. */
  function forgetMarks() {
    marks.value = []
    past.value = []
    undone.value = []
    settle()
  }

  /** A new picture opens on the whole, the crop never kept (ADR 0010, ticket 0898), and the steps go. */
  function restartPart() {
    crop.keepAll()
    forgetMarks()
  }

  /** A picture from any way in, through the one validation and decode (spec 0645): the first one sets the starting
   * proposal; a later one replaces it and keeps every other setting. A refused one leaves the picture already set. */
  async function setFile(file: File): Promise<void> {
    rejection.value = validateImageFile(file)
    if (rejection.value) return
    reading.value = true
    readingFile.value = { name: file.name, bytes: file.size }
    try {
      const decoded = await decodeImage(file)
      const first = !image.value
      image.value = decoded
      fileName.value = file.name
      if (first) {
        const opening = startingSize(decoded, kind.value)
        widthBeads.value = opening.width
        heightBeads.value = opening.height
      }
      cleanUp.reset()
      lighting.reset()
      restartPart()
    } catch (error) {
      rejection.value = error instanceof ImageConversionError ? error.reason : 'decodeFailed'
    } finally {
      reading.value = false
      readingFile.value = undefined
    }
  }

  /** Turn 90°: the picture's sides swap, before sampling; a crop turns with it, on the same piece (ticket 0898). */
  function turn() {
    const picture = image.value
    if (!picture) return
    crop.moveWith(picture, 'turn')
    image.value = turnPicture(picture)
    forgetMarks()
  }

  /** Flip left to right, a crop with it. */
  function flip() {
    const picture = image.value
    if (!picture) return
    crop.moveWith(picture, 'flip')
    image.value = flipPicture(picture)
    forgetMarks()
  }

  // --- The preview's beads ------------------------------------------------------------------------------------------

  /** The beads over a part: each the color most of its area has at rest, its centre pixel while a handle moves, as the
   * full rule is too slow for every move (ticket 0888). */
  function sample(at: PixelCrop, rule: SamplingRule = 'area') {
    const picture = lighting.picture.value
    if (!picture) return undefined
    const { grid, pixelsPerBead } = sizingOf(at)
    const lattice = partLattice({ image: picture, part: at, pixelsPerBead, dimensions: grid, ...weave.value })
    return { grid, lattice, part: at, pixelsPerBead, sampled: sampleLatticePacked({ image: picture, ...weave.value, part: at, pixelsPerBead, lattice, rule }) }
  }
  type Sample = NonNullable<ReturnType<typeof sample>>

  /** The Frame's bead a picture pixel falls on (by its cell, the stagger left aside: a mark seeds a patch, so a bead off
   * hardly tells), as an index into the Frame's block; none off the Frame. */
  function frameBeadAtPixel({ part: at, pixelsPerBead, grid: size }: Sample, point: { x: number; y: number }): number | undefined {
    const column = Math.floor((point.x - at.x) / pixelsPerBead.x)
    const row = Math.floor((point.y - at.y) / pixelsPerBead.y)
    return column >= 0 && column < size.columns && row >= 0 && row < size.rows ? row * size.columns + column : undefined
  }

  /** The picture pixel at the middle of a Frame bead's cell: how a mark remembers the bead. */
  function pixelAtFrameBead({ part: at, pixelsPerBead, grid: size }: Sample, index: number) {
    return { x: at.x + ((index % size.columns) + 0.5) * pixelsPerBead.x, y: at.y + (Math.floor(index / size.columns) + 0.5) * pixelsPerBead.y }
  }

  /** The marks on a sample's Frame, each point on the bead that now stands at its pixel. */
  function marksOn(at: Sample): BackgroundMark[] {
    return marks.value.map((mark) => ({
      kind: mark.kind,
      beads: mark.points.map((point) => frameBeadAtPixel(at, point)).filter((index): index is number => index !== undefined),
    }))
  }

  /** The Frame's own beads of a sample, row by row: what the background is found in. */
  function frameBlock(at: NonNullable<ReturnType<typeof sample>>): Int32Array {
    const { lattice, grid: size, sampled } = at
    const block = new Int32Array(size.columns * size.rows)
    for (let row = 0; row < size.rows; row += 1) {
      const from = (row + lattice.frameRow) * lattice.columns + lattice.frameColumn
      block.set(sampled.subarray(from, from + size.columns), row * size.columns)
    }
    return block
  }

  /** The background found in a sample's Frame (1 Find) with the Background tool's marks over it, none while Remove
   * background is off. */
  function foundIn(at: ReturnType<typeof sample>) {
    if (!at || background.value === 'off') return undefined
    const colors = frameBlock(at)
    const found = findBackground({ colors, columns: at.grid.columns, rows: at.grid.rows, tolerance: tolerance.value }, marksOn(at))
    return { found, ...backgroundShare(colors, found) }
  }

  /** A sample with the background's beads made empty places once it is removed (2 Remove), so the colors are counted
   * from what is left. */
  function removedFrom(at: ReturnType<typeof sample>, found: Uint8Array | undefined) {
    if (!at || !found || background.value !== 'removed') return at
    const { lattice, grid: size } = at
    const sampled = at.sampled.slice()
    for (let row = 0; row < size.rows; row += 1) {
      const from = (row + lattice.frameRow) * lattice.columns + lattice.frameColumn
      sampled.set(withoutBackground(sampled.subarray(from, from + size.columns), found.subarray(row * size.columns, (row + 1) * size.columns)), from)
    }
    return { ...at, sampled }
  }

  const rawRest = computed(() => sample(restPart.value))
  const restBackground = computed(() => foundIn(rawRest.value))
  const rest = computed(() => removedFrom(rawRest.value, restBackground.value?.found))

  const hasCatalog = computed(() => !!catalogId.value)
  const builtIns = computed(() => defaultPalette(bead.value.id))
  const beadTargets = computed(() =>
    catalog.value && catalog.value.id === catalogId.value ? beadColorTargets(catalog.value, bead.value.size, brandColors(bead.value.brand.id)) : [],
  )
  const myBeads = useConvertMyBeads({ list: myBeadsList ?? ref<MyBeads>({}), catalogId, beadTargets })
  /** What the found colors are matched to: the Bead's colors until a source is chosen, the Default Palette for a Bead
   * with no Color catalog (ticket 0863). My beads with no code of the Bead's size is the Bead's colors (ticket 0902). */
  const source = computed<ColorSource>(() => {
    const wanted = chosenSource.value ?? 'bead-colors'
    const loaded = beadTargets.value.length > 0
    const mine = wanted === 'my-beads' && (!myBeads.offered.value || (loaded && myBeads.targets.value.length === 0)) ? 'bead-colors' : wanted
    return mine === 'bead-colors' && !hasCatalog.value ? 'default' : mine
  })
  /** The Bead colors the source names: all the Bead's, or My beads' of them. */
  const sourceBeadTargets = computed(() => (source.value === 'my-beads' ? myBeads.targets.value : beadTargets.value))
  const finishes = useConvertFinishes({ start: startFinishes, source, sourceTargets: sourceBeadTargets })
  // Until its catalog has loaded, Bead colors (and My beads) match to the Default Palette, so the preview never shows
  // bare pixels.
  const targets = computed(() =>
    source.value !== 'default' && source.value !== 'exact' && sourceBeadTargets.value.length === 0
      ? sourceTargets('default', builtIns.value, [])
      : sourceTargets(source.value, builtIns.value, finishes.targets.value),
  )

  const frameSampled = computed(() => rest.value && frameColors(rest.value.sampled, rest.value.lattice, rest.value.grid))
  /** Every color the part has (the Colors slider's max, ConvertImage card): the distinct colors its beads sample, at
   * most MAX_IMAGE_COLORS, since a pattern of more would not be one. */
  const colorsFound = computed(() => Math.max(MIN_IMAGE_COLORS, frameSampled.value?.counts.size ?? MIN_IMAGE_COLORS))
  const colorsMax = computed(() => Math.min(MAX_IMAGE_COLORS, colorsFound.value))
  /** Whether the part has more colors than the slider offers, so the hint says so. */
  const colorsCapped = computed(() => colorsFound.value > MAX_IMAGE_COLORS)
  /** The Colors slider: 12 at first, or every color where that is fewer; a part with fewer colors pulls it down. */
  const maxColors = computed(() => clamp(chosenColors.value, MIN_IMAGE_COLORS, colorsMax.value))
  /** Fewer codes left in the Finishes on than colors asked: as many colors come out as there are codes (ticket 0901). */
  const shortOf = (count: number) => finishes.on.value && finishes.codesLeft.value > 0 && finishes.codesLeft.value < count
  const finishesShort = computed(() => shortOf(maxColors.value))
  /** The picture reduced for a number of colors asked, to the codes left where the Finishes leave fewer. */
  const reducedFor = (count: number) => reducePictureColors(frameSampled.value?.counts ?? new Map(), shortOf(count) ? finishes.codesLeft.value : count)
  const sampledReduced = computed(() => reducedFor(maxColors.value))
  // Clean up (ticket 0906): stray beads and small colors, between the reduction and the beads; the found colors follow.
  const cleanUp = useConvertCleanUp({
    kind,
    raw: computed(() => frameSampled.value?.raw),
    reduced: sampledReduced,
    weave,
    match: (at, leastBeads) => matchFoundColors(at, targets.value, choices.value, leastBeads),
  })
  const reduced = cleanUp.reduced
  const found = cleanUp.found
  // Auto-fix lighting (ticket 0907): the picture corrected before the sampler reads it, so Clean up and the found colors
  // follow the lit beads. Off until the person turns it on.
  const lighting = useConvertLighting(image)
  /** Color by color's rows: the found colors joined by the bead color they become (ticket 0863). */
  const rows = computed(() => beadColorRows(found.value))
  const grid = computed<Grid>(() => (frameSampled.value ? convertFrame(cleanUp.raw.value, reduced.value, found.value) : []))
  const held = computed(() => heldColorLookup(found.value))
  const palette = computed(() => newProjectPalette(builtIns.value, found.value))

  /** Whether the part is away from where the exact conversion was made: the only time beads are approximate. */
  const approximate = computed(() => moving.value && part.value !== restPart.value)
  const live = computed(() => {
    if (!approximate.value) return rest.value
    const moved = sample(part.value, 'centre')
    return removedFrom(moved, foundIn(moved)?.found)
  })

  const beadColors = computed(() => {
    const shown = live.value
    const exact = rest.value
    if (!shown || !exact) return []
    return approximate.value
      ? approximatePreviewColors(shown.sampled, held.value)
      : exactPreviewColors(exact.sampled, exact.lattice, exact.grid, grid.value, held.value)
  })

  /** The lattice as a block of beads for the Project renderer: shaped like a Project, upright, with no Row progress,
   * in its Bead's real cell. */
  const drawnProject = computed(() => {
    const shown = live.value
    if (!shown) return undefined
    const { columns, rows } = shown.lattice
    const cells: Grid = Array.from({ length: rows }, (_row, row) =>
      Array.from({ length: columns }, (_cell, column) => ({ color: beadColors.value[row * columns + column] ?? null })),
    )
    return framedGrid(cells, { ...weave.value, beadId: bead.value.id, bead: bead.value })
  })

  // --- Colors -------------------------------------------------------------------------------------------------------

  watch(
    catalogId,
    async (id) => {
      if (!id || catalog.value?.id === id) return
      catalogState.value = 'loading'
      try {
        const loaded = await loadCatalog(id)
        if (catalogId.value !== id) return
        catalog.value = loaded
        catalogState.value = 'ready'
      } catch {
        catalogState.value = 'failed'
      }
    },
    { immediate: true },
  )

  /** A choice made on a row of Color by color: every found color the row joins takes it (ticket 0863). */
  function setChoice(pictureHexes: readonly string[], choice: FoundColorChoice | undefined) {
    const next = new Map(choices.value)
    for (const pictureHex of pictureHexes) {
      if (choice) next.set(pictureHex, choice)
      else next.delete(pictureHex)
    }
    choices.value = next
  }

  /** Empty on a row: on, its found colors make no bead; pressed again, they are back to their match. */
  function toggleEmpty(pictureHexes: readonly string[]) {
    const empty = pictureHexes.every((pictureHex) => choices.value.get(pictureHex)?.kind === 'empty')
    setChoice(pictureHexes, empty ? undefined : { kind: 'empty' })
  }

  /** Make empty (ConvertImage card): a tap on a bead makes its bead color empty everywhere (its row of Color by color,
   * ticket 0863), and a tap on an empty place of that color brings it back. A place the background left is not a color
   * to tap. */
  function toggleEmptyAtBead(index: number) {
    const shown = live.value
    const packed = shown?.sampled[index]
    if (packed === undefined || packed === NO_COLOR) return
    // In the Frame at rest a bead shows its color after Clean up (ticket 0906).
    const at = approximate.value ? undefined : frameIndexOf(shown!, index)
    const cleaned = at === undefined ? undefined : cleanUp.raw.value[Math.floor(at / shown!.grid.columns)]?.[at % shown!.grid.columns]
    const pictureHex = reduced.value.byHex.get(cleaned ?? packedToHex(packed)) ?? nearestColorLookup(found.value.map((color) => color.pictureHex))(packed)
    const row = pictureHex && rows.value.find((candidate) => candidate.pictureHexes.includes(pictureHex))
    if (row) toggleEmpty(row.pictureHexes)
  }

  /** Pressing the tool that is on turns it off; the tools wait for a picture. Picking Background turns Remove background
   * on, so the tool has something to mark (ticket 0787). */
  function setTool(next: ConvertTool | undefined) {
    tool.value = next === tool.value || !image.value ? undefined : next
    if (tool.value === 'background') columnPopover.value = undefined
    if (tool.value === 'background' && background.value === 'off') {
      decide()
      background.value = 'find'
    }
  }

  // --- The Background tool's marks (ticket 0787) ----------------------------------------------------------------------

  /** The Frame's block index of a lattice bead (the preview's index), none outside the Frame. */
  function frameIndexOf(at: Sample, latticeIndex: number): number | undefined {
    const { lattice, grid: size } = at
    const row = Math.floor(latticeIndex / lattice.columns) - lattice.frameRow
    const column = (latticeIndex % lattice.columns) - lattice.frameColumn
    return row >= 0 && row < size.rows && column >= 0 && column < size.columns ? row * size.columns + column : undefined
  }

  /** The stroke being made, if any: the mark at the end of `marks`, and the last bead it took, so a pointer resting on a
   * bead adds it once. */
  let stroke: { lastBead: number } | undefined

  /** A press of the Background tool on a lattice bead (ticket 0787): a new step, keep if the bead is found and remove if
   * not, that the drag then extends. A new step drops what was undone. */
  function beginMark(latticeIndex: number) {
    const at = rawRest.value
    const index = at && frameIndexOf(at, latticeIndex)
    // A place with no color is nothing to keep or remove: no step.
    if (!at || index === undefined || at.sampled[latticeIndex] === NO_COLOR) return
    decide()
    if (background.value === 'off') background.value = 'find'
    const kind = restBackground.value?.found[index] ? 'keep' : 'remove'
    marks.value = [...marks.value, { kind, points: [pixelAtFrameBead(at, index)] }]
    stroke = { lastBead: index }
  }

  /** The drag going on over another bead: the step takes it too, in its own sense. */
  function extendMark(latticeIndex: number) {
    const at = rawRest.value
    const index = at && frameIndexOf(at, latticeIndex)
    const last = marks.value.at(-1)
    if (!stroke || !at || index === undefined || index === stroke.lastBead || !last) return
    stroke.lastBead = index
    marks.value = [...marks.value.slice(0, -1), { ...last, points: [...last.points, pixelAtFrameBead(at, index)] }]
  }

  function endMark() {
    stroke = undefined
  }

  /** Undo takes the last background decision back; Redo puts the last undone one back; Start over takes every Background
   * tool step back as one decision, so Undo puts them all back. */
  function undo() {
    const last = past.value.at(-1)
    if (!last) return
    undone.value = [decided(), ...undone.value]
    past.value = past.value.slice(0, -1)
    restore(last)
  }
  function redo() {
    const [next, ...rest] = undone.value
    if (!next) return
    past.value = [...past.value, decided()]
    undone.value = rest
    restore(next)
  }
  function resetMarks() {
    if (marks.value.length === 0) return
    decide()
    marks.value = []
  }
  watch(image, (picture) => {
    if (!picture) tool.value = undefined
  })

  /** Remove background's switch: on, the background is found (1 Find); off, everything is back (the tool's steps stay
   * for the next time). The switch stands in the tool's popover, so the tool stays on with it (ticket 0896). */
  function setRemoveBackground(on: boolean) {
    if (on !== (background.value !== 'off')) decide()
    background.value = on ? 'find' : 'off'
  }

  // --- The popovers (ticket 0896) -------------------------------------------------------------------------------------

  /** The column's popover that is open, if any: Bead and Technique, Size or Colors. */
  const columnPopover = ref<Exclude<ConvertPopover, 'background'>>()
  const popover = computed<ConvertPopover | undefined>(() => (tool.value === 'background' ? 'background' : columnPopover.value))
  /** A popover's button: opens it, closing any other, and pressed again closes it. Background's turns its tool on with
   * it, in one press. */
  function togglePopover(next: ConvertPopover) {
    if (next === 'background') return setTool('background')
    columnPopover.value = columnPopover.value === next ? undefined : next
    if (columnPopover.value && tool.value === 'background') tool.value = undefined
  }
  /** Closing a popover (Escape, a press outside, its button): Background's turns its tool off and keeps every decision. */
  function closePopover() {
    if (tool.value === 'background') tool.value = undefined
    columnPopover.value = undefined
  }

  /** The picture's file name without its extension: Name's placeholder, and the Name when it is left blank. */
  const fileStem = computed(() => fileName.value.replace(/\.[^.]*$/, ''))
  /** The name the Project gets, asked once (ticket 0897): the New Project form's, else the picture's file name. */
  const projectName = computed(() => name.value.trim() || fileStem.value)

  /** The Palette the remap picker shows (FoundColorRow card): the new Project's, as a Palette. */
  const remapPalette = computed(() => createPalette(palette.value.ids, builtIns.value, palette.value.codes))
  /** The Bead colors the remap picker lists, those the new Palette holds marked taken; only My beads' while it is the
   * source (ticket 0902). */
  const remapSwatches = computed(() => {
    if (!catalog.value || catalog.value.id !== catalogId.value) return []
    const swatches = catalogSwatches(catalog.value, bead.value.size, remapPalette.value.colors.map((color) => color.hex), brandColors(bead.value.brand.id))
    if (source.value !== 'my-beads') return swatches
    const owned = new Set(myBeads.codes.value)
    return swatches.filter((swatch) => owned.has(swatch.code))
  })

  /** A row of the My beads view pressed (ticket 0902): its code ticked or unticked. Unticking the last code while My
   * beads is the source falls back to the Bead's palette. */
  function toggleMyBeadsCode(code: string) {
    myBeads.toggle(code)
    fallBackFromEmptyList()
  }

  /** Clear list in the My beads view (ticket 0903): with My beads the source, the match falls back to the Bead's palette. */
  function clearMyBeads() {
    myBeads.clear()
    fallBackFromEmptyList()
  }

  function fallBackFromEmptyList() {
    if (chosenSource.value === 'my-beads' && myBeads.codes.value.length === 0) chosenSource.value = 'bead-colors'
  }

  /** The beads the Project would get at another number of colors, every other setting as it stands (the Colors
   * neighbours, ticket 0904): the page's own path, sampled grid, reduction, Finish cap and Clean up. */
  function beadsAtColors(count: number): Grid {
    if (!frameSampled.value) return []
    const at = cleanUp.cleanedOf(reducedFor(count))
    const beads = convertFrame(at.raw, at.reduced, at.found)
    return kept.value ? keptGrid(beads, kept.value) : beads
  }

  /** The Project the converted grid at rest makes: the page's own setup, the grid and its Palette (spec 0645). */
  function projectAtRest() {
    if (!image.value || !rest.value) return undefined
    const part = kept.value
    const size = part ? { columns: part.columns, rows: part.rows } : rest.value.grid
    return createProjectFromImage({
      name: projectName.value,
      technique: technique.value,
      ...(Object.keys(techniqueSettings.value).length > 0 ? { techniqueSettings: techniqueSettings.value } : {}),
      beadId: bead.value.id,
      makerName: makerName.value.trim(),
      size: { width: size.columns, height: size.rows, unit: 'beads' },
      grid: part ? keptGrid(grid.value, part) : grid.value,
      palette: palette.value,
    })
  }

  /** Create Project: whatever was moving settles first, so the Project is what the preview shows. */
  function createProject() {
    settle()
    return projectAtRest()
  }

  /** Add to Canvas (ticket 0883): the beads at rest, the kept part's where one is kept, whatever was moving settled. */
  function canvasGrid(): Grid {
    settle()
    const part = kept.value
    return part ? keptGrid(grid.value, part) : grid.value
  }

  /** The Project as it would be created now, for Review's counts; none without a picture. */
  const draftProject = computed(() => projectAtRest())
  /** How many beads the Project will hold: the kept part's, with no empty place counted (Review's summary). */
  const beadCount = computed(() => {
    const part = kept.value
    const cells = part ? keptGrid(grid.value, part) : grid.value
    return cells.reduce((sum, row) => sum + row.filter((cell) => cell.color !== null).length, 0)
  })

  return {
    // Setup
    name,
    makerName,
    projectName,
    beadId,
    bead,
    technique,
    settings,
    techniqueSettings,
    setSetting: (id: string, value: number) => (settings.value = { ...settings.value, [id]: value }),
    // The popovers, one at a time
    popover,
    togglePopover,
    closePopover,
    // Picture
    image,
    hasPicture: computed(() => !!image.value),
    fileName,
    fileStem,
    rejection,
    reading,
    readingFile,
    setFile,
    turn,
    flip,
    /** Photo or flat art (ticket 0889): what Clean up stray beads opens at reads it (ticket 0906). */
    pictureKind: kind,
    part,
    /** @internal The sampling tests weave a part of their own while a handle would move one, to see its centre pixels. */
    setPart: (next: PixelCrop) => (crop.cut.value = next),
    // Background
    background,
    setRemoveBackground,
    removeFound: () => {
      if (background.value === 'removed') return
      decide()
      background.value = 'removed'
    },
    showFound: () => {
      if (background.value === 'find') return
      decide()
      background.value = 'find'
    },
    tolerance,
    setTolerance: (next: number) => {
      const value = clamp(Math.round(next), BACKGROUND_TOLERANCE.min, BACKGROUND_TOLERANCE.max)
      if (value === tolerance.value) return
      decide(true)
      tolerance.value = value
    },
    /** The background found in the Frame at rest, row by row (1 marks a bead), and how much of the picture it takes. */
    backgroundFound: restBackground,
    /** The Background tool's steps (ticket 0787): a press on a lattice bead begins one, the drag extends it, letting go
     * ends it; Start over takes them all back. */
    beginMark,
    extendMark,
    endMark,
    resetMarks,
    hasMarks: computed(() => marks.value.length > 0),
    /** Undo and Redo walk the background decisions (the switch, Tolerance, Remove, Show what was found, the tool's steps),
     * with whether each has anything to do; the Tool pill under the picture holds them. */
    undo,
    redo,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => undone.value.length > 0),
    // Size
    sizing,
    dimensions,
    /** The part of the beads kept with the crop, if any (tickets 0780, 0898): only these become the Project. */
    kept,
    /** The crop on the picture (ticket 0898): its place in the lattice's beads, a drag's or a key's pull and shift, and
     * Keep all. */
    crop: crop.crop,
    beginCrop: crop.beginCrop,
    pullCrop: crop.pullCrop,
    shiftCrop: crop.shiftCrop,
    endCrop: crop.endCrop,
    nudgeCrop: crop.nudgeCrop,
    keepAll: crop.keepAll,
    /** The size the Project will have: the kept part's, or the whole grid's. */
    keptDimensions: computed(() => (kept.value ? { columns: kept.value.columns, rows: kept.value.rows } : dimensions.value)),
    setWidth,
    setHeight,
    linked,
    setLinked,
    heightMmOf,
    sizeUnit,
    setSizeUnit: (next: ConvertSizeUnit) => (sizeUnit.value = next),
    widthMmOf,
    largeSchema: computed(() => isLargeSchema(dimensions.value)),
    // The preview
    tool,
    setTool,
    moving,
    beginMove: () => (moving.value = true),
    endMove: () => {
      moving.value = false
      settle()
    },
    approximate,
    lattice: computed(() => live.value?.lattice),
    beadColors,
    previewGrid: computed(() => live.value?.grid),
    drawnProject,
    // Colors
    hasCatalog,
    catalogState,
    /** The loaded catalog itself, for the remap picker's empty state to name a code's other sizes (ticket 0713). */
    catalog,
    /** The Color catalog of the Bead in hand, none while another Bead's (or none) is loaded: names Review's coded colors (ticket 0759). */
    beadCatalog: computed(() => (catalog.value?.id === catalogId.value ? catalog.value : undefined)),
    source,
    /** The source the person chose or the page opened on, none for Bead colors where the Bead has them: what the device
     * keeps (ticket 0893), not a fallback forced by a Bead without a Color catalog. */
    chosenSource: readonly(chosenSource),
    setSource: (next: ColorSource) => (chosenSource.value = next),
    beadTargets,
    colorsMax,
    colorsCapped,
    maxColors,
    setMaxColors: (next: number) => (chosenColors.value = clamp(Math.round(next), MIN_IMAGE_COLORS, colorsMax.value)),
    found,
    rows,
    /** How many bead colors the beads use, counted after the match (ticket 0863): the rows not set to empty. */
    usedColorCount: computed(() => {
      const part = kept.value
      if (!part) return rows.value.filter((row) => row.result).length
      return new Set(keptGrid(grid.value, part).flatMap((cells) => cells.map((cell) => cell.color)).filter((color) => color !== null)).size
    }),
    /** How many rows are set to empty (the Color by color summary). */
    emptyColorCount: computed(() => rows.value.filter((row) => !row.result).length),
    choices,
    setChoice,
    toggleEmpty,
    toggleEmptyAtBead,
    palette,
    remapPalette,
    remapSwatches,
    /** Clean up (ticket 0906): Clean up stray beads, its strength and Small colors join, with what each did. */
    cleanUp,
    /** Auto-fix lighting (ticket 0907): its switch, and the picture the beads are sampled from (what Compare shows). */
    lighting,
    // My beads (ticket 0902)
    myBeadsCodes: myBeads.codes,
    myBeadsTargets: myBeads.targets,
    myBeadsOffered: myBeads.offered,
    toggleMyBeadsCode,
    /** Pasted codes added to My beads (ticket 0903). */
    addMyBeadsCodes: myBeads.add,
    clearMyBeads,
    /** With My beads the source, whether its codes are fewer than the colors asked, so fewer come out and the foot says so. */
    myBeadsShort: computed(() => source.value === 'my-beads' && myBeads.targets.value.length > 0 && myBeads.targets.value.length < maxColors.value),
    // The Finish filter (ticket 0901)
    finishes: finishes.finishes,
    /** The Finishes that narrow the match: none under Default Palette or Exact, where they are kept, off. */
    finishesApplied: finishes.applied,
    toggleFinish: finishes.toggle,
    clearFinishes: finishes.clear,
    /** The source's codes before the Finishes, which their live counts are counted over. */
    sourceBeadTargets,
    codesLeft: finishes.codesLeft,
    finishesShort,
    // The Colors neighbours (ticket 0904)
    beadsAtColors,
    /** The beads the Project would get now (the kept part's where one is kept), as the neighbours' middle shows them. */
    beadsShown: computed(() => (kept.value ? keptGrid(grid.value, kept.value) : grid.value)),
    /** A grid of beads as the Project renderer draws it, in this Bead and Weave (the neighbours' small pictures). */
    drawnBeads: (cells: Grid) => framedGrid(cells, { ...weave.value, beadId: bead.value.id, bead: bead.value }),
    // Review and Create
    draftProject,
    beadCount,
    createProject,
    addsToCanvas,
    canvasGrid,
  }
}

export type ConvertImageWizard = ReturnType<typeof useConvertImageWizard>

const wizardKey: InjectionKey<ConvertImageWizard> = Symbol('convertImageWizard')

/** The wizard hands its state to its sections and preview, so none has it passed down. */
export function provideConvertImageWizard(wizard: ConvertImageWizard) {
  provide(wizardKey, wizard)
}

/** The wizard's state, for a part mounted inside it. */
export function useConvertImageWizardState(): ConvertImageWizard {
  const wizard = inject(wizardKey)
  if (!wizard) throw new Error('useConvertImageWizardState() needs provideConvertImageWizard() called by an ancestor')
  return wizard
}
