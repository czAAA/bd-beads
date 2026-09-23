<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import BeadQuantities from './components/BeadQuantities.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import ConvertImageFrame from './components/ConvertImageFrame.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import NewPatternForm from './components/NewPatternForm.vue'
import PatternCanvas from './components/PatternCanvas.vue'
import PatternImport from './components/PatternImport.vue'
import PatternList from './components/PatternList.vue'
import ProgressBar from './components/ProgressBar.vue'
import QrExportPanel from './components/QrExportPanel.vue'
import ShortcutsHelp from './components/ShortcutsHelp.vue'
import Toolbox from './components/Toolbox.vue'
import ZoomControls from './components/ZoomControls.vue'
import { useConvertImage } from './composables/useConvertImage'
import { useElementSize } from './composables/useElementSize'
import { useKeyboardShortcuts, type KeyboardShortcut } from './composables/useKeyboardShortcuts'
import { useMirrorState } from './composables/useMirrorState'
import { usePatternLibrary } from './composables/usePatternLibrary'
import { usePatternZoom } from './composables/usePatternZoom'
import { useQrExport } from './composables/useQrExport'
import { useSelectionGesture } from './composables/useSelectionGesture'
import { useSettledPattern } from './composables/useSettledPattern'
import { useSpaceDragPan } from './composables/useSpaceDragPan'
import { BEAD_CATALOG, beadLabel, findBead } from './domain/beads'
import type { Bead } from './domain/beads'
import type { GridPosition, PreviewCell } from './domain/grid'
import type { ConvertedImage } from './domain/imageConversion'
import {
  canRedo,
  canUndo,
  emptyHistory,
  pushHistory,
  redoStep,
  undoStep,
  type History,
  type HistoryStep,
} from './domain/history'
import { findPaletteColor, PALETTE, PALETTE_SHORTCUTS } from './domain/palette'
import {
  createPattern,
  createPatternFromImage,
  deleteAll,
  fillArea,
  floodErase,
  isInFinishedRow,
  keepFinishedRows,
  mirroredCells,
  moveToRow,
  paintCells,
  patternGeometry,
  patternShape,
  replaceBead,
  resolvePatternBead,
  restoreSnapshot,
  rowProgressPosition,
  setRowProgressEnabled,
  summarizePattern,
  toggleRotated,
  toggleRowDirection,
  type CreatePatternInput,
  type Grid,
  type Pattern,
  type UndoEntry,
} from './domain/pattern'
import { estimatedSizeMm, formatSizeMm } from './domain/patternSize'
import { downloadFile } from './domain/fileDownload'
import { importPatterns, patternFileName, serializePattern } from './domain/patternFile'
import { patternFromShareLink } from './domain/qrExport'
import { removeLineRefusal, removeSelectedLine, resizePattern, type ResizeRequest } from './domain/resize'
import type { Tool } from './domain/tool'
import { provideI18n } from './i18n/useI18n'

const BASE_URL = import.meta.env.BASE_URL

const { t } = provideI18n()

/**
 * The Pattern library, which one is open, and persistence (ticket 55, ADR 0012) — every Pattern change in this file
 * goes through one of these mutators, and nothing here touches storage directly. replacePattern is the single commit
 * point for a change to the open Pattern, and saves it as it lands; a dragged stroke is the one edit that doesn't,
 * asking for its save to be deferred per cell (see paintStrokeCell) and writing once when the stroke ends
 * (see endStroke).
 */
const {
  patterns,
  activePatternId,
  activePattern,
  saveFailed,
  addPattern,
  addPatterns,
  replacePattern,
  removePattern,
  flushPendingSave,
  saveNow,
} = usePatternLibrary()

/**
 * The open Pattern's single Bead, shown in the header (ticket 37): its label when the catalog still has it, or a
 * neutral "unknown bead" placeholder when it doesn't — a custom Bead removed since (ticket 38), or one an imported
 * file names that this device never had.
 */
const activeBeadLabel = computed(() => {
  const pattern = activePattern.value
  if (!pattern) {
    return undefined
  }
  const bead = resolvePatternBead(pattern)
  return bead ? beadLabel(bead) : t.value.patterns.unknownBeadLabel
})

/** The other built-in catalog Beads the open Pattern could switch to (ticket 48) — everything but its current one. */
const replaceBeadCandidates = computed(() => {
  const pattern = activePattern.value
  return pattern ? BEAD_CATALOG.filter((bead) => bead.id !== pattern.beadId) : []
})

/** The Bead behind replaceBeadPendingId, resolved from the catalog — also doubles as "is the Replace bead modal open" (ticket 48), since a pending id always names a real catalog Bead. */
const replaceBeadPendingBead = computed(() => {
  const id = replaceBeadPendingId.value
  return id ? findBead(id) : undefined
})

/**
 * The Replace bead modal's message (ticket 48, ADR 0017): the Pattern's Estimated size with the new Bead next to the
 * one it has now, plus the static reassurance that the design and its bead count stay put and that rows and columns
 * can be adjusted afterwards. The grid itself never changes, so there is no new grid size to show.
 */
const replaceBeadConfirmMessage = computed(() => {
  const pattern = activePattern.value
  const bead = replaceBeadPendingBead.value
  if (!pattern || !bead) {
    return ''
  }

  const unitLabels = { mm: t.value.form.unitMm, cm: t.value.form.unitCm }
  const estimateWith = (candidate: Bead | undefined) =>
    candidate ? formatSizeMm(estimatedSizeMm(pattern, candidate), unitLabels) : '—'

  return t.value.replaceBead.confirmMessage
    .replace('{bead}', () => beadLabel(bead))
    .replace('{new}', () => estimateWith(bead))
    .replace('{old}', () => estimateWith(resolvePatternBead(pattern)))
})

/**
 * QR export (ticket 68, 116): the Toolbox's Edit group opens the panel and this file shows it, so its state lives
 * here rather than in either. The code reads every bead of the Pattern, so it waits for a stroke to end (see
 * useSettledPattern) rather than being worked out on each step of it.
 */
const qrExport = useQrExport(() => shareablePattern.value)

/** How long Save's "Saved" confirmation stays up (ticket 115): long enough to read, short enough to be gone before the next edit. */
const SAVED_CONFIRMATION_MS = 2000

/** Whether the "Saved" confirmation is showing. Only ever raised by a write that landed; a refused one raises saveFailed instead. */
const saved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | undefined

function clearSavedConfirmation() {
  clearTimeout(savedTimer)
  saved.value = false
}

/**
 * Save (ticket 115): edits already reach this device as they land (ADR 0012), so the write to this device is
 * reassurance rather than a new kind of storage — it writes whatever is pending now and says so. "Saved" is only
 * claimed once the write got through; if the device refuses it the library's own "couldn't save" notice shows instead
 * (saveFailed). A second press starts the confirmation's clock over.
 *
 * Save also hands over the open Pattern as a Pattern file (ticket 119), so it can be opened on another device. The
 * file goes out even when the device refuses the write: it is then the only copy that survives.
 */
function onSave() {
  clearSavedConfirmation()
  if (!activePattern.value) {
    return
  }

  const saveSucceeded = saveNow()
  downloadFile(patternFileName(activePattern.value), serializePattern(activePattern.value))
  if (!saveSucceeded) {
    return
  }

  saved.value = true
  savedTimer = setTimeout(clearSavedConfirmation, SAVED_CONFIRMATION_MS)
}

/** The canvas area's own element, measured live (ticket 27) so the Pattern's fit zoom tracks the real available space instead of a guessed constant. */
const canvasAreaEl = ref<HTMLElement | null>(null)
const { width: canvasAreaWidth } = useElementSize(canvasAreaEl)

const { zoom, zoomIn, zoomOut, resetZoom } = usePatternZoom(
  () => activePattern.value,
  canvasAreaWidth,
)

/** The floating zoom cluster's own readout (ticket 57 moved the cluster here, off PatternCanvas): derived from the same zoom the grid scales by, rather than threaded down as a second prop — it's a pure Math.round(zoom * 100) either way (see usePatternZoom.ts). */
const zoomPercent = computed(() => Math.round(zoom.value * 100))

/** Where Progress bar goes (ticket 124, ADR 0005's 2026-09-22 amendment): undefined with no Pattern open, since there's then nothing to shape. */
const progressBarShape = computed(() => (activePattern.value ? patternShape(activePattern.value) : undefined))

/** Whether Progress bar renders at all: a Pattern has to be open, not taken over by framing, with Row progress itself switched on (CONTEXT.md's Progress bar: "reserves no space and renders nothing" otherwise). Shared by both orientation's `v-if` below so the two never drift apart on this. */
const progressBarVisible = computed(
  () => !!activePattern.value && !framing.value && activePattern.value.rowProgress.enabled,
)

/**
 * Convert image's framing step (ticket 58, ADR 0010): the picture being framed and how it sits under the frame. Its
 * own state, deliberately independent of which Pattern is open — conversion creates a Pattern rather than converting
 * into one, so nothing here goes through replacePattern, the undo stack, Mirror or the Row progress lock, and entering
 * framing with a Pattern already open simply takes the canvas panel over until Cancel gives it back.
 */
const {
  image: convertImageSource,
  zoom: convertZoom,
  pan: convertPan,
  maxColors: convertMaxColors,
  zoomPercent: convertZoomPercent,
  start: startConvertImage,
  cancel: cancelConvertImage,
  zoomIn: convertZoomIn,
  zoomOut: convertZoomOut,
  resetZoom: convertResetZoom,
  setPan: setConvertPan,
  setMaxColors: setConvertMaxColors,
} = useConvertImage()

/**
 * The last New Pattern form state that named a real size. The frame follows the form's fields as they're edited during
 * framing, and this is what a Create reads — holding the last *valid* state rather than the live one is what keeps the
 * frame put while a width field is momentarily empty mid-retype, instead of collapsing it to a single cell.
 */
const newPatternDraft = ref<CreatePatternInput | undefined>()

function onNewPatternDraft(draft: CreatePatternInput) {
  const { width, height, unit } = draft.size
  const geometry = patternGeometry(draft)
  const wholeBeads = unit !== 'beads' || (Number.isInteger(width) && Number.isInteger(height))

  // A size the form would refuse (not whole beads) is no more a frame to follow than an empty field is.
  if (width > 0 && height > 0 && wholeBeads && geometry) {
    newPatternDraft.value = draft
  }
}

/**
 * Everything the framing step needs, or undefined when it isn't running: the picture, and the frame the form's current
 * values imply — the Bead, the Technique and the grid size, read through the same patternGeometry the Pattern itself
 * will be created from, so the frame can't disagree with what Create makes.
 *
 * One value gates all three pieces of framing UI (the form staying up, the canvas panel, the zoom cluster), so they
 * can never disagree about whether framing is on — a canvas showing a frame with no Cancel button, say.
 */
const framing = computed(() => {
  const image = convertImageSource.value
  const draft = newPatternDraft.value
  const geometry = draft && patternGeometry(draft)

  return image && draft && geometry
    ? {
        image,
        draft,
        technique: draft.technique,
        bead: geometry.bead,
        dimensions: { columns: geometry.columns, rows: geometry.rows },
      }
    : undefined
})

/** Red is the Palette's first swatch and its default: a Pattern almost always opens ready to paint, not on a dead click-a-color-first step. */
const DEFAULT_PALETTE_COLOR_ID = 'red'

const selectedColorId = ref<string | undefined>(DEFAULT_PALETTE_COLOR_ID)
/**
 * The last Custom color chosen (CONTEXT.md's Custom color): a one-off hex outside the Palette. Kept on its Toolbox
 * slot for the rest of the session even once a Palette swatch deselects it — replaced only by a new Custom color,
 * gone on reload since it's never persisted. It's the paint color exactly when selectedColorId is unset; the two are
 * kept mutually exclusive by onSelectColor/onSelectCustomColor below, the same way PalettePicker's own selection is
 * a single id rather than a parallel flag per swatch.
 */
const customColor = ref<string | undefined>(undefined)
/**
 * The Image color being painted with (CONTEXT.md's Image colors, ticket 58): one of the open Pattern's own converted
 * colors, offered in the Colors group alongside the Palette. The third of three mutually exclusive paint colors — a
 * Palette swatch, an Image color, or the Custom color — kept exclusive by the onSelect* handlers below, and reset on a
 * Pattern switch since a hex from one Pattern's conversion means nothing in another.
 */
const selectedImageColor = ref<string | undefined>(undefined)
const activeTool = ref<Tool>('paint')

/**
 * Mirror's own session state (ticket 62): axis counts, copy mode, hover state, both preview computations, and
 * "Mirror current" itself, all behind one small interface -- see composables/useMirrorState.ts. Destructured under
 * their original names (rather than kept as one `mirror` object) so refs and computeds stay top-level setup
 * bindings, which is what lets the template auto-unwrap them -- the same convention usePatternZoom's zoom/zoomIn/
 * etc. already follow below. commitGridChange is a hoisted function declaration further down this file, so passing
 * it here (before its own definition) is safe: by the time useMirrorState calls it, the module has finished
 * initializing.
 */
const {
  axisCounts: mirrorAxisCounts,
  copyMode: mirrorCopyMode,
  previewedAxisCounts: previewedMirrorAxisCounts,
  currentDimmedCells: mirrorCurrentDimmedCells,
  onHoverCurrent: onMirrorCurrentHover,
  setAxisCount: onSetMirrorAxisCount,
  toggleCopyMode: onToggleMirrorCopyMode,
  mirrorCurrent: onMirrorCurrent,
  restoreAxisCounts: restoreMirrorAxisCounts,
  clearAxisCounts: clearMirrorAxisCounts,
  reset: resetMirrorState,
} = useMirrorState(() => activePattern.value, commitGridChange)

/** Undo/redo stacks of snapshots (see domain/history.ts); reset whenever the open Pattern changes since it's an editing-session aid, not part of the saved Pattern. Each entry carries a grid, plus whatever else the command also changed: Row progress (Delete all, ticket 42, and Resize), the Bead (Replace Bead, ticket 48) and the grid size with Mirror's axis counts (Resize, ADR 0017) — see UndoEntry. */
const history = ref<History<UndoEntry>>(emptyHistory())

/** Whether the Delete all confirmation modal (ticket 42) is open. The global Escape handler (onKeyDown) defers to the modal's own while this is true, rather than also backing out of Select. */
const deleteAllConfirmOpen = ref(false)

/** The Bead id picked from the Replace bead select, awaiting confirmation (ticket 48); undefined when its modal is closed. */
const replaceBeadPendingId = ref<string | undefined>()

/**
 * The Select tool's whole gesture (ticket 63): the Selection, the in-session clipboard, the in-progress press and the
 * Select-tool paste preview, behind one small interface -- see composables/useSelectionGesture.ts. Destructured under
 * the names this file already used, for the same reason as Mirror above. Mirror's axis counts and copy mode come from
 * useMirrorState's own refs, passed as accessors so this module never needs to know that one exists. Only ever called
 * into while Select is the active tool (or from a command that isn't tied to a tool, like Copy or a ruler click):
 * the module itself never reads activeTool.
 */
const {
  selection,
  beginPress: beginSelectPress,
  extendPress: extendSelection,
  endPress: endSelectPress,
  cancel: backOutOfSelect,
  leaveSelectTool,
  copy: onCopy,
  pasteAt: pasteAtCell,
  deleteSelection: onDeleteSelection,
  selectLine: onSelectLine,
  pastePreviewCells,
  clearSelection: resetSelection,
} = useSelectionGesture(
  () => activePattern.value,
  commitGridChange,
  () => mirrorAxisCounts.value,
  () => mirrorCopyMode.value,
)

/** The cell the cursor is over, for the hover paint preview (ticket 23); cleared when the cursor leaves the canvas. */
const hoveredCell = ref<GridPosition | undefined>()

/** For onKeyDown's Escape precedence: asks every Tool group to collapse before backing out of Select (ticket 41). */
const toolboxRef = ref<InstanceType<typeof Toolbox> | null>(null)

/** Whether the `?` shortcuts help overlay (ticket 96) is open. */
const shortcutsHelpOpen = ref(false)

/**
 * The canvas panel's own horizontal scroller (ticket 95) -- what Space+drag panning scrolls sideways; vertical
 * panning scrolls the window instead, since nothing in this shell traps vertical overflow of its own (see
 * .app-shell__canvas's own comment below).
 */
const canvasScrollEl = ref<HTMLElement | null>(null)
const { spaceHeld, panning: spacePanning } = useSpaceDragPan(canvasScrollEl)

watch(activePatternId, () => {
  history.value = emptyHistory()
  // Selection resets here through the module's reset(); the clipboard deliberately survives a Pattern switch
  // (ticket 92, ADR 0016), unlike Undo/Redo history and Selection.
  resetSelection()
  // Mirror's session state is an editing-session setting, reset on a Pattern switch (ticket 44/45 decision) --
  // through this single reset point, per the ticket 62 decision, rather than a watcher of its own.
  resetMirrorState()
  deleteAllConfirmOpen.value = false
  replaceBeadPendingId.value = undefined
  qrExport.close()
  clearSavedConfirmation()
  // An Image color belongs to the Pattern that was converted, so it can't stay selected across a switch; the Palette's
  // own default steps back in, rather than leaving the editor with no paint color at all.
  if (selectedImageColor.value) {
    selectedImageColor.value = undefined
    selectedColorId.value = DEFAULT_PALETTE_COLOR_ID
  }
})

/**
 * What the hover preview shows: the block Paste would stamp under the cursor (ticket 31), or the cell Paint/Fill would
 * touch plus its live-mirror counterpart(s) (tickets 22/23). Beads in rows already woven are left out, since nothing
 * lands on them (ticket 33).
 */
const previewCells = computed<PreviewCell[]>(() => {
  const pattern = activePattern.value
  if (!pattern || !hoveredCell.value) {
    return []
  }
  return cellsUnderCursor(pattern, hoveredCell.value).filter((cell) => !isInFinishedRow(pattern, cell))
})

function cellsUnderCursor(pattern: Pattern, hovered: GridPosition): PreviewCell[] {
  if (activeTool.value === 'select') {
    return pastePreviewCells(pattern, hovered)
  }
  if (activeTool.value !== 'paint') {
    // Fill is unaffected by mirror state (ticket 22), so its preview only ever shows the hovered cell itself.
    return [hovered]
  }
  return mirroredCells(pattern, hovered, mirrorAxisCounts.value, mirrorCopyMode.value)
}

/** The current paint color's hex: the selected Palette color, the selected Image color, or the Custom color — whichever of the three is active; null when none is. */
function selectedColorHex(): string | null {
  if (selectedColorId.value) {
    return findPaletteColor(selectedColorId.value)?.hex ?? null
  }
  return selectedImageColor.value ?? customColor.value ?? null
}

/** The color the hover preview shows; null (a neutral outline, not a color) when nothing is selected. */
const previewColor = computed(() => selectedColorHex())

function onCellHover(row: number, column: number) {
  hoveredCell.value = { row, column }
}

function onHoverEnd() {
  hoveredCell.value = undefined
}

function onCreatePattern(payload: CreatePatternInput) {
  addPattern(createPattern(payload))
}

/**
 * Creates the Pattern the frame was holding (ticket 58): an ordinary new Pattern that arrives painted, carrying the
 * conversion's Image colors (ADR 0011). The grid comes from the framing preview itself, so what was inside the frame
 * is literally what is created — see ConvertImageFrame.vue. Cancel, by contrast, creates nothing and keeps nothing
 * (ticket 58 decision), so it goes straight to the composable.
 */
function onConvertImageCreate(converted: ConvertedImage) {
  const draft = framing.value?.draft
  if (!draft) {
    return
  }

  addPattern(createPatternFromImage({ ...draft, grid: converted.grid, imageColors: converted.imageColors }))
  cancelConvertImage()
}

function onSelectPattern(id: string) {
  activePatternId.value = id
}

function onNewPattern() {
  activePatternId.value = undefined
}

/** Choosing a Palette swatch deselects Custom color and any Image color (CONTEXT.md); the Custom slot keeps showing its last hex, just unselected. */
function onSelectColor(colorId: string) {
  selectedColorId.value = colorId
  selectedImageColor.value = undefined
}

/** Choosing a Custom color makes it the paint color and deselects whichever Palette swatch or Image color was active, vice versa. */
function onSelectCustomColor(hex: string) {
  customColor.value = hex
  selectedColorId.value = undefined
  selectedImageColor.value = undefined
}

/** Choosing one of the open Pattern's Image colors (ticket 58) paints with it, the same way a Palette swatch does; the Custom slot keeps its own last hex, unselected. */
function onSelectImageColor(hex: string) {
  selectedImageColor.value = hex
  selectedColorId.value = undefined
}

function onSelectTool(tool: Tool) {
  /*
   * Leaving Select forgets what it was holding. The marquee is noise once you're painting rather than selecting,
   * and a clipboard that outlived its marquee would be invisible state: coming back to Select and clicking would
   * stamp a block out of nowhere. Re-choosing Select while it's already active leaves both alone.
   */
  if (tool !== 'select') {
    leaveSelectTool()
  }

  activeTool.value = tool
}

/**
 * Commits the result of a grid-changing command (fill/mirror/paste) as one undo step, minus anything it did to rows
 * already woven (ticket 33), unless that leaves the Pattern unchanged.
 */
function commitGridChange(pattern: Pattern, updated: Pattern) {
  const kept = keepFinishedRows(pattern, updated)
  if (kept === pattern) {
    return
  }

  history.value = pushHistory(history.value, { grid: pattern.grid })
  replacePattern(kept)
}

/**
 * A Paint-tool drag (ticket 24): 'paint'/'erase' while a stroke is in progress, else null. The grid this started
 * from is captured once, in strokeBaseline, and pushed to the undo stack as a single step when the stroke ends
 * (see endStroke) — every cell touched in between just updates the live Pattern directly.
 */
const strokeMode = ref<'paint' | 'erase' | null>(null)

/** The open Pattern for what only summarises it: it follows a stroke a few times a second, and is exact when the stroke ends. */
const settledPattern = useSettledPattern(
  () => activePattern.value,
  () => strokeMode.value !== null,
)

/** The open Pattern for the code that shares it, which nobody watches change: it waits for the stroke to end. */
const shareablePattern = useSettledPattern(
  () => activePattern.value,
  () => strokeMode.value !== null,
  Number.POSITIVE_INFINITY,
)
const strokeBaseline = ref<Grid | null>(null)

function beginStroke(mode: 'paint' | 'erase', pattern: Pattern) {
  strokeMode.value = mode
  strokeBaseline.value = pattern.grid
}

/**
 * Ends an in-progress stroke or Select press, bound to mouseup/pointerup on the whole app shell (ticket 24): a
 * drag can end with the button/finger/pen released anywhere, not just back over the cell it started on. Also bound
 * to pointercancel (ticket 60) so a touch/pen stroke the OS interrupts mid-drag doesn't leave strokeMode stuck.
 */
function endStroke() {
  endSelectPress()

  const pattern = activePattern.value
  if (strokeBaseline.value && pattern && pattern.grid !== strokeBaseline.value) {
    history.value = pushHistory(history.value, { grid: strokeBaseline.value })
  }
  strokeMode.value = null
  strokeBaseline.value = null

  // The stroke's one write: every cell it painted deferred its save (see paintStrokeCell), so the whole stroke
  // reaches storage here, once. A no-op when the mouseup wasn't ending a stroke at all.
  flushPendingSave()
}

/**
 * Paints (or, with a null color, erases) one cell of an in-progress stroke, live-mirrored per mirrorAxisCounts,
 * leaving rows already woven alone (ticket 33).
 *
 * This is the one caller that defers its save (ticket 55): a stroke can touch hundreds of cells in a second, and
 * saving each one wrote the whole Pattern library per mousemove. The cell lands in the library immediately — it's on
 * screen and undoable either way — and endStroke turns the whole stroke into a single write.
 */
function paintStrokeCell(row: number, column: number, color: string | null) {
  // Worked on as the Pattern itself, not through the library's reactive wrapper: a stroke step reads a bead or two, but
  // comparing what it left for finished rows reads them all, and each read through a proxy is many times the cost.
  const pattern = activePattern.value && toRaw(activePattern.value)
  if (!pattern) {
    return
  }

  const painted = paintCells(pattern, [{ row, column }], color, mirrorAxisCounts.value, mirrorCopyMode.value)

  const updated = keepFinishedRows(pattern, painted)
  if (updated !== pattern) {
    replacePattern(updated, { deferSave: true })
  }
}

/** Fill acts immediately, in one click, on either button (ticket 25); Paint starts a stroke, live-mirrored per cell. */
function beginOrCommitPress(mode: 'paint' | 'erase', color: string | null, row: number, column: number) {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  if (activeTool.value === 'fill') {
    commitGridChange(pattern, fillArea(pattern, row, column, color))
    return
  }

  beginStroke(mode, pattern)
  paintStrokeCell(row, column, color)
}

function isUndoShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
}

/** Ctrl/Cmd+Shift+Z, the mirror of the undo chord, or Ctrl+Y, the older Windows convention. */
function isRedoShortcut(event: KeyboardEvent): boolean {
  const shiftZ = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'z'
  const ctrlY = event.ctrlKey && event.key.toLowerCase() === 'y'
  return shiftZ || ctrlY
}

/** A plain, unmodified key press: guards the new single-letter/digit shortcuts (tickets 87/91/93/94) against colliding with an OS/browser chord that happens to share the same key. */
function isPlainKey(event: KeyboardEvent): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey
}

/** `event.key` is exactly `key` (case-insensitively), with no modifier held at all -- the shape every plain-letter/digit shortcut below (1/2/3, R, M, H, V, P, D) shares, so each just names its own key instead of repeating the guard. */
function isPlainLetterKey(event: KeyboardEvent, key: string): boolean {
  return event.key.toLowerCase() === key.toLowerCase() && isPlainKey(event) && !event.shiftKey
}

/** Withholds a shortcut while the Delete all or Replace bead confirmation, the QR panel or the shortcuts help overlay is open — same precedence Escape already gives those modals (see the Escape entry below). */
function noModalOpen(): boolean {
  return (
    !deleteAllConfirmOpen.value && !replaceBeadPendingBead.value && !qrExport.panelOpen.value && !shortcutsHelpOpen.value
  )
}

/**
 * Ticket 94: Enter/Shift+Enter move the Row progress pointer, except when a Toolbox or Progress bar button has
 * focus — otherwise Tab+Enter would both click that button and move the row. Progress bar (ticket 124) moved
 * Previous/Next onto the canvas, outside the Toolbox, so this checks both containers.
 */
function isFocusedOnToolboxButton(event: KeyboardEvent): boolean {
  const target = event.target
  return (
    target instanceof HTMLElement &&
    target.tagName === 'BUTTON' &&
    target.closest('[data-testid="toolbox"], [data-testid="progress-bar"]') !== null
  )
}

/** Which grid-space axis the on-screen Left–right Mirror counter drives right now (ticket 93) -- same rotation-aware mapping Toolbox.vue's leftRightAxis uses, since rotating the Pattern swaps the two. Undefined with no Pattern open. */
function leftRightAxis(): 'columns' | 'rows' | undefined {
  const pattern = activePattern.value
  return pattern ? (pattern.rotated ? 'rows' : 'columns') : undefined
}

/** The Top–bottom counter's grid-space axis (ticket 93) -- the other of the two leftRightAxis doesn't pick. */
function topBottomAxis(): 'columns' | 'rows' | undefined {
  const pattern = activePattern.value
  return pattern ? (pattern.rotated ? 'columns' : 'rows') : undefined
}

/** -/=/[/] (ticket 93): steps one Mirror axis count by delta, clamped exactly as the +/- buttons are (mirror.setAxisCount already clamps). */
function adjustMirrorAxisCount(axis: 'columns' | 'rows' | undefined, delta: number) {
  if (!axis) {
    return
  }
  onSetMirrorAxisCount(axis, mirrorAxisCounts.value[axis] + delta)
}

/**
 * The table (ticket 86) driving useKeyboardShortcuts below: Undo, Redo and Escape from ticket 86 itself, plus every
 * Toolbox shortcut tickets 87-96 added, grouped the same way the Toolbox's own Tool groups are, without touching
 * the dispatcher itself.
 */
const keyboardShortcuts: KeyboardShortcut[] = [
  {
    /*
     * Escape reaches backOutOfSelect from anywhere, since the canvas takes no keyboard focus of its own and the
     * cursor may have left it (ticket 24). While the Delete all or Replace bead confirmation modal, or the
     * shortcuts help overlay, is open, its own Escape handling owns the key instead — withheld here so Escape can't
     * also unexpectedly drop a copied block or collapse a Tool group behind it.
     */
    matches: (event) => event.key === 'Escape',
    guard: noModalOpen,
    allowWhileTyping: true,
    action: () => {
      /*
       * ticket 41: an expanded Tool group takes precedence — the first Escape only collapses it, and backOutOfSelect
       * (cancel Paste, then clear Selection) only runs once none is expanded, exactly as if that Escape never happened.
       */
      if (toolboxRef.value?.collapseExpandedGroup()) {
        return
      }
      backOutOfSelect()
    },
  },
  {
    matches: isRedoShortcut,
    action: (event) => {
      event.preventDefault()
      onRedo()
    },
  },
  {
    matches: isUndoShortcut,
    action: (event) => {
      event.preventDefault()
      onUndo()
    },
  },
  // Tools group (ticket 87): 1/2/3 select Paint/Fill/Select, the same as clicking that button.
  {
    matches: (event) => isPlainLetterKey(event, '1'),
    guard: noModalOpen,
    action: () => onSelectTool('paint'),
  },
  {
    matches: (event) => isPlainLetterKey(event, '2'),
    guard: noModalOpen,
    action: () => onSelectTool('fill'),
  },
  {
    matches: (event) => isPlainLetterKey(event, '3'),
    guard: noModalOpen,
    action: () => onSelectTool('select'),
  },
  // ticket 90: Del clears just the selected cells under Select with a Selection present, else activates Erase.
  {
    matches: (event) => event.key === 'Delete',
    guard: noModalOpen,
    action: () => {
      if (activeTool.value === 'select' && selection.value) {
        onDeleteSelection()
      } else {
        onSelectTool('erase')
      }
    },
  },
  // Colors group (ticket 88): Shift+1..9, Shift+0, Q, W paint with the corresponding Palette swatch, in order.
  {
    matches: (event) => event.shiftKey && isPlainKey(event) && PALETTE_SHORTCUTS.some((s) => s.code === event.code),
    guard: noModalOpen,
    action: (event) => {
      const index = PALETTE_SHORTCUTS.findIndex((s) => s.code === event.code)
      const color = PALETTE[index]
      if (color) {
        onSelectColor(color.id)
      }
    },
  },
  // Edit group (ticket 91): R toggles Rotate, Ctrl/Cmd+C copies the active Selection.
  {
    matches: (event) => isPlainLetterKey(event, 'r'),
    guard: noModalOpen,
    action: () => onToggleRotate(),
  },
  {
    matches: (event) => (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'c',
    guard: noModalOpen,
    action: (event) => {
      event.preventDefault()
      onCopy()
    },
  },
  // ticket 92: Ctrl/Cmd+V pastes at the cell under the pointer, regardless of the active tool.
  {
    matches: (event) => (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'v',
    guard: noModalOpen,
    action: pasteAtPointer,
  },
  // ticket 115: Ctrl/Cmd+S saves. Claimed from the browser only while a Pattern is open to save — with none, the browser's own dialog is left alone rather than swallowed for nothing.
  {
    matches: (event) => (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's',
    guard: () => noModalOpen() && !!activePattern.value,
    allowWhileTyping: true,
    action: (event) => {
      event.preventDefault()
      onSave()
    },
  },
  // Mirror group (ticket 93): -/= step Left-right, [/] step Top-bottom, M toggles copy mode, H/V trigger Mirror current.
  {
    matches: (event) => event.key === '-' && isPlainKey(event),
    guard: noModalOpen,
    action: () => adjustMirrorAxisCount(leftRightAxis(), -1),
  },
  {
    matches: (event) => event.key === '=' && isPlainKey(event),
    guard: noModalOpen,
    action: () => adjustMirrorAxisCount(leftRightAxis(), 1),
  },
  {
    matches: (event) => event.key === '[' && isPlainKey(event),
    guard: noModalOpen,
    action: () => adjustMirrorAxisCount(topBottomAxis(), -1),
  },
  {
    matches: (event) => event.key === ']' && isPlainKey(event),
    guard: noModalOpen,
    action: () => adjustMirrorAxisCount(topBottomAxis(), 1),
  },
  {
    matches: (event) => isPlainLetterKey(event, 'm'),
    guard: noModalOpen,
    action: () => onToggleMirrorCopyMode(),
  },
  {
    matches: (event) => isPlainLetterKey(event, 'h'),
    guard: noModalOpen,
    action: () => onMirrorCurrent('horizontal'),
  },
  {
    matches: (event) => isPlainLetterKey(event, 'v'),
    guard: noModalOpen,
    action: () => onMirrorCurrent('vertical'),
  },
  // Row progress group (ticket 94): P toggles it on/off, D toggles direction, Enter/Shift+Enter move the pointer.
  {
    matches: (event) => isPlainLetterKey(event, 'p'),
    guard: noModalOpen,
    action: () => {
      const pattern = activePattern.value
      if (pattern) {
        onToggleRowProgress(!pattern.rowProgress.enabled)
      }
    },
  },
  {
    matches: (event) => isPlainLetterKey(event, 'd'),
    guard: noModalOpen,
    action: () => onToggleRowDirection(),
  },
  {
    matches: (event) => event.key === 'Enter' && !event.shiftKey && !isFocusedOnToolboxButton(event),
    guard: noModalOpen,
    action: () => {
      if (activePattern.value?.rowProgress.enabled) {
        onMoveRow(1)
      }
    },
  },
  {
    matches: (event) => event.key === 'Enter' && event.shiftKey && !isFocusedOnToolboxButton(event),
    guard: noModalOpen,
    action: () => {
      if (activePattern.value?.rowProgress.enabled) {
        onMoveRow(-1)
      }
    },
  },
  // ticket 96: ? opens the shortcuts help overlay.
  {
    matches: (event) => event.key === '?',
    guard: noModalOpen,
    action: () => {
      shortcutsHelpOpen.value = true
    },
  },
]

useKeyboardShortcuts(keyboardShortcuts)

/**
 * The safety net for a stroke's deferred save (ticket 55): endStroke normally writes it, on the mouseup the app shell
 * hears, but a button released outside the document — dragging off the window edge to paint the last column — fires
 * no mouseup anywhere on the page, leaving that stroke in memory only. Any later edit would carry it (a save writes
 * the whole library), so the one thing that could actually lose it is leaving the page first; pagehide is where that
 * is caught. A no-op whenever storage is already up to date.
 */
function onPageHide() {
  flushPendingSave()
}

/**
 * Opens the Pattern a scanned QR export's link carries (ticket 68, ADR 0015). It lands as its own Pattern — under a
 * fresh id if this device already has that one, like any import — and opens even when another is open, since scanning
 * a code is the request to look at it. The fragment is then dropped, so a refresh or a bookmark doesn't import it a
 * second time.
 */
function openSharedPatternFromUrl(): void {
  if (!window.location.hash.startsWith('#pattern=')) {
    return
  }
  try {
    const shared = patternFromShareLink(window.location.hash)
    if (shared) {
      const [added] = importPatterns([shared], patterns.value)
      addPattern(added!)
    }
  } catch {
    // A link that can't be read is left as an ordinary page load: the library opens as it was.
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

onMounted(() => {
  openSharedPatternFromUrl()
  window.addEventListener('pagehide', onPageHide)
})
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', onPageHide)
  clearTimeout(savedTimer)
  flushPendingSave()
})

/**
 * Ctrl/Cmd+V (ticket 92): pastes at the cell under the pointer, regardless of the active tool -- driven by hoveredCell
 * rather than the Select-only click gesture. Claims the chord from the browser only when something was pasted, so a
 * no-op (nothing copied, pointer off the grid -- see onHoverEnd) leaves the browser's own handling alone.
 */
function pasteAtPointer(event: KeyboardEvent) {
  if (pasteAtCell(hoveredCell.value)) {
    event.preventDefault()
  }
}

/** The Erase tool (ticket 89): flood-erases the clicked cell's connected same-color region, and each of its live-mirror counterparts' own regions too, as one undo step (see floodErase). */
function onEraseCell(row: number, column: number) {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  const positions = mirroredCells(pattern, { row, column }, mirrorAxisCounts.value, mirrorCopyMode.value)
  commitGridChange(pattern, floodErase(pattern, positions))
}

function onCellPrimaryDown(row: number, column: number) {
  if (spaceHeld.value) {
    // Space+drag pans the canvas (ticket 95): never a paint/fill/erase/select, regardless of the active tool.
    return
  }

  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  if (activeTool.value === 'select') {
    beginSelectPress(row, column)
    return
  }

  if (activeTool.value === 'erase') {
    onEraseCell(row, column)
    return
  }

  const color = selectedColorHex()
  if (!color) {
    return
  }

  beginOrCommitPress('paint', color, row, column)
}

function onCellPrimaryMove(row: number, column: number) {
  if (spaceHeld.value) {
    return
  }

  if (activeTool.value === 'select') {
    extendSelection(row, column)
    return
  }

  if (strokeMode.value !== 'paint') {
    return
  }

  const color = selectedColorHex()
  if (!color) {
    return
  }

  paintStrokeCell(row, column, color)
}

/** Right-click erase, mapped to the active tool (ticket 25): flood-erase in one click under Fill, single-cell/dragged-line erase under Paint and Erase. */
function onCellSecondaryDown(row: number, column: number) {
  if (spaceHeld.value) {
    return
  }

  // Select never erases; under it the right button backs out of a pending Paste or the Selection, alongside Escape.
  if (activeTool.value === 'select') {
    backOutOfSelect()
    return
  }

  beginOrCommitPress('erase', null, row, column)
}

function onCellSecondaryMove(row: number, column: number) {
  if (spaceHeld.value) {
    return
  }

  if (strokeMode.value !== 'erase') {
    return
  }

  paintStrokeCell(row, column, null)
}

/**
 * Everything Undo/Redo can step through right now, fully populated (ticket 48): the grid, Row progress, the Bead, and
 * the grid size with Mirror's axis counts. Every other command's own pushHistory call only carries what it actually
 * changed (see e.g. commitGridChange, onConfirmDeleteAll), but the snapshot recorded here — of the *current* state, as
 * the opposite stack's new top — has to be complete so a later Redo/Undo through it round-trips exactly, even for
 * fields this particular step left untouched.
 */
function currentUndoEntry(pattern: Pattern): UndoEntry {
  return {
    grid: pattern.grid,
    rowProgress: pattern.rowProgress,
    beadId: pattern.beadId,
    size: {
      columns: pattern.columns,
      rows: pattern.rows,
      mirrorAxisCounts: mirrorAxisCounts.value,
    },
  }
}

/**
 * Applies one Undo/Redo step, shared by both directions: the grid/Row progress/Bead/size the snapshot carries (via
 * restoreSnapshot), plus what isn't a Pattern field and so can't ride along in it — Mirror's axis counts, and clearing
 * a Selection (or hover) that no longer fits when the step changed the grid's size.
 */
function applyHistoryStep(pattern: Pattern, step: HistoryStep<UndoEntry>) {
  history.value = step.history
  replacePattern(restoreSnapshot(pattern, step.snapshot))

  const { size } = step.snapshot
  if (size) {
    restoreMirrorAxisCounts(size.mirrorAxisCounts)
    if (size.columns !== pattern.columns || size.rows !== pattern.rows) {
      resetSelection()
      hoveredCell.value = undefined
    }
  }
}

function onUndo() {
  const pattern = activePattern.value
  const step = pattern && undoStep(history.value, currentUndoEntry(pattern))
  if (!step) {
    return
  }

  applyHistoryStep(pattern, step)
}

/** Re-applies whatever Undo most recently stepped back from (ticket 34); like Undo, replays history rather than drawing, so it's not blocked by the Row progress lock. */
function onRedo() {
  const pattern = activePattern.value
  const step = pattern && redoStep(history.value, currentUndoEntry(pattern))
  if (!step) {
    return
  }

  applyHistoryStep(pattern, step)
}

/** Opens the Delete all confirmation modal (ticket 42); does nothing with no Pattern open. */
function onRequestDeleteAll() {
  if (activePattern.value) {
    deleteAllConfirmOpen.value = true
  }
}

function onCancelDeleteAll() {
  deleteAllConfirmOpen.value = false
}

/**
 * Confirms Delete all (ticket 42): resets the grid and Row progress together as a single undo step. Applied
 * directly rather than through commitGridChange/keepFinishedRows, since Delete all ignores the Row progress lock
 * on purpose — clearing progress is the point.
 */
function onConfirmDeleteAll() {
  deleteAllConfirmOpen.value = false

  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  const updated = deleteAll(pattern)
  if (updated === pattern) {
    return
  }

  history.value = pushHistory(history.value, { grid: pattern.grid, rowProgress: pattern.rowProgress })
  replacePattern(updated)
}

/**
 * Reads the pick off the Replace bead select and puts the select back on its placeholder straight away (ticket 113):
 * its bound value is a constant '', which Vue never re-applies, so left alone the select would keep showing the picked
 * Bead — after a Cancel that reads as though the declined Bead were the current one, and picking it again would not
 * fire a change.
 */
function onPickReplaceBead(select: HTMLSelectElement) {
  const beadId = select.value
  select.value = ''
  onRequestReplaceBead(beadId)
}

/** Opens the Replace bead confirmation modal (ticket 48) for the picked Bead id; does nothing with no Pattern open or an empty pick (the select's placeholder option). */
function onRequestReplaceBead(beadId: string) {
  if (beadId && activePattern.value) {
    replaceBeadPendingId.value = beadId
  }
}

function onCancelReplaceBead() {
  replaceBeadPendingId.value = undefined
}

/**
 * Confirms Replace Bead (ticket 48, ADR 0017): swaps the Bead and nothing else, as a single undo step. The grid, Row
 * progress and Mirror all stay as they are, since the grid — the Pattern's size — is untouched; only its Estimated size
 * changes. Applied directly rather than through commitGridChange/keepFinishedRows: it doesn't draw, so the Row progress
 * lock has nothing to guard.
 */
function onConfirmReplaceBead() {
  const pattern = activePattern.value
  const bead = replaceBeadPendingBead.value
  replaceBeadPendingId.value = undefined
  if (!pattern || !bead) {
    return
  }

  history.value = pushHistory(history.value, { grid: pattern.grid, beadId: pattern.beadId })
  replacePattern(replaceBead(pattern, bead))
}

/**
 * Commits a command that changed the grid's own dimensions (Resize, or "remove selected row/column", ticket 123) as
 * one undo step carrying the grid, the dimensions and Row progress's pointers (which may have been clamped)
 * together. Neither is drawing, so neither goes through keepFinishedRows — both are instead refused outright while
 * Row progress is on (see resizeRefusal/removeLineRefusal). A no-op `updated` (refused, or changing nothing) is not
 * an undo step.
 *
 * A change to the grid's dimensions invalidates the editing-session state built against the old ones: the Selection
 * (which may now reach past the grid, or no longer name a whole line) and Mirror's axis counts (clamped to the old
 * size) are cleared, the same as Mirror's own docs say a Resize does. The clipboard survives, since a copied block is
 * colors, not a place.
 */
function commitSizeChange(pattern: Pattern, updated: Pattern) {
  if (updated === pattern) {
    return
  }

  history.value = pushHistory(history.value, {
    grid: pattern.grid,
    rowProgress: pattern.rowProgress,
    size: { columns: pattern.columns, rows: pattern.rows, mirrorAxisCounts: mirrorAxisCounts.value },
  })
  replacePattern(updated)
  clearMirrorAxisCounts()
  resetSelection()
  hoveredCell.value = undefined
}

/** Resize (CONTEXT.md, ADR 0017) from the Size group: adds or removes rows and columns from either end (see commitSizeChange for what landing one does). */
function onResize(request: ResizeRequest) {
  const pattern = activePattern.value
  if (pattern) {
    commitSizeChange(pattern, resizePattern(pattern, request))
  }
}

/** Whether "remove selected row/column" (ticket 123) applies right now — the Tools group button's own enabled state. */
const canRemoveSelectedLine = computed(() => {
  const pattern = activePattern.value
  return !!pattern && !removeLineRefusal(pattern, selection.value)
})

/**
 * "Remove selected row/column" (ticket 123): unlike Resize, this removes the specific line the Selection marks out
 * from any index, shifting the rest of the grid to close the gap (see commitSizeChange for what landing it does).
 */
function onRemoveSelectedLine() {
  const pattern = activePattern.value
  if (pattern) {
    commitSizeChange(pattern, removeSelectedLine(pattern, selection.value))
  }
}

/**
 * Flips the Pattern's rotated view flag — a purely visual 90° turn (see Pattern.rotated), not a grid edit, so it
 * doesn't go through commitGridChange/undo. Still refits the zoom since the on-screen footprint just swapped.
 */
function onToggleRotate() {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  replacePattern(toggleRotated(pattern))
  resetZoom()
}

function onToggleRowProgress(enabled: boolean) {
  const pattern = activePattern.value
  if (pattern) {
    replacePattern(setRowProgressEnabled(pattern, enabled))
  }
}

/**
 * Flips row progress between running along the grid's rows and down its columns (ticket 32). Its own toggle,
 * separate from Rotate: rotating only turns the picture, and neither ever changes the other. Like Rotate, not a grid
 * edit, so not an undo step.
 */
function onToggleRowDirection() {
  const pattern = activePattern.value
  if (pattern) {
    replacePattern(toggleRowDirection(pattern))
  }
}

/** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
function onMoveRow(delta: number) {
  const pattern = activePattern.value
  if (pattern) {
    replacePattern(moveToRow(pattern, rowProgressPosition(pattern).current + delta))
  }
}

</script>

<template>
  <div class="app-shell" @mouseup="endStroke" @pointerup="endStroke" @pointercancel="endStroke">
    <header class="app-shell__topbar" data-testid="app-topbar">
      <div class="app-shell__topbar-title">
        <h1 class="app-shell__logo">
          <img
            class="app-shell__logo-image"
            data-testid="app-logo"
            :src="`${BASE_URL}favicon.svg`"
            :alt="t.app.title"
            width="96"
            height="96"
          />
        </h1>
      </div>
      <div class="app-shell__topbar-summary">
        <!--
          Two clusters (ticket 117): what the open Pattern is (its summary, Bead and Replace Bead), then what can be done
          to the library (New Pattern, and both Imports with their outcome). Pattern info only exists while a Pattern is
          open; the actions are always here, since Import has to work on an empty library and New Pattern's own
          disabled state already says when there is nothing to leave.
        -->
        <div class="app-shell__summary-group" data-testid="summary-group">
          <div v-if="activePattern" class="app-shell__pattern-info" data-testid="pattern-info">
            <p class="app-shell__summary" data-testid="current-pattern-summary">
              {{ t.patterns.currentLabel }}: {{ summarizePattern(activePattern) }}
            </p>
            <p class="app-shell__summary" data-testid="current-pattern-bead">
              {{ activeBeadLabel }}
            </p>
            <select
              data-testid="replace-bead-select"
              :aria-label="t.replaceBead.selectLabel"
              :value="''"
              @change="onPickReplaceBead($event.target as HTMLSelectElement)"
            >
              <option value="" disabled>{{ t.replaceBead.selectLabel }}</option>
              <option v-for="bead in replaceBeadCandidates" :key="bead.id" :value="bead.id">
                {{ beadLabel(bead) }}
              </option>
            </select>
          </div>

          <div class="app-shell__actions" data-testid="pattern-actions">
            <button type="button" data-testid="new-pattern-button" :disabled="patterns.length === 0" @click="onNewPattern">
              {{ t.patterns.newPatternButton }}
            </button>
            <!-- Imported Patterns go straight into the library, which decides what to open and persists them. -->
            <PatternImport :patterns="patterns" @import="addPatterns" />
          </div>
        </div>
        <LanguageSwitcher />
      </div>

      <!--
        A failed write to this device's storage (ticket 55, ADR 0012). It belongs to the top bar rather than to any of
        the four panels (ADR 0004): it's about the whole Pattern library, not the open Pattern, and it has to be
        visible whether or not one is open. It takes a line of its own below the title and summary boxes (see the
        wrap on .app-shell__topbar), so it reads at a glance instead of squeezing the boxes narrower. role="alert" so
        it's announced the moment it appears, and it stays up until a save gets through (see usePatternLibrary's
        saveFailed) — there's nothing to dismiss, since the edit really isn't saved yet.
      -->
      <p v-if="saveFailed" class="app-shell__save-error" role="alert" data-testid="save-failed-message">
        {{ t.storage.saveFailedMessage }}
      </p>
    </header>

    <div class="app-shell__body">
      <!--
        The left column (ticket 114): the New Pattern form or the Toolbox, taking turns — the form with no Pattern open
        or while a Convert image framing step is up (ticket 58: the frame is sized by these very fields and follows them
        as they're edited, so taking them away mid-framing would freeze the frame at whatever it last read), the
        Toolbox otherwise. The same either/or the panel always had, so there is no state of its own to keep.
      -->
      <aside
        class="app-shell__main"
        :class="{ 'app-shell__main--rail': activePattern && !framing }"
        data-testid="app-main-panel"
      >
        <template v-if="!activePattern || framing">
          <h2>{{ t.patterns.newPatternButton }}</h2>
          <NewPatternForm
            @submit="onCreatePattern"
            @draft="onNewPatternDraft"
            @convert-image="startConvertImage"
          />
        </template>
        <!--
          Hidden while framing takes the canvas panel over (ticket 58): these are the open Pattern's editing tools, and a
          Pattern nobody can see is not one to offer Undo, Rotate, Mirror or Delete all against. Cancel brings both the
          Pattern and its Toolbox straight back.
        -->
        <Toolbox
          v-else-if="activePattern"
          ref="toolboxRef"
          class="app-shell__rail"
          :pattern="activePattern"
          :active-tool="activeTool"
          :selected-color-id="selectedColorId"
          :custom-color="customColor"
          :selected-image-color="selectedImageColor"
          :can-undo="canUndo(history)"
          :can-redo="canRedo(history)"
          :can-copy="!!selection"
          :can-remove-selected-line="canRemoveSelectedLine"
          :mirror-axis-counts="mirrorAxisCounts"
          :mirror-copy-mode="mirrorCopyMode"
          :saved="saved"
          :qr-too-large="qrExport.tooLarge.value"
          @select-tool="onSelectTool"
          @select-color="onSelectColor"
          @select-custom-color="onSelectCustomColor"
          @select-image-color="onSelectImageColor"
          @undo="onUndo"
          @redo="onRedo"
          @toggle-rotate="onToggleRotate"
          @copy="onCopy"
          @save="onSave"
          @export-qr="qrExport.open"
          @set-mirror-axis-count="onSetMirrorAxisCount"
          @toggle-mirror-copy-mode="onToggleMirrorCopyMode"
          @mirror-current="onMirrorCurrent"
          @mirror-current-hover="onMirrorCurrentHover"
          @toggle-row-progress="onToggleRowProgress"
          @toggle-row-direction="onToggleRowDirection"
          @delete-all="onRequestDeleteAll"
          @resize="onResize"
          @remove-selected-line="onRemoveSelectedLine"
        />
      </aside>

      <!--
        The canvas panel alone: the Toolbox is no longer above it (ticket 114), so it takes the full width to the right of
        the left column. Its own grid cell, in the same row as that column, is what bounds the rail's stickiness — see
        .app-shell__main and .app-shell__rail below.
      -->
      <div class="app-shell__canvas-column">
        <div
          ref="canvasAreaEl"
          class="app-shell__canvas"
          :class="{ 'app-shell__canvas--pan': spaceHeld, 'app-shell__canvas--panning': spacePanning }"
          data-testid="app-canvas"
        >
          <!--
            Pinned to the canvas panel's top-right corner (ticket 57), in its own row ahead of the scroll wrapper
            below — a sibling of it, not a descendant, so it never scrolls, zooms or rotates along with the Pattern
            (see PatternCanvas.vue's rotateStyle/scaled transforms, which stay scoped to the box alone). It takes
            up real space in the panel, so the Pattern starts below it and is never covered by it.
          -->
          <ZoomControls
            v-if="activePattern && !framing"
            class="app-shell__zoom-controls"
            :zoom-percent="zoomPercent"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
            @reset="resetZoom"
          />

          <!--
            The framing step's own zoom (ticket 58): a second instance of the same cluster in the same panel corner,
            over its own 100–800% range (see domain/imageFraming), because this zoom moves the picture under a fixed
            frame rather than scaling the Pattern on screen. Only one of the two is ever mounted.
          -->
          <ZoomControls
            v-if="framing"
            class="app-shell__zoom-controls"
            :zoom-percent="convertZoomPercent"
            @zoom-in="convertZoomIn"
            @zoom-out="convertZoomOut"
            @reset="convertResetZoom"
          />

          <!--
            Progress bar (ticket 124, ADR 0005's 2026-09-22 amendment), horizontal case: its own row, stacked below
            the zoom cluster's row above (not merged with it) rather than beside the grid — see the vertical case
            below, next to .app-shell__canvas-scroll. Only one of the two is ever mounted, chosen by Pattern shape;
            neither is while Row progress is off or framing has the panel.
          -->
          <ProgressBar
            v-if="activePattern && progressBarVisible && progressBarShape === 'horizontal'"
            class="app-shell__progress-bar app-shell__progress-bar--horizontal"
            :pattern="activePattern"
            orientation="horizontal"
            @move-row="onMoveRow"
          />

          <div class="app-shell__canvas-row">
            <div ref="canvasScrollEl" class="app-shell__canvas-scroll">
              <!--
                Convert image's framing step takes this panel over (ticket 58, ADR 0010), in the slot the "No Pattern
                open yet" placeholder otherwise occupies — and ahead of the open Pattern too, since framing can be
                entered with one open. Cancel hands the panel straight back.
              -->
              <ConvertImageFrame
                v-if="framing"
                :image="framing.image"
                :technique="framing.technique"
                :bead="framing.bead"
                :dimensions="framing.dimensions"
                :zoom="convertZoom"
                :pan="convertPan"
                :max-colors="convertMaxColors"
                :available-width="canvasAreaWidth"
                @pan="setConvertPan"
                @set-max-colors="setConvertMaxColors"
                @create="onConvertImageCreate"
                @cancel="cancelConvertImage"
              />
              <PatternCanvas
                v-else-if="activePattern"
                :pattern="activePattern"
                :zoom="zoom"
                :preview-cells="previewCells"
                :preview-color="previewColor"
                :selection="selection"
                :mirror-axis-counts="previewedMirrorAxisCounts"
                :dimmed-cells="mirrorCurrentDimmedCells"
                @cell-primary-down="onCellPrimaryDown"
                @cell-primary-move="onCellPrimaryMove"
                @cell-secondary-down="onCellSecondaryDown"
                @cell-secondary-move="onCellSecondaryMove"
                @cell-hover="onCellHover"
                @hover-end="onHoverEnd"
                @select-line="onSelectLine"
              />
              <p v-else class="app-shell__placeholder" data-testid="app-canvas-placeholder">
                {{ t.shell.canvasPlaceholder }}
              </p>
            </div>

            <!-- Progress bar, vertical case: its own column next to the grid, on the canvas panel's right edge. -->
            <ProgressBar
              v-if="activePattern && progressBarVisible && progressBarShape === 'vertical'"
              class="app-shell__progress-bar app-shell__progress-bar--vertical"
              :pattern="activePattern"
              orientation="vertical"
              @move-row="onMoveRow"
            />
          </div>
        </div>
      </div>

      <div class="app-shell__below">
        <hr class="app-shell__below-canvas-divider" data-testid="app-below-canvas-divider" />

        <div class="app-shell__below-canvas" data-testid="app-below-canvas">
          <BeadQuantities :pattern="settledPattern" />
          <PatternList
            :patterns="patterns"
            :active-pattern-id="activePatternId"
            @select="onSelectPattern"
            @remove="removePattern"
          />
        </div>
      </div>
    </div>

    <ConfirmModal
      v-if="deleteAllConfirmOpen"
      data-testid="delete-all-modal"
      :title="t.deleteAll.confirmTitle"
      :message="t.deleteAll.confirmMessage"
      :confirm-label="t.deleteAll.confirmButton"
      :cancel-label="t.deleteAll.cancelButton"
      @confirm="onConfirmDeleteAll"
      @cancel="onCancelDeleteAll"
    />

    <ConfirmModal
      v-if="replaceBeadPendingBead"
      data-testid="replace-bead-modal"
      :title="t.replaceBead.confirmTitle"
      :message="replaceBeadConfirmMessage"
      :confirm-label="t.replaceBead.confirmButton"
      :cancel-label="t.replaceBead.cancelButton"
      @confirm="onConfirmReplaceBead"
      @cancel="onCancelReplaceBead"
    />

    <QrExportPanel v-if="qrExport.panelOpen.value" :matrix="qrExport.matrix.value!" @close="qrExport.close" />

    <ShortcutsHelp v-if="shortcutsHelpOpen" @close="shortcutsHelpOpen = false" />
  </div>
</template>

<style scoped>
.app-shell {
  padding: 24px;
}

/* Two distinct boxes (ticket 20) rather than one bar: a dark title box and an aqua-island status box. Wraps so the
   "couldn't save" notice (ticket 55) takes a full line of its own below them instead of narrowing them. */
.app-shell__topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 16px;
  margin-bottom: 24px;
}

.app-shell__topbar-title,
.app-shell__topbar-summary {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.app-shell__topbar-title {
  /* A fixed square, not stretched to the summary box's height like the flex row would otherwise do: that box grows
     taller once a Pattern is open, and a stretched title box would turn into a tall rectangle. */
  flex: none;
  align-self: flex-start;
  justify-content: center;
  box-sizing: border-box;
  width: 110px;
  height: 110px;
  padding: 16px;
  background: var(--color-paper);
}

.app-shell__topbar-title h1 {
  margin: 0;
  color: var(--color-paper);
}

/* The favicon stands in for the app name, on the same paper as the page so its red beads stay visible. The negative
   margin lets it draw larger than the 72px it takes up in the box, so the box doesn't grow with it. */
.app-shell__logo {
  display: flex;
  line-height: 0;
}

.app-shell__logo-image {
  width: 96px;
  height: 96px;
  margin: -12px;
}

.app-shell__topbar-summary {
  /* Shares the row with the title box: a basis to start from (it only drops to its own line once it can't have that), and min-width: 0 so its clusters wrap inside it rather than making it as wide as they'd like to be. */
  flex: 1 1 320px;
  min-width: 0;
  justify-content: space-between;
  gap: 16px;
  background: var(--color-aqua-island);
}

/*
 * The summary group (tickets 37, 117): two clusters side by side — Pattern info, then the actions — that wrap onto
 * their own lines when the box runs short of room rather than squeezing each other. It grows to fill whatever the
 * language switcher doesn't need, so the switcher stays pinned to the box's end however long the summary text is;
 * min-width: 0 lets it shrink below its content so a long summary wraps instead of pushing the switcher out.
 */
.app-shell__summary-group {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 32px;
  min-width: 0;
}

/* The current Pattern's summary, Bead and Replace Bead, stacked as one block. */
.app-shell__pattern-info {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

/* New Pattern and the two Imports as one row of like buttons; their results (PatternImport.vue) take a line beneath. */
.app-shell__actions {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.app-shell__summary {
  margin: 0;
  color: var(--color-aqua-island-ink);
}

/* Carries the same card frame as the shell's other boxes, in the alarm color the import error already uses
   (PatternImport.vue), so it reads as part of this app rather than a browser dialog. flex-basis: 100% puts it on
   its own line within the wrapping top bar, full width under the title and summary boxes. */
.app-shell__save-error {
  flex: 1 1 100%;
  margin: 0;
  padding: 12px 24px;
  color: var(--color-amaranth-ink);
  font-weight: var(--font-weight-bold);
  background: var(--color-amaranth);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/*
 * A two-column grid of two rows (ticket 114): the left column (the New Pattern form or the Toolbox rail) and the canvas
 * panel share the first row, and the below-canvas section sits under the canvas in the second, so that row is what
 * bounds the rail's stickiness — the rail un-pins when the canvas has scrolled past, and doesn't trail down beside
 * Beads needed and Saved Patterns. minmax(0, 1fr) lets the canvas column shrink below its content instead of pushing
 * the page wider (a zoomed-in Pattern scrolls sideways inside its own frame).
 */
.app-shell__body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

/* Stretched to the row, unlike the grid's other cells, so the rail's sticky containing block is as tall as the canvas panel. */
.app-shell__main {
  grid-column: 1;
  grid-row: 1;
  align-self: stretch;
  box-sizing: border-box;
  width: 280px;
  padding: 16px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.app-shell__main h2 {
  margin-top: 0;
}

/*
 * With a Pattern open this column holds the Toolbox rail instead of the form (ticket 114), which brings its own box and
 * fixed width (Toolbox.vue), so this one drops its frame, padding and width and is just the rail's track — as tall as
 * the canvas panel beside it, which is what the rail sticks within.
 */
.app-shell__main--rail {
  width: auto;
  padding: 0;
  background: none;
  border: none;
  border-radius: 0;
}

/*
 * The Toolbox rail stays pinned near the top of the viewport while the canvas is in view (ticket 114; it was the strip
 * above the canvas before, ADR 0005): a tall Pattern grows the canvas panel past the viewport (see .app-shell__canvas —
 * vertical overflow is never trapped, so the page itself scrolls), and without this the rail would scroll away with it,
 * leaving no way to reach Paint/Fill/Undo/Mirror while working on the lower rows. position: sticky rather than fixed
 * keeps it reachable without a scroll-tracking script, and bounds it by its parent — .app-shell__main, which spans just
 * the canvas panel's row — so it un-pins once the canvas has scrolled past. top: 24px echoes .app-shell's own edge padding.
 *
 * max-height with overflow-y: auto is for a window shorter than the rail's groups add up to: a sticky box taller than
 * the viewport could never show its bottom groups until the canvas ended, so the rail scrolls within itself instead and
 * every group stays reachable. Nothing in it should ever be wider than the rail (see Toolbox.vue), so no horizontal scroll.
 *
 * z-index lifts it above .app-shell__canvas: both are positioned (this one sticky, that one relative for the zoom
 * cluster, ADR 0005) with no stacking context of their own, so without one the canvas panel — later in the DOM — would
 * paint over the stuck rail as it scrolls underneath.
 */
.app-shell__rail {
  position: sticky;
  top: 24px;
  z-index: 2;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

/* With the frame moved onto the canvas box, the empty-canvas message carries its own so the panel still reads as a box. */
.app-shell__placeholder {
  width: fit-content;
  margin: 0 auto;
  padding: 16px 24px;
  color: var(--color-ink);
  opacity: 0.5;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/* The canvas panel's own cell of the grid: column two, row one, beside the left column. */
.app-shell__canvas-column {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
}

/* The below-canvas section: the divider, then the boxes, under the canvas column. */
.app-shell__below {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/*
 * Opens the bottom section (ADR 0004 amendment, ticket 39): a faint divider, muted the same way the Toolbox's
 * dot-grid texture is (color-mix off --color-ink rather than a new token) so it separates the section without
 * competing with the boxes' own borders below it. It sits in .app-shell__below, in the grid's second column, so it
 * naturally spans just the canvas column's width, not the page (the left column sits outside it, to the left).
 */
.app-shell__below-canvas-divider {
  width: 100%;
  height: 0;
  margin: 0;
  border: none;
  /* Deliberately thinner than --border-width (3px, the boxes' own frame) so it reads as a faint separator, not another box edge. */
  border-top: 1px solid color-mix(in srgb, var(--color-ink) 20%, transparent);
}

/*
 * Pattern-level views (ADR 0004): Beads needed and Saved Patterns (ticket 118 retired the third box), each carrying the
 * same card frame the rest of the shell uses. They share a row rather than stacking full-width down the page.
 */
.app-shell__below-canvas {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}

.app-shell__below-canvas > * {
  flex: 1 1 320px;
  min-width: 0;
  padding: 16px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/*
 * A full-width frame around the canvas box, on the same dot-grid notepad texture as the Toolbox (ADR 0005), so
 * the canvas region reads as its own big panel rather than a small bordered box adrift on the page background. The
 * Pattern's own box (PatternCanvas) still sizes itself to the open Pattern's shape rather than stretching to fill
 * this — a bead grid is a fixed physical layout, not something that grows to fill leftover space — so it centers
 * here via margin:auto on the box itself (see PatternCanvas.vue / .app-shell__placeholder below), not this
 * container's own alignment.
 *
 * This is deliberately block layout, not flex, even though it's centering a child (ticket 28): a flex container
 * with justify-content:center and overflow:auto/scroll has a long-standing browser bug where an overflowing
 * child's start edge falls outside the scrollable range entirely — you can scroll to the excess on one side but
 * never reach it on the other. margin:auto centering on a block child doesn't have that failure mode.
 *
 * overflow-x is the only scroll this frame ever does: a manual zoom-in past the available width scrolls sideways
 * here instead of in a nested box (ticket 28 moved that up from PatternCanvas). Vertical overflow is never trapped
 * anywhere in this shell — this frame, like everything above it up to the page, has no height cap of its own, so a
 * tall Pattern just grows this frame, and the page, taller, and the browser's own scrollbar reaches the rest of it.
 * Don't give this (or an ancestor) a fixed/max height — that's what would make vertical scrolling possible again.
 *
 * The scrolling itself lives one level down, on .app-shell__canvas-scroll, so the zoom cluster — a sibling of that
 * scroller, not a descendant, sitting in its own row above it at this frame's top-right — never scrolls, zooms or
 * rotates along with the Pattern below it.
 */
.app-shell__canvas {
  position: relative;
  flex: 1 1 auto;
  padding: 24px;
  background-color: var(--color-paper-solid);
  background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 15%, transparent) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/* Space+drag panning (ticket 95): a grab cursor while Space is held, switching to grabbing once the drag actually starts. */
.app-shell__canvas--pan {
  cursor: grab;
}

.app-shell__canvas--panning {
  cursor: grabbing;
}

/*
 * Wraps the scroll box together with a vertical Progress bar (ticket 124) as flex siblings, so the column sits
 * right next to the grid rather than stretching away to the panel's actual right edge — justify-content: center
 * keeps the pair snug and centers them as a unit (the scroll box no longer grows to fill the leftover width; see
 * .app-shell__canvas-scroll below), the same centering .pattern-canvas's own margin: 0 auto used to do alone.
 * align-items: flex-start keeps the column its own content size while this row (as tall as the grid) is what its
 * sticky positioning below pins within. With no Progress bar mounted (Row progress off, or a horizontal Pattern
 * which mounts its own instead — see .app-shell__progress-bar--horizontal), the scroll box is this row's only
 * child and the wrapper is invisible in effect.
 */
.app-shell__canvas-row {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
}

/*
 * flex-shrink (the flex default already gives 1) still lets it shrink for its own overflow-x scroll when a zoomed-in
 * Pattern (plus the Progress bar column and the row's gap) outgrows the panel; min-width: 0 makes that shrinking
 * reach all the way down rather than stopping at the content's own min-content width. Deliberately no flex-grow
 * (ticket 124 dropped this box's earlier `flex: 1 1 auto`): growing to fill the row's leftover width is what used
 * to strand Progress bar out at the panel's actual right edge, far past the grid it's meant to sit next to.
 */
.app-shell__canvas-scroll {
  min-width: 0;
  overflow-x: auto;
}

/* Its own row at the canvas panel's top-right corner, above the scroll wrapper so the Pattern starts below it rather than running underneath (ticket 57; previously floated over the panel's corner, and before that anchored to the Pattern's own box under ticket 51). Doesn't scale with zoom or move as the panel scrolls. */
.app-shell__zoom-controls {
  width: fit-content;
  margin: 0 0 12px auto;
}

/*
 * Progress bar (ticket 124, ADR 0005's 2026-09-22 amendment): sticky like the Toolbox rail (.app-shell__rail),
 * top: 24px echoing the same shell edge padding, and for the same reason — a tall Pattern grows the canvas panel
 * past the viewport, and without this Progress bar would scroll out of reach while working the lower rows. Each
 * orientation's own containing block (below) is exactly as tall as the Pattern, so it un-pins once that's scrolled
 * past, the same way the rail un-pins once the canvas has.
 */
.app-shell__progress-bar {
  position: sticky;
  top: 24px;
}

/* Its containing block is .app-shell__canvas-row (flex, above), which is exactly as tall as the grid beside it; flex: none keeps it its own content width rather than sharing the row's leftover space with the scroll box. */
.app-shell__progress-bar--vertical {
  flex: none;
}

/* Its own row, centered the way the grid itself is (PatternCanvas.vue's margin: 0 auto), stacked below the zoom cluster rather than merged with it. Its containing block is .app-shell__canvas itself, exactly as tall as the zoom row, this row and the grid together. */
.app-shell__progress-bar--horizontal {
  margin: 0 auto 12px;
}

</style>
