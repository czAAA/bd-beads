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
  type TargetColor,
} from '../../domain/convertColors'
import {
  CONVERT_STEPS,
  flipPicture,
  fullCrop,
  isLargeSchema,
  partAround,
  partInset,
  sizingFor,
  startingSize,
  turnPicture,
  type ConvertStep,
  type PixelCrop,
  type SizeSide,
} from '../../domain/convertSize'
import { createProjectFromImage, type CreateProjectInput } from '../../domain/createProject'
import type { CutOutDevice, CutOutService } from '../../domain/cutOutModel'
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
  type SamplingRule,
} from '../../domain/imageConversion'
import { partLattice } from '../../domain/imageFraming'
import { framedGrid } from '../../domain/layerBeads'
import { lightingFix } from '../../domain/lightingFix'
import { brandColors, createPalette, defaultPalette } from '../../domain/palette'
import type { Grid } from '../../domain/project'
import { estimatedSizeMm } from '../../domain/projectSize'
import { cleanUpStrayBeads, MAX_CLEAN_UP } from '../../domain/strayBeads'
import { suggestedWidth as suggestWidth } from '../../domain/suggestedWidth'
import { backgroundFamilies, DEFAULT_TOLERANCE, simpleCutOut, subjectBox, type SubjectMask } from '../../domain/subjectMask'
import { darkestColor, hasEmptyRound, outlinedGrid, outlinedPreview, outlinePad } from '../../domain/subjectOutline'
import { weaveSettings, type Technique, type TechniqueSettings } from '../../domain/weave'
import { useAiCutOut, type CutOut } from './useAiCutOut'

export type { CutOut } from './useAiCutOut'

/** What the wizard needs from outside it: the New Project form's values it starts from (its own copy, spec 0645), how
 * a picture is decoded, how a Bead's Color catalog is fetched, the cut-out service that runs the AI choice's model
 * (ticket 0767) and the device record beside it (ticket 0768), all services handed in by the app shell. */
export interface ConvertImageWizardDeps {
  start: CreateProjectInput
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog>
  cutOutService: CutOutService
  cutOutDevice: CutOutDevice
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
export function useConvertImageWizard({ start, decodeImage, loadCatalog, cutOutService, cutOutDevice }: ConvertImageWizardDeps) {
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

  // Cut out (tickets 0765, 0767): the choice and the AI choice's run, and Simple's Tolerance in hundredths of OKLab.
  const ai = useAiCutOut({ service: cutOutService, device: cutOutDevice, image })
  const cutOut = ai.choice
  const tolerance = ref(DEFAULT_TOLERANCE)

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
  // The Colors step's helpers (ticket 0766): Auto-fix lighting, off until the maker turns it on, so pixel art's colors
  // are never changed behind their back; Clean up stray beads' passes, 0 for Off; the Outline and the color picked.
  const autoFixLighting = ref(false)
  const cleanUp = ref(0)
  const outline = ref(false)
  const chosenOutlineColor = shallowRef<TargetColor>()

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

  // --- Cut out ------------------------------------------------------------------------------------------------------

  // The colors round the picture's edges, worked out once per picture: a turn, flip or new picture is a new one.
  const families = computed(() => (image.value ? backgroundFamilies(image.value) : []))

  /** The subject mask over the picture's pixels (spec 0761), none with Cut out Off, nor while the AI choice works. It is
   * made from the picture as it is, so a turn, flip or new picture drops it and works it out again. The sampler, Fit to
   * subject and the Colors step's helpers (ticket 0766) read only this. */
  const subjectMask = computed<SubjectMask | undefined>(() => {
    const picture = image.value
    if (!picture || cutOut.value === 'off') return undefined
    if (cutOut.value === 'ai') return ai.mask.value
    return simpleCutOut(picture, families.value, tolerance.value)
  })

  /** The box round what Cut out kept, in whole pixels; none with Cut out Off or when it kept nothing. */
  const subjectBounds = computed(() => (subjectMask.value ? subjectBox(subjectMask.value) : undefined))

  /** Fit to subject (ticket 0765): A part set round what Cut out kept. The Width and Height stay, dropping only when the
   * part has fewer pixels than they allow (ticket 0757). */
  function fitToSubject() {
    const picture = image.value
    const box = subjectBounds.value
    if (!picture || !box) return
    rawPart.value = partAround(box, picture)
    weaveChoice.value = 'part'
  }

  // --- The preview's beads ------------------------------------------------------------------------------------------

  /** Auto-fix lighting's correction, measured from the subject while Cut out has one (ticket 0766); none while off. */
  const lighting = computed(() => (autoFixLighting.value && image.value ? lightingFix(image.value, subjectMask.value) : undefined))

  /** The beads over a part: each the color most of its area has at rest, its centre pixel while a handle moves, as
   * the full rule is too slow per move (ticket 0762); none outside Cut out's mask (ticket 0765); each pixel through
   * Auto-fix lighting while it is on (ticket 0766). */
  function sample(at: PixelCrop, rule: SamplingRule) {
    const picture = image.value
    if (!picture) return undefined
    const { grid, pixelsPerBead } = sizingOf(at)
    const lattice = partLattice({ image: picture, part: at, pixelsPerBead, dimensions: grid, ...weave.value })
    const sampled = sampleLatticePacked({ image: picture, ...weave.value, part: at, pixelsPerBead, lattice, rule, mask: subjectMask.value, adjust: lighting.value })
    return { grid, lattice, sampled }
  }

  const rest = computed(() => sample(restPart.value, 'area'))

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
  const reducedSampled = computed(() => reducePictureColors(frameSampled.value?.counts ?? new Map(), maxColors.value))
  /** Clean up stray beads (ticket 0766) on the reduced grid, before the match: the found colors and counts follow. */
  const cleaned = computed(() => cleanUpStrayBeads(frameSampled.value?.raw ?? [], reducedSampled.value, weave.value, cleanUp.value))
  const reduced = computed(() => cleaned.value.reduced)
  const found = computed(() => matchFoundColors(reduced.value, targets.value, choices.value))
  const grid = computed<Grid>(() => (frameSampled.value ? convertFrame(cleaned.value.raw, reduced.value, found.value) : []))
  const held = computed(() => heldColorLookup(found.value))

  // The Outline (ticket 0766): in the darkest found color until the maker picks one, only with empty beads round the
  // subject; on, the Schema is the grid grown round it.
  const outlineColor = computed(() => chosenOutlineColor.value ?? darkestColor(found.value.flatMap((color) => (color.result ? [color.result] : []))))
  const outlineShown = computed(() => hasEmptyRound(grid.value))
  const outlineOn = computed(() => outline.value && outlineShown.value && !!outlineColor.value)
  const schemaGrid = computed(() => (outlineOn.value ? outlinedGrid(grid.value, weave.value, outlineColor.value!.hex) : grid.value))
  const palette = computed(() => newProjectPalette(builtIns.value, outlineOn.value ? [...found.value, { result: outlineColor.value }] : found.value))

  /** Whether the part is away from where the exact conversion was made: the only time beads are approximate. */
  const approximate = computed(() => moving.value && part.value !== restPart.value)
  const live = computed(() => (approximate.value ? sample(part.value, 'centre') : rest.value))

  const sampledColors = computed(() => {
    const shown = live.value
    const exact = rest.value
    if (!shown || !exact) return []
    return approximate.value
      ? approximatePreviewColors(shown.sampled, held.value)
      : exactPreviewColors(exact.sampled, exact.lattice, exact.grid, grid.value, held.value)
  })

  /** The preview's lattice and beads, with room round the Frame for the Outline while it is on (ticket 0766): its
   * ring at rest, none while a handle moves. A tap maps back to the sampled bead under it. */
  const preview = computed(() => {
    const shown = live.value
    if (!shown) return undefined
    const base = { lattice: shown.lattice, colors: sampledColors.value }
    if (!outlineOn.value) return { ...base, sourceIndex: (index: number): number | undefined => index }
    return outlinedPreview(base, shown.grid, weave.value, approximate.value ? undefined : schemaGrid.value)
  })
  const beadColors = computed(() => preview.value?.colors ?? [])

  /** The lattice as a block of beads for the Project renderer: shaped like a Project, upright, with no Row progress,
   * in its Bead's real cell. */
  const drawnProject = computed(() => {
    const shown = preview.value
    if (!shown) return undefined
    const { columns, rows } = shown.lattice
    const cells: Grid = Array.from({ length: rows }, (_row, row) =>
      Array.from({ length: columns }, (_cell, column) => ({ color: beadColors.value[row * columns + column] ?? null })),
    )
    return framedGrid(cells, { ...weave.value, beadId: bead.value.id, bead: bead.value })
  })

  // --- Suggested Width ----------------------------------------------------------------------------------------------

  /** Suggested Width (ticket 0770, spec 0761): measured on the part at rest, through Cut out and Auto-fix lighting, over
   * the colors the Colors slider asks for. It never reads the Width, so moving the slider leaves it be, and as a computed
   * it is worked out only while the Size step reads it. */
  const suggestedWidth = computed(() => {
    const picture = image.value
    if (!picture) return undefined
    const at = restPart.value
    // Linked, the Height follows each Width tried; unlinked, it stays as set.
    const height = linked.value ? undefined : heightBeads.value
    const sizingAt = (width: number) =>
      sizingFor({ part: at, width, height, linked: linked.value, lead: 'width', bead: bead.value, technique: technique.value, techniqueSettings: techniqueSettings.value })
    // The slider's range and marks depend on the part alone, whatever Width is asked.
    const { range, marks } = sizingAt(0)
    return suggestWidth({
      image: picture,
      part: at,
      mask: subjectMask.value,
      adjust: lighting.value,
      colors: clamp(chosenColors.value, MIN_IMAGE_COLORS, MAX_IMAGE_COLORS),
      range,
      marks: marks.map((mark) => mark.width),
      sizingAt,
    })
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

  /** Treat as empty (ConvertImage card): the found color of the bead under a tap on the preview set to empty; in the
   * Frame at rest, the color it shows after Clean up stray beads (ticket 0766). */
  function emptyAtBead(index: number) {
    const shown = live.value
    const at = preview.value?.sourceIndex(index)
    const packed = at === undefined ? undefined : shown?.sampled[at]
    if (!shown || at === undefined || packed === undefined || packed === NO_COLOR) return
    const row = Math.floor(at / shown.lattice.columns) - shown.lattice.frameRow
    const column = (at % shown.lattice.columns) - shown.lattice.frameColumn
    const cleanedHex = approximate.value ? undefined : cleaned.value.raw[row]?.[column]
    const pictureHex = reduced.value.byHex.get(cleanedHex ?? packedToHex(packed)) ?? nearestColorLookup(found.value.map((color) => color.pictureHex))(packed)
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
      size: { width: schemaGrid.value[0]?.length ?? 0, height: schemaGrid.value.length, unit: 'beads' },
      grid: schemaGrid.value,
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
    cutOut,
    setCutOut: (next: CutOut) => ai.choose(next),
    /** The AI choice's question, download, run or failure (ticket 0767): what shows under the Cut out row. */
    aiCutOut: ai.status,
    /** Download on the download note, or Try again on the question after a stopped run (ticket 0768). */
    downloadCutOutModel: ai.download,
    /** The last run stopped with the tab (ticket 0768): the AI chip's warning dot and Tooltip body. */
    cutOutStopped: ai.stopped,
    /** Cancel on the note or the AI Loading: back to the choice before. */
    cancelAiCutOut: ai.cancel,
    /** The tap add and tap remove chips and Reset under the AI chip (ticket 0769): shown, which is on, the taps, a tap. */
    cutOutTapsShown: ai.tapsShown,
    cutOutTapMode: ai.tapMode,
    toggleCutOutTap: ai.toggleTap,
    cutOutTaps: ai.taps,
    /** A tap on the preview at a picture pixel, while tap add or tap remove is on. */
    tapCutOut: ai.tap,
    resetCutOutTaps: ai.resetTaps,
    tolerance,
    setTolerance: (next: number) => (tolerance.value = next),
    subjectMask,
    subjectBounds,
    fitToSubject,
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
    /** The Suggested Width (ticket 0770); none without a picture. */
    suggestedWidth,
    /** Use suggested: the Width moves to the suggestion, the Height following while linked. */
    useSuggestedWidth: () => {
      if (suggestedWidth.value !== undefined) setWidth(suggestedWidth.value)
    },
    // The preview
    moving,
    beginMove: () => (moving.value = true),
    endMove: () => {
      moving.value = false
      settle()
    },
    approximate,
    lattice: computed(() => preview.value?.lattice),
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
    // The Colors step's helpers (ticket 0766)
    autoFixLighting,
    setAutoFixLighting: (next: boolean) => (autoFixLighting.value = next),
    cleanUp,
    setCleanUp: (next: number) => (cleanUp.value = clamp(Math.round(next), 0, MAX_CLEAN_UP)),
    outline,
    setOutline: (next: boolean) => (outline.value = next),
    outlineShown,
    /** The Outline's color: the one picked, or the darkest found color; none with no colored bead. */
    outlineColor,
    /** Whether the maker picked the Outline's color, rather than the darkest found color. */
    outlineColorPicked: computed(() => !!chosenOutlineColor.value),
    /** A color picked for the Outline; none goes back to the darkest found color. */
    setOutlineColor: (next: TargetColor | undefined) => (chosenOutlineColor.value = next),
    /** How far the Schema grows past the Frame on each side for the Outline; none while it is off or not shown. */
    outlinePad: computed(() => (outlineOn.value ? outlinePad(weave.value) : undefined)),
    /** The Schema's size, the Outline's ring included: what Create Project makes. */
    schemaSize: computed(() => ({ columns: schemaGrid.value[0]?.length ?? 0, rows: schemaGrid.value.length })),
    /** How many beads the Schema holds, the Outline's included (Review's weight). */
    beadCount: computed(() => schemaGrid.value.reduce((sum, row) => sum + row.filter((cell) => cell.color).length, 0)),
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
