import { computed, inject, onBeforeUnmount, provide, ref, shallowRef, watch, type InjectionKey } from 'vue'
import { catalogSwatches } from '../../domain/beadSwatch'
import { DEFAULT_BEAD, findBead } from '../../domain/beads'
import type { ColorCatalog } from '../../domain/colorCatalog'
import {
  beadColorTargets,
  convertFrame,
  matchFoundColors,
  newProjectPalette,
  sourceTargets,
  type ColorSource,
  type FoundColorChoice,
} from '../../domain/convertColors'
import {
  CUSTOM_RATIO_MAX,
  CUSTOM_RATIO_MIN,
  RATIO_PRESETS,
  cropForView,
  flipPicture,
  fullCrop,
  isLargeSchema,
  nearestRatio,
  pixelsPerBead,
  proportionalSide,
  ratioGrid,
  ratioOfSize,
  sameRatio,
  snapCrop,
  startingProposal,
  startingSize,
  turnPicture,
  viewForCrop,
  type PixelCrop,
  type PixelToBeadRatio,
  type SizeMode,
} from '../../domain/convertSize'
import { createProjectFromImage, type CreateProjectInput } from '../../domain/createProject'
import { approximatePreviewColors, exactPreviewColors, heldColorLookup, nearestColorLookup } from '../../domain/framingPreview'
import type { GridDimensions } from '../../domain/grid'
import { reducePictureColors } from '../../domain/imageColors'
import {
  DEFAULT_MAX_IMAGE_COLORS,
  ImageConversionError,
  NO_COLOR,
  clampMaxImageColors,
  frameColors,
  packedToHex,
  sampleLatticePacked,
  validateImageFile,
  type DecodeImage,
  type ImageRejection,
  type PixelData,
} from '../../domain/imageConversion'
import {
  CENTERED_PAN,
  CONVERT_ZOOM_STEP,
  clampConvertZoom,
  frameSizeMm,
  framingView,
  isSlowFramingSize,
  previewLattice,
  ratioLattice,
  type PanFraction,
} from '../../domain/imageFraming'
import { framedGrid } from '../../domain/layerBeads'
import { brandColors, createPalette, defaultPalette } from '../../domain/palette'
import type { Grid } from '../../domain/project'
import { estimatedSizeMm, gridFromSize, isSizeStated, type StatedSize } from '../../domain/projectSize'
import { DEFAULT_BEAD_SHAPE, beadCell, weaveSettings, withCell, type BeadShape, type Technique, type TechniqueSettings } from '../../domain/weave'

/** What the wizard needs from outside it: the New Project form's values it starts from (its own copy, spec 0645), how
 * a picture is decoded and how a Bead's Color catalog is fetched (both services, handed in by the app shell). */
export interface ConvertImageWizardDeps {
  start: CreateProjectInput
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog>
}

/** The unit By size states the Frame in (ConvertImage card): beads, mm or cm. Not the device's Size unit: the wizard
 * remembers nothing (spec 0645). */
export type ConvertSizeUnit = 'beads' | 'mm' | 'cm'

/** How long a moved picture or crop handle has to stay still before the colors are worked out exactly (ticket 122). */
const PAUSE_MS = 150

/** The Convert image wizard's state (spec 0645, ADR 0010): its own copy of the setup, the picture, the size, the colors,
 * and the preview and Project they make. Nothing is kept on the device and Cancel drops it all; Create reads
 * `createProject`. Mount it in the wizard's setup: it stops its timers on unmount. */
export function useConvertImageWizard({ start, decodeImage, loadCatalog }: ConvertImageWizardDeps) {
  // The setup, a copy of the form's: Cancel leaves the form as it was.
  const name = ref(start.name ?? '')
  const makerName = ref(start.makerName ?? '')
  const beadId = ref(start.beadId)
  const technique = ref<Technique>(start.technique)
  const settings = ref<TechniqueSettings>({ ...start.techniqueSettings })
  const beadShape = ref<BeadShape>(start.beadShape ?? DEFAULT_BEAD_SHAPE)
  const techniqueSettings = computed(() => weaveSettings({ technique: technique.value, techniqueSettings: settings.value }))
  const bead = computed(() => findBead(beadId.value) ?? DEFAULT_BEAD)
  const weave = computed(() => ({ technique: technique.value, techniqueSettings: techniqueSettings.value }))

  // The picture. shallowRef: megabytes of pixels never changed in place; Turn and Flip make a new one.
  const image = shallowRef<PixelData>()
  const fileName = ref('')
  const fileFormat = ref('')
  const rejection = ref<ImageRejection>()
  const reading = ref(false)

  // Size.
  const mode = ref<SizeMode>('ratio')
  const ratio = ref<PixelToBeadRatio>({ pixels: 1, beads: 1 })
  /** Whether the Custom chip is chosen, even when its ratio equals a preset's. */
  const customRatio = ref(false)
  const rawCrop = shallowRef<PixelCrop>()
  const unit = ref<ConvertSizeUnit>('beads')
  const widthText = ref<string | number>('')
  const heightText = ref<string | number>('')
  const keepProportions = ref(true)
  const zoom = ref(1)
  const pan = shallowRef<PanFraction>({ ...CENTERED_PAN })
  /** The last size the fields stated, so the Frame stays put while a field is empty mid-retype. */
  const sizeDimensions = shallowRef<GridDimensions>({ columns: 1, rows: 1 })

  // Colors.
  const catalogId = computed(() => bead.value.formFactor.colorCatalog)
  const catalog = shallowRef<ColorCatalog>()
  const catalogState = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const chosenSource = ref<ColorSource>()
  const maxColors = ref(DEFAULT_MAX_IMAGE_COLORS)
  const choices = shallowRef<ReadonlyMap<string, FoundColorChoice>>(new Map())

  const crop = computed(() => (image.value ? snapCrop(rawCrop.value ?? fullCrop(image.value), ratio.value, image.value) : fullCrop({ width: 1, height: 1 })))

  // What is converted at rest: the live pan and crop, held while a drag moves them (until it ends or pauses), so the
  // exact conversion is not redone on every move.
  const moving = ref(false)
  const restPan = shallowRef(pan.value)
  const restCrop = shallowRef(crop.value)
  let pauseTimer: ReturnType<typeof setTimeout> | undefined
  function settle() {
    clearTimeout(pauseTimer)
    pauseTimer = undefined
    restPan.value = pan.value
    restCrop.value = crop.value
  }
  watch(
    [pan, crop],
    () => {
      if (!moving.value) return settle()
      clearTimeout(pauseTimer)
      pauseTimer = setTimeout(settle, PAUSE_MS)
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(() => clearTimeout(pauseTimer))

  // --- Size ---------------------------------------------------------------------------------------------------------

  const stated = computed<StatedSize | undefined>(() => {
    const width = Number(widthText.value)
    const height = Number(heightText.value)
    if (String(widthText.value).trim() === '' || String(heightText.value).trim() === '') return undefined
    return isSizeStated(width, height, unit.value === 'beads' ? 'beads' : 'mm') ? { width, height, unit: unit.value } : undefined
  })
  watch(
    [stated, bead],
    ([size]) => {
      if (size) sizeDimensions.value = gridFromSize(size, bead.value)
    },
    { immediate: true },
  )

  const dimensionsFor = (at: PixelCrop) => (mode.value === 'ratio' ? ratioGrid(at, ratio.value) : sizeDimensions.value)
  const dimensions = computed(() => dimensionsFor(crop.value))
  const frameMm = computed(() => frameSizeMm(technique.value, sizeDimensions.value, bead.value))

  /** A grid's size in a unit, as the fields show it: beads, or mm and cm to one decimal. */
  function sizeIn(grid: GridDimensions, to: ConvertSizeUnit): { width: number; height: number } {
    if (to === 'beads') return { width: grid.columns, height: grid.rows }
    const { widthMm, heightMm } = estimatedSizeMm(grid, bead.value)
    const scale = to === 'cm' ? 10 : 1
    return { width: Math.round((widthMm / scale) * 10) / 10, height: Math.round((heightMm / scale) * 10) / 10 }
  }

  function showSize(grid: GridDimensions) {
    const { width, height } = sizeIn(grid, unit.value)
    widthText.value = width
    heightText.value = height
    sizeDimensions.value = grid
  }

  /** Keep picture proportions: the other field from the one just set, through the Bead in beads, as a length in mm. */
  function proportional(side: 'width' | 'height') {
    const picture = image.value
    if (!picture || !keepProportions.value) return
    const set = Number(side === 'width' ? widthText.value : heightText.value)
    if (!(set > 0)) return
    let other: number
    if (unit.value === 'beads') {
      if (!Number.isInteger(set)) return
      other = proportionalSide(picture, bead.value, technique.value, side === 'width' ? { columns: set } : { rows: set }, techniqueSettings.value)
    } else {
      const aspect = side === 'width' ? picture.height / picture.width : picture.width / picture.height
      other = Math.max(0.1, Math.round(set * aspect * 10) / 10)
    }
    if (side === 'width') heightText.value = other
    else widthText.value = other
  }

  function setWidth(value: string | number | undefined) {
    widthText.value = value ?? ''
    proportional('width')
  }
  function setHeight(value: string | number | undefined) {
    heightText.value = value ?? ''
    proportional('height')
  }
  function setKeepProportions(on: boolean) {
    keepProportions.value = on
    proportional('width')
  }
  // A Bead or Technique with another shape changes the other side through the Bead.
  watch([bead, technique], () => unit.value === 'beads' && proportional('width'))

  function setUnit(next: ConvertSizeUnit) {
    if (next === unit.value) return
    const grid = sizeDimensions.value
    unit.value = next
    showSize(grid)
  }

  function setRatio(next: PixelToBeadRatio, custom = false) {
    ratio.value = next
    customRatio.value = custom
  }

  /** A switch of mode carries the result across (spec 0645): a ratio's Schema becomes the fields and its crop the view; a
   * size's framed part becomes the crop, at the nearest ratio. */
  function setMode(next: SizeMode) {
    const picture = image.value
    if (next === mode.value) return
    if (!picture) {
      mode.value = next
      return
    }
    if (next === 'size') {
      const grid = ratioGrid(crop.value, ratio.value)
      mode.value = 'size'
      showSize(grid)
      const view = viewForCrop(picture, frameSizeMm(technique.value, grid, bead.value), crop.value)
      zoom.value = view.zoom
      pan.value = view.pan
    } else {
      const framed = cropForView(picture, frameMm.value, framingView(picture, frameMm.value, zoom.value, pan.value))
      const { x, y } = ratioOfSize(framed, sizeDimensions.value)
      const nearest = nearestRatio((x + y) / 2)
      mode.value = 'ratio'
      setRatio(nearest, !RATIO_PRESETS.some((preset) => sameRatio(preset, nearest)))
      rawCrop.value = framed
    }
    settle()
  }

  // --- Picture ------------------------------------------------------------------------------------------------------

  /** The crop or the pan starts over: a new picture, a turn or a flip. */
  function restartFraming() {
    rawCrop.value = undefined
    zoom.value = 1
    pan.value = { ...CENTERED_PAN }
    settle()
  }

  /** A picture from any way in, through the one validation and decode (spec 0645): the first one sets the starting
   * proposal; a later one replaces it and keeps every other setting. A refused one leaves the picture already set. */
  async function setFile(file: File): Promise<void> {
    rejection.value = validateImageFile(file)
    if (rejection.value) return
    reading.value = true
    try {
      const decoded = await decodeImage(file)
      const first = !image.value
      image.value = decoded
      fileName.value = file.name
      fileFormat.value = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : file.type.replace('image/', '')
      if (first) {
        const proposal = startingProposal(decoded)
        mode.value = proposal.mode
        setRatio(proposal.ratio)
        showSize(startingSize(decoded, bead.value, technique.value))
      }
      restartFraming()
    } catch (error) {
      rejection.value = error instanceof ImageConversionError ? error.reason : 'decodeFailed'
    } finally {
      reading.value = false
    }
  }

  function turn() {
    if (!image.value) return
    image.value = turnPicture(image.value)
    restartFraming()
  }

  function flip() {
    if (!image.value) return
    image.value = flipPicture(image.value)
    restartFraming()
  }

  // --- The preview's beads ------------------------------------------------------------------------------------------

  function placementFor(at: { pan: PanFraction; crop: PixelCrop }, picture: PixelData) {
    const grid = dimensionsFor(at.crop)
    if (mode.value === 'size') {
      const frame = frameSizeMm(technique.value, grid, bead.value)
      const view = framingView(picture, frame, zoom.value, at.pan)
      return {
        grid,
        placement: { view, bead: bead.value },
        lattice: previewLattice({ view, frame, dimensions: grid, bead: bead.value, ...weave.value }),
      }
    }
    return {
      grid,
      placement: { crop: at.crop, ratio: ratio.value },
      lattice: ratioLattice({ image: picture, crop: at.crop, pixelsPerBead: pixelsPerBead(ratio.value), dimensions: grid, ...weave.value }),
    }
  }

  function sample(at: { pan: PanFraction; crop: PixelCrop }) {
    const picture = image.value
    if (!picture) return undefined
    const { grid, placement, lattice } = placementFor(at, picture)
    return { grid, lattice, sampled: sampleLatticePacked({ image: picture, ...weave.value, ...placement, lattice }) }
  }

  const rest = computed(() => sample({ pan: restPan.value, crop: restCrop.value }))

  const hasCatalog = computed(() => !!catalogId.value)
  const source = computed<ColorSource>(() => {
    const wanted = chosenSource.value ?? (hasCatalog.value ? 'bead-colors' : 'default')
    return wanted === 'bead-colors' && !hasCatalog.value ? 'default' : wanted
  })
  const builtIns = computed(() => defaultPalette(bead.value.id))
  const beadTargets = computed(() =>
    catalog.value && catalog.value.id === catalogId.value ? beadColorTargets(catalog.value, bead.value.size, brandColors(bead.value.brand.id)) : [],
  )
  // Until its catalog has loaded, Bead colors matches to the Default Palette, so the preview never shows bare pixels.
  const targets = computed(() =>
    source.value === 'bead-colors' && beadTargets.value.length === 0
      ? sourceTargets('default', builtIns.value, [])
      : sourceTargets(source.value, builtIns.value, beadTargets.value),
  )

  const frameSampled = computed(() => rest.value && frameColors(rest.value.sampled, rest.value.lattice, rest.value.grid))
  const reduced = computed(() => reducePictureColors(frameSampled.value?.counts ?? new Map(), maxColors.value))
  const found = computed(() => matchFoundColors(reduced.value, targets.value, choices.value))
  const grid = computed<Grid>(() => (frameSampled.value ? convertFrame(frameSampled.value.raw, reduced.value, found.value) : []))
  const held = computed(() => heldColorLookup(found.value))
  const palette = computed(() => newProjectPalette(builtIns.value, found.value))

  /** Whether the picture or the crop is away from where the exact conversion was made: the only time beads are
   * approximate. */
  const approximate = computed(() => moving.value && (pan.value !== restPan.value || crop.value !== restCrop.value))
  const live = computed(() => (approximate.value ? sample({ pan: pan.value, crop: crop.value }) : rest.value))

  const beadColors = computed(() => {
    const shown = live.value
    const exact = rest.value
    if (!shown || !exact) return []
    return approximate.value
      ? approximatePreviewColors(shown.sampled, held.value)
      : exactPreviewColors(exact.sampled, exact.lattice, exact.grid, grid.value, held.value)
  })

  /** The lattice as a block of beads for the Project renderer: shaped like a Project, upright, with no Row progress,
   * in the Bead shape chosen. */
  const drawnProject = computed(() => {
    const shown = live.value
    if (!shown) return undefined
    const { columns, rows } = shown.lattice
    const cells: Grid = Array.from({ length: rows }, (_row, row) =>
      Array.from({ length: columns }, (_cell, column) => ({ color: beadColors.value[row * columns + column] ?? null })),
    )
    const drawn = withCell(weave.value, beadCell(bead.value, beadShape.value))
    return {
      ...drawn,
      ...framedGrid(cells, drawn),
      rowProgress: { direction: 'rows' as const, currentRow: 0, currentColumn: 0 },
      rotation: 0 as const,
    }
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

  function setChoice(pictureHex: string, choice: FoundColorChoice | undefined) {
    const next = new Map(choices.value)
    if (choice) next.set(pictureHex, choice)
    else next.delete(pictureHex)
    choices.value = next
  }

  /** Empty on a row: on, the found color makes no bead; pressed again, it is back to its match. */
  function toggleEmpty(pictureHex: string) {
    setChoice(pictureHex, choices.value.get(pictureHex)?.kind === 'empty' ? undefined : { kind: 'empty' })
  }

  /** Treat as empty (ConvertImage card): the found color of the bead under a tap on the preview set to empty. */
  function emptyAtBead(index: number) {
    const shown = live.value
    const packed = shown?.sampled[index]
    if (packed === undefined || packed === NO_COLOR) return
    const pictureHex = reduced.value.byHex.get(packedToHex(packed)) ?? nearestColorLookup(found.value.map((color) => color.pictureHex))(packed)
    if (pictureHex) setChoice(pictureHex, { kind: 'empty' })
  }

  /** The picture's file name without its extension: Name's placeholder, and the Name when it is left blank. */
  const fileStem = computed(() => fileName.value.replace(/\.[^.]*$/, ''))

  /** The Palette the remap picker shows (FoundColorRow card): the new Project's, as a Palette. */
  const remapPalette = computed(() => createPalette(palette.value.ids, builtIns.value, palette.value.codes))
  /** The Bead colors the remap picker lists, those the new Palette holds marked taken. */
  const remapSwatches = computed(() =>
    catalog.value && catalog.value.id === catalogId.value
      ? catalogSwatches(catalog.value, bead.value.size, remapPalette.value.colors.map((color) => color.hex), brandColors(bead.value.brand.id))
      : [],
  )

  /** The Project Create Project makes: the popup's own setup, the converted grid and its Palette (spec 0645). */
  function createProject() {
    settle()
    if (!image.value || !rest.value) return undefined
    return createProjectFromImage({
      name: name.value.trim() || fileStem.value,
      technique: technique.value,
      ...(Object.keys(techniqueSettings.value).length > 0 ? { techniqueSettings: techniqueSettings.value } : {}),
      beadId: bead.value.id,
      ...(beadShape.value !== DEFAULT_BEAD_SHAPE ? { beadShape: beadShape.value } : {}),
      makerName: makerName.value.trim(),
      size: { width: rest.value.grid.columns, height: rest.value.grid.rows, unit: 'beads' },
      grid: grid.value,
      palette: palette.value,
    })
  }

  /** The Project as it would be created now, for Review's counts; none without a picture. */
  const draftProject = computed(() => (image.value && rest.value ? createProject() : undefined))

  return {
    // Setup
    name,
    makerName,
    beadId,
    bead,
    technique,
    settings,
    techniqueSettings,
    beadShape,
    setSetting: (id: string, value: number) => (settings.value = { ...settings.value, [id]: value }),
    // Picture
    image,
    hasPicture: computed(() => !!image.value),
    fileName,
    fileStem,
    fileFormat,
    rejection,
    reading,
    setFile,
    turn,
    flip,
    // Size
    mode,
    setMode,
    ratio,
    customRatio,
    setRatio,
    customRatioRange: { min: CUSTOM_RATIO_MIN, max: CUSTOM_RATIO_MAX },
    crop,
    setCrop: (next: PixelCrop) => (rawCrop.value = next),
    unit,
    setUnit,
    widthText,
    heightText,
    setWidth,
    setHeight,
    keepProportions,
    setKeepProportions,
    zoom,
    zoomPercent: computed(() => Math.round(zoom.value * 100)),
    setZoom: (next: number) => (zoom.value = clampConvertZoom(next)),
    zoomIn: () => (zoom.value = clampConvertZoom(zoom.value + CONVERT_ZOOM_STEP)),
    zoomOut: () => (zoom.value = clampConvertZoom(zoom.value - CONVERT_ZOOM_STEP)),
    pan,
    setPan: (next: PanFraction) => (pan.value = next),
    frameMm,
    dimensions,
    /** What the result line reads (convertSize's convertResult): the ratio By Pixel to bead ratio, the framed crop By
     * size. */
    resultCrop: computed(() =>
      image.value && mode.value === 'size' ? cropForView(image.value, frameMm.value, framingView(image.value, frameMm.value, zoom.value, pan.value)) : undefined,
    ),
    slowFraming: computed(() => isSlowFramingSize(technique.value, dimensions.value)),
    largeSchema: computed(() => isLargeSchema(dimensions.value)),
    // The preview
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
    source,
    setSource: (next: ColorSource) => (chosenSource.value = next),
    beadTargets,
    maxColors,
    setMaxColors: (next: number) => (maxColors.value = clampMaxImageColors(next)),
    found,
    choices,
    setChoice,
    toggleEmpty,
    emptyAtBead,
    palette,
    remapPalette,
    remapSwatches,
    // Review and Create
    draftProject,
    createProject,
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
