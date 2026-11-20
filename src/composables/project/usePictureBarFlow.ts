import { computed, ref, shallowRef, watch } from 'vue'
import { beadLabel, colorCatalogOf, DEFAULT_BEAD, findBead, type Bead } from '../../domain/beads'
import type { Rect } from '../../domain/canvas'
import { measuredColorSource, type ColorCatalog } from '../../domain/colorCatalog'
import { beadColorTargets, sourceTargets, type ColorSource } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { LARGE_SCHEMA_BEADS } from '../../domain/convertSize'
import { DEFAULT_MAX_IMAGE_COLORS, MAX_IMAGE_COLORS, type PixelData } from '../../domain/imageConversion'
import { snappedFrame } from '../../domain/frame'
import { beadOfLayer, canvasOf, heldWeave } from '../../domain/layerRecord'
import { canvasWeave } from '../../domain/layerWeave'
import { brandColors, defaultPalette } from '../../domain/palette'
import type { Grid, Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { beadsReplaced, convertSampled, gridChanges, sampledColorCount, sampledColors, withConvertedBeads, type ReferenceConversion } from '../../domain/referenceConvert'
import { referenceHeight, samePlace, type ReferencePlace } from '../../domain/referenceImage'
import { keepAllowedEdits } from '../../domain/allowedEdits'
import { plural, pluralForm } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import { pictureCover } from '../../rendering/referenceCover'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from './useEdit'

/** The fewest positions a side Convert to beads takes (ReferenceImage card); the most is the Large Schema limit, past
 * which Convert image is the way. */
const MIN_SIDE = 4

/** Why Convert to beads is off: the picture covers too few positions a side, or too many. */
export type ConvertOff = 'too-small' | 'too-big'

/** What All settings hands Convert image (ConvertImage card, From the reference image): the picture, the size it
 * covers and where, the Canvas's Bead and Weave, Exact or the match chosen, the color count and Hide the picture after. */
export interface AllSettingsRequest {
  picture: Blob
  name: string
  box: Rect
  source: ColorSource
  colors: number
  hideAfter: boolean
}

/** What the picture bar needs from the app shell: the open Project and its Edit and Undo, the picture as it lies now
 * (a drag's place as it goes) with its bytes, how pixels and catalogs are read, the picture's shown switch, the Frame
 * flow's Set Frame around and Convert image's All settings. */
export interface PictureBarFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  onUndo: () => void
  /** The reference image's place now: a drag's as it goes, else the saved one. */
  place: () => ReferencePlace | undefined
  /** The open Project's picture, its stored bytes. */
  picture: () => Blob | undefined
  decodePixels: (blob: Blob) => Promise<PixelData>
  loadCatalog: (id: string) => Promise<ColorCatalog>
  setShown: (shown: boolean) => void
  setFrameAround: (frame: Rect) => void
  openAllSettings: (request: AllSettingsRequest) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  announce: (text: string) => void
  messages: () => Translations
  locale: () => Locale
}

/** The picture bar's two actions on the reference image (ReferenceImage card, ticket 0883): the size it covers, Set
 * Frame around the picture, and Convert to beads with its popover, live preview, one Undo step and toast. */
export function usePictureBarFlow(deps: PictureBarFlowDeps) {
  /** The Convert to beads popover is open: the picture is drawn as the beads it will make. */
  const converting = ref(false)
  /** The match the person chose, kept from one opening to the next; none is the Bead's palette (ticket 0969). */
  const chosenSource = ref<ColorSource>()
  /** The Colors stepper's choice, kept from one opening to the next; none is 12, or every color where that is fewer. */
  const chosenColors = ref<number>()
  const hideAfter = ref(true)
  const catalog = shallowRef<ColorCatalog>()
  const pixels = shallowRef<{ blob: Blob; data: PixelData }>()

  const bead = computed<Bead>(() => {
    const project = deps.currentProject()
    if (!project) return DEFAULT_BEAD
    return beadOfLayer(project, 'canvas').bead ?? findBead(canvasOf(project).beadId) ?? DEFAULT_BEAD
  })

  /** A handle or the Move grip is dragging the picture: it lies off the place it is saved at. */
  const dragging = computed(() => {
    const saved = deps.currentProject()?.referenceImage?.place
    const now = deps.place()
    return !!saved && !!now && !samePlace(saved, now)
  })
  /** The positions the picture covers where it rests, at its saved place: what Convert to beads makes its beads from.
   * Not a drag's place as it goes: making the beads again takes far longer than a frame of the drag, so every move
   * held the app (ticket 1160). */
  const restingCover = computed(() => {
    const project = deps.currentProject()
    const image = project?.referenceImage
    return project && image ? pictureCover(canvasWeave(project), image.place, referenceHeight(image)) : undefined
  })
  /** The positions the picture covers as it lies now, a drag's place as it goes, and the box round them. */
  const cover = computed(() => {
    const project = deps.currentProject()
    const place = deps.place()
    const picture = project?.referenceImage?.picture
    if (!project || !place || !picture) return undefined
    return dragging.value ? pictureCover(canvasWeave(project), place, referenceHeight({ picture, place })) : restingCover.value
  })
  const box = computed(() => cover.value?.box)
  /** The Frame Set Frame around the picture makes: the box, its top and left where a Frame may start. */
  const frameBox = computed(() => {
    const project = deps.currentProject()
    return box.value && project ? snappedFrame(heldWeave(project, 'canvas'), box.value) : undefined
  })

  /** The size in words: "26×18" and its measure through the Canvas's Bead. */
  const size = computed(() => {
    const at = box.value
    if (!at) return undefined
    const project = deps.currentProject()!
    const t = deps.messages()
    const measure = formatSizeMm(estimatedSizeMm(at, bead.value, canvasWeave(project).technique), { mm: t.form.unitMm, cm: t.form.unitCm }, deps.locale())
    return { grid: `${at.columns}×${at.rows}`, measure }
  })

  /** Why a picture covering this box can't be converted, if it can't. */
  function offFor(at: Rect | undefined): ConvertOff | undefined {
    if (!at || at.columns < MIN_SIDE || at.rows < MIN_SIDE) return 'too-small'
    return at.columns > LARGE_SCHEMA_BEADS || at.rows > LARGE_SCHEMA_BEADS ? 'too-big' : undefined
  }
  const convertOff = computed(() => offFor(box.value))

  const hasCatalog = computed(() => !!colorCatalogOf(bead.value.id))
  /** The match: the Bead's palette by default, as Convert image opens; the Default Palette for a Bead with no Color
   * catalog (ticket 0969). */
  const source = computed<ColorSource>(() => {
    const wanted = chosenSource.value ?? 'bead-colors'
    return wanted === 'bead-colors' && !hasCatalog.value ? 'default' : wanted
  })
  const targets = computed(() => {
    const builtIns = defaultPalette(bead.value.id)
    const loaded = catalog.value
    const beadTargets = loaded && loaded.id === colorCatalogOf(bead.value.id) ? beadColorTargets(loaded, bead.value.size, brandColors(bead.value.brand.id)) : []
    // Until its catalog has loaded, the Bead's palette matches to the Default Palette, as Convert image does.
    return source.value === 'bead-colors' && beadTargets.length === 0 ? sourceTargets('default', builtIns, []) : sourceTargets(source.value, builtIns, beadTargets)
  })

  const sampled = computed(() => {
    const read = pixels.value
    const at = restingCover.value
    // A picture too small or too big makes no beads, so none are read: past 300 a side they are hundreds of thousands.
    if (!converting.value || !read || !at?.listed || offFor(at.box) || read.blob !== deps.picture()) return undefined
    return sampledColors(read.data, at.positions)
  })
  /** Every color the picture's beads sample, at most 256: the Colors stepper's most. */
  const colorsMax = computed(() => Math.max(1, Math.min(MAX_IMAGE_COLORS, sampled.value ? sampledColorCount(sampled.value) : 1)))
  const colors = computed(() => Math.min(colorsMax.value, chosenColors.value ?? DEFAULT_MAX_IMAGE_COLORS))
  const conversion = computed<ReferenceConversion | undefined>(() => sampled.value && convertSampled(sampled.value, colors.value, targets.value))

  /** The open Project as Convert would leave it, beads the rows marked done or the margin hold left out: the preview.
   * None while the picture is dragged: it shows as itself until it is let go and its beads are made again. */
  const previewProject = computed(() => {
    const project = deps.currentProject()
    const made = conversion.value
    if (!project || !made || convertOff.value || dragging.value) return undefined
    return keepAllowedEdits(project, withConvertedBeads(project, made.changes))
  })
  const replaced = computed(() => {
    const project = deps.currentProject()
    return project && conversion.value ? beadsReplaced(project, conversion.value.changes) : 0
  })

  async function readPixels(): Promise<void> {
    const blob = deps.picture()
    if (!blob || pixels.value?.blob === blob) return
    const data = await deps.decodePixels(blob)
    if (deps.picture() === blob) pixels.value = { blob, data }
  }

  async function readCatalog(): Promise<void> {
    const id = colorCatalogOf(bead.value.id)
    if (!id || catalog.value?.id === id) return
    try {
      catalog.value = await deps.loadCatalog(id)
    } catch {
      // The Bead's palette then matches to the Default Palette, as while it loads.
    }
  }

  /** Convert to beads pressed: the popover opens on the match and colors chosen last, at first the Bead's palette and 12
   * colors (ticket 0969); off while the picture is too small or big. */
  function open(): void {
    if (convertOff.value || converting.value) return
    hideAfter.value = true
    converting.value = true
    void readPixels()
    if (source.value === 'bead-colors') void readCatalog()
  }

  function close(): void {
    converting.value = false
  }

  function setSource(next: ColorSource): void {
    chosenSource.value = next
    if (next === 'bead-colors') void readCatalog()
  }

  function setColors(count: number): void {
    chosenColors.value = Math.max(1, Math.min(colorsMax.value, Math.round(count)))
  }

  /** Convert {n} beads: the beads laid where the picture lies as one Undo step, the picture hidden when asked (a view
   * change, no step), and a toast whose Undo takes the beads back and shows the picture again. */
  function convert(): void {
    const made = conversion.value
    if (!made || convertOff.value) return
    const outcome = deps.edit('drawing', (project) => withConvertedBeads(project, made.changes))
    converting.value = false
    if (outcome.kind !== 'applied') return
    told(made.changes.length, made.colors.length, hideAfter.value)
  }

  /** Convert image's Add to Canvas (ticket 0883): its beads laid where the picture lay when All settings was pressed, as
   * Convert does, one Undo step, the same toast. */
  function addGrid(grid: Grid, request: AllSettingsRequest): void {
    const changes = gridChanges(grid, request.box)
    const outcome = deps.edit('drawing', (project) => withConvertedBeads(project, changes))
    if (outcome.kind === 'applied') told(changes.length, new Set(changes.map((change) => change.color)).size, request.hideAfter)
  }

  /** What a conversion says once it is on the Canvas, from here or from Convert image's Add to Canvas. */
  function told(beads: number, colorCount: number, hide: boolean): void {
    const words = deps.messages().referenceImage.convert
    if (hide) deps.setShown(false)
    const made = fillBlanks(pluralForm(deps.locale(), colorCount, words.made), { n: groupThousands(beads, deps.locale()), colors: colorCount })
    deps.announce(made)
    deps.showToast('convert-to-beads', hide ? `${made} ${words.hidden}` : made, 'success', {
      label: deps.messages().palette.undoButton,
      run: () => {
        deps.onUndo()
        if (hide) deps.setShown(true)
      },
    })
  }

  /** All settings: the popover goes and Convert image opens with this picture, size, match and color count. */
  function allSettings(): void {
    const blob = deps.picture()
    const at = box.value
    const project = deps.currentProject()
    if (!blob || !at || !project?.referenceImage) return
    const request = { picture: blob, name: project.referenceImage.picture.name, box: at, source: source.value, colors: colors.value, hideAfter: hideAfter.value }
    converting.value = false
    deps.openAllSettings(request)
  }

  /** Set Frame around the picture: the Frame round the positions the picture covers (the Frame flow's Add or Replace). */
  function frameAround(): void {
    if (frameBox.value) deps.setFrameAround(frameBox.value)
  }

  // Another Project, or its picture gone or hidden, folds the popover away.
  watch(
    () => [deps.currentProject()?.id, deps.currentProject()?.referenceImage?.shown] as const,
    ([id, shown], [before]) => {
      if (id !== before || !shown) converting.value = false
    },
  )

  /** The words a count of beads takes in the popover. */
  const convertLabel = computed(() => plural(deps.locale(), conversion.value?.changes.length ?? 0, deps.messages().referenceImage.convert.button))
  const replacedLabel = computed(() => (replaced.value > 0 ? plural(deps.locale(), replaced.value, deps.messages().referenceImage.convert.replaces) : undefined))
  const beadName = computed(() => beadLabel(bead.value))
  /** Where the Bead's loaded catalog's colors were read from: its note then says so (tickets 0886, 1068). */
  const measuredFrom = computed(() => (catalog.value?.id === colorCatalogOf(bead.value.id) ? measuredColorSource(catalog.value) : undefined))

  return {
    cover,
    box,
    frameBox,
    size,
    convertOff,
    converting,
    source,
    hasCatalog,
    beadName,
    measuredFrom,
    colors,
    colorsMax,
    hideAfter,
    conversion,
    previewProject,
    replaced,
    convertLabel,
    replacedLabel,
    open,
    close,
    setSource,
    setColors,
    convert,
    addGrid,
    allSettings,
    frameAround,
  }
}

