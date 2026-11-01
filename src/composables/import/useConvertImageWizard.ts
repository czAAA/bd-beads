import { computed, inject, onScopeDispose, provide, ref, shallowRef, watch, type InjectionKey } from 'vue'
import { catalogSwatches } from '../../domain/beadSwatch'
import { colorCatalogOf, DEFAULT_BEAD, findBead } from '../../domain/beads'
import { clamp } from '../../domain/clamp'
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
  CONVERT_STEPS,
  flipPicture,
  fullCrop,
  isLargeSchema,
  partInset,
  sizingFor,
  startingSize,
  turnPicture,
  type ConvertStep,
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
  validateImageFile,
  type DecodeImage,
  type ImageRejection,
  type PixelData,
} from '../../domain/imageConversion'
import { partLattice } from '../../domain/imageFraming'
import { framedGrid } from '../../domain/layerBeads'
import { brandColors, createPalette, defaultPalette } from '../../domain/palette'
import type { Grid } from '../../domain/project'
import { estimatedSizeMm } from '../../domain/projectSize'
import { weaveSettings, type Technique, type TechniqueSettings } from '../../domain/weave'

/** What the wizard needs from outside it: the New Project form's values it starts from (its own copy, spec 0645), how
 * a picture is decoded and how a Bead's Color catalog is fetched (both services, handed in by the app shell). */
export interface ConvertImageWizardDeps {
  start: CreateProjectInput
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog>
}

/** What to weave (ConvertImage card, 1 Picture): the whole picture, or a part of it under the preview's handles. */
export type ConvertWeave = 'whole' | 'part'

/** The unit the Width slider reads in (ConvertImage card, slide in): it moves in whole beads either way. Not the
 * device's Size unit: the wizard remembers nothing (spec 0645). */
export type ConvertSizeUnit = 'beads' | 'mm'

/** How long a moved handle has to stay still before the colors are worked out exactly (ticket 122). */
const PAUSE_MS = 150

/** The Convert image wizard's state (spec 0645, ADR 0010; ticket 0747): its own copy of the setup, the picture, the part,
 * the Width, the colors, and the preview and Project they make. Nothing is kept: leaving drops it all, Create reads
 * `createProject`. Run it in an effect scope (the flow's session), which stops its timers. */
export function useConvertImageWizard({ start, decodeImage, loadCatalog }: ConvertImageWizardDeps) {
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
  const fileFormat = ref('')
  const rejection = ref<ImageRejection>()
  const reading = ref(false)

  // The step shown (ticket 0756): the Progress bar's dots and the page's one section follow it.
  const step = ref<ConvertStep>('picture')

  // What to weave and how big (ConvertImage card): the part, the Width in beads, and the unit it reads in.
  const weaveChoice = ref<ConvertWeave>('whole')
  const rawPart = shallowRef<PixelCrop>()
  const widthBeads = ref(0)
  const heightBeads = ref(0)
  // The chain (ticket 0757): linked, the side moved last leads and the other follows the picture's shape; unlinked,
  // each is its own.
  const linked = ref(true)
  const lead = ref<SizeSide>('width')
  const sizeUnit = ref<ConvertSizeUnit>('beads')

  // Colors.
  const catalogId = computed(() => colorCatalogOf(bead.value.id))
  const catalog = shallowRef<ColorCatalog>()
  const catalogState = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const chosenSource = ref<ColorSource>()
  const chosenColors = ref(DEFAULT_MAX_IMAGE_COLORS)
  const choices = shallowRef<ReadonlyMap<string, FoundColorChoice>>(new Map())
  /** Treat as empty (ConvertImage card, ticket 0758): on, the preview takes the eyedropper's taps. It is on the Colors step only. */
  const treatAsEmpty = ref(false)

  /** The part of the picture to weave: the whole picture, or the part under the handles. */
  const part = computed<PixelCrop>(() => {
    const picture = image.value
    if (!picture) return { x: 0, y: 0, width: 1, height: 1 }
    return weaveChoice.value === 'part' && rawPart.value ? rawPart.value : fullCrop(picture)
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
  const sizingOf = (at: PixelCrop) =>
    sizingFor({
      part: at,
      width: widthBeads.value,
      height: heightBeads.value,
      linked: linked.value,
      lead: lead.value,
      bead: bead.value,
      technique: technique.value,
      techniqueSettings: techniqueSettings.value,
    })
  const sizing = computed(() => sizingOf(part.value))
  const dimensions = computed(() => sizing.value.grid)

  /** A Width in beads as the piece's width in mm through the Bead, for the slider's labels. */
  function widthMmOf(beads: number): number {
    return Math.round(estimatedSizeMm({ columns: beads, rows: 1 }, bead.value, technique.value).widthMm)
  }

  /** A Height in beads as the piece's height in mm through the Bead, for the slider's labels. */
  function heightMmOf(beads: number): number {
    return Math.round(estimatedSizeMm({ columns: 1, rows: beads }, bead.value, technique.value).heightMm)
  }

  function setWidth(beads: number) {
    widthBeads.value = beads
    lead.value = 'width'
  }

  function setHeight(beads: number) {
    heightBeads.value = beads
    lead.value = 'height'
  }

  /** The chain: unlinking keeps the sizes on show, and linking again takes the shape back from the side moved last. */
  function setLinked(next: boolean) {
    if (!next && linked.value) {
      widthBeads.value = sizing.value.width
      heightBeads.value = sizing.value.height
    }
    linked.value = next
  }

  function setWeave(next: ConvertWeave) {
    const picture = image.value
    if (next === 'part' && picture && !rawPart.value) rawPart.value = partInset(picture)
    weaveChoice.value = next
  }

  // --- Picture ------------------------------------------------------------------------------------------------------

  /** Weave goes back to the whole picture (a new picture, a turn or a flip). */
  function restartPart() {
    rawPart.value = undefined
    weaveChoice.value = 'whole'
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
        const opening = startingSize(decoded)
        widthBeads.value = opening.width
        heightBeads.value = opening.height
      }
      restartPart()
    } catch (error) {
      rejection.value = error instanceof ImageConversionError ? error.reason : 'decodeFailed'
    } finally {
      reading.value = false
    }
  }

  /** Turn 90°: the picture's sides swap, before sampling. */
  function turn() {
    if (!image.value) return
    image.value = turnPicture(image.value)
    restartPart()
  }

  function flip() {
    if (!image.value) return
    image.value = flipPicture(image.value)
    restartPart()
  }

  // --- The preview's beads ------------------------------------------------------------------------------------------

  function sample(at: PixelCrop) {
    const picture = image.value
    if (!picture) return undefined
    const { grid, pixelsPerBead } = sizingOf(at)
    const lattice = partLattice({ image: picture, part: at, pixelsPerBead, dimensions: grid, ...weave.value })
    return { grid, lattice, sampled: sampleLatticePacked({ image: picture, ...weave.value, part: at, pixelsPerBead, lattice }) }
  }

  const rest = computed(() => sample(restPart.value))

  const hasCatalog = computed(() => !!catalogId.value)
  /** What the found colors are matched to: Exact until a source is chosen (ticket 0758). */
  const source = computed<ColorSource>(() => {
    const wanted = chosenSource.value ?? 'exact'
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
  /** Every color the part has (the Colors slider's max, ConvertImage card): the distinct colors its beads sample, at
   * most MAX_IMAGE_COLORS, since a pattern of more would not be one. */
  const colorsFound = computed(() => Math.max(MIN_IMAGE_COLORS, frameSampled.value?.counts.size ?? MIN_IMAGE_COLORS))
  const colorsMax = computed(() => Math.min(MAX_IMAGE_COLORS, colorsFound.value))
  /** Whether the part has more colors than the slider offers, so the hint says so. */
  const colorsCapped = computed(() => colorsFound.value > MAX_IMAGE_COLORS)
  /** The Colors slider: 12 at first, or every color where that is fewer; a part with fewer colors pulls it down. */
  const maxColors = computed(() => clamp(chosenColors.value, MIN_IMAGE_COLORS, colorsMax.value))
  const reduced = computed(() => reducePictureColors(frameSampled.value?.counts ?? new Map(), maxColors.value))
  const found = computed(() => matchFoundColors(reduced.value, targets.value, choices.value))
  const grid = computed<Grid>(() => (frameSampled.value ? convertFrame(frameSampled.value.raw, reduced.value, found.value) : []))
  const held = computed(() => heldColorLookup(found.value))
  const palette = computed(() => newProjectPalette(builtIns.value, found.value))

  /** Whether the part is away from where the exact conversion was made: the only time beads are approximate. */
  const approximate = computed(() => moving.value && part.value !== restPart.value)
  const live = computed(() => (approximate.value ? sample(part.value) : rest.value))

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

  watch([step, () => !!image.value], ([at, hasPicture]) => {
    if (at !== 'colors' || !hasPicture) treatAsEmpty.value = false
  })

  const stepIndex = computed(() => CONVERT_STEPS.indexOf(step.value))
  /** Every step after Picture waits for a picture. */
  const canGoTo = (next: ConvertStep) => next === 'picture' || !!image.value
  function goTo(next: ConvertStep | undefined) {
    if (next && canGoTo(next)) step.value = next
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

  /** The Project the converted grid at rest makes: the page's own setup, the grid and its Palette (spec 0645). */
  function projectAtRest() {
    if (!image.value || !rest.value) return undefined
    return createProjectFromImage({
      name: name.value.trim() || fileStem.value,
      technique: technique.value,
      ...(Object.keys(techniqueSettings.value).length > 0 ? { techniqueSettings: techniqueSettings.value } : {}),
      beadId: bead.value.id,
      makerName: makerName.value.trim(),
      size: { width: rest.value.grid.columns, height: rest.value.grid.rows, unit: 'beads' },
      grid: grid.value,
      palette: palette.value,
    })
  }

  /** Create Project: whatever was moving settles first, so the Project is what the preview shows. */
  function createProject() {
    settle()
    return projectAtRest()
  }

  /** The Project as it would be created now, for Review's counts; none without a picture. */
  const draftProject = computed(() => projectAtRest())

  return {
    // Setup
    name,
    makerName,
    beadId,
    bead,
    technique,
    settings,
    techniqueSettings,
    setSetting: (id: string, value: number) => (settings.value = { ...settings.value, [id]: value }),
    // The steps: Picture first, the rest once a picture is set; Next on the last is Create Project
    step,
    canGoTo,
    goTo,
    goBack: () => goTo(CONVERT_STEPS[stepIndex.value - 1]),
    goNext: () => goTo(CONVERT_STEPS[stepIndex.value + 1]),
    stepIndex,
    onLastStep: computed(() => stepIndex.value === CONVERT_STEPS.length - 1),
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
    weave: computed(() => weaveChoice.value),
    setWeave,
    part,
    setPart: (next: PixelCrop) => (rawPart.value = next),
    // Size
    sizing,
    dimensions,
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
    setSource: (next: ColorSource) => (chosenSource.value = next),
    beadTargets,
    colorsMax,
    colorsCapped,
    maxColors,
    setMaxColors: (next: number) => (chosenColors.value = clamp(Math.round(next), MIN_IMAGE_COLORS, colorsMax.value)),
    found,
    /** How many colors the beads use: found colors not set to empty. */
    usedColorCount: computed(() => found.value.filter((color) => color.result).length),
    /** How many found colors are set to empty (the Color by color summary). */
    emptyColorCount: computed(() => found.value.filter((color) => !color.result).length),
    choices,
    setChoice,
    toggleEmpty,
    treatAsEmpty,
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
