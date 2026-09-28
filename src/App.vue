<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import AppButton from './components/AppButton.vue'
import AppIcon from './components/AppIcon.vue'
import AppLink from './components/AppLink.vue'
import AppLogo from './components/AppLogo.vue'
import AppMenu from './components/AppMenu.vue'
import AppMenuItem from './components/AppMenuItem.vue'
import AppMessage from './components/AppMessage.vue'
import AppSelect from './components/AppSelect.vue'
import BeadQuantities from './components/BeadQuantities.vue'
import BottomSheet from './components/BottomSheet.vue'
import BottomToolbar from './components/BottomToolbar.vue'
import ChangeSizeModal from './components/ChangeSizeModal.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import CanvasBackdrop from './components/CanvasBackdrop.vue'
import CanvasStrip from './components/CanvasStrip.vue'
import ContextBar from './components/ContextBar.vue'
import ConvertImageFrame from './components/ConvertImageFrame.vue'
import CustomColorPicker from './components/CustomColorPicker.vue'
import AppDrawer from './components/AppDrawer.vue'
import AppDock, { type PhoneSheet } from './components/AppDock.vue'
import EmptyCanvas from './components/EmptyCanvas.vue'
import IconButton from './components/IconButton.vue'
import ImageColorsButton from './components/ImageColorsButton.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import NameOnExportsModal from './components/NameOnExportsModal.vue'
import NewPatternForm from './components/NewPatternForm.vue'
import PalettePicker from './components/PalettePicker.vue'
import PatternCanvas from './components/PatternCanvas.vue'
import PatternImport from './components/PatternImport.vue'
import PatternList from './components/PatternList.vue'
import ProgressBar from './components/ProgressBar.vue'
import SaveBox from './components/SaveBox.vue'
import QrExportPanel from './components/QrExportPanel.vue'
import ShortcutsHelp from './components/ShortcutsHelp.vue'
import SizeControls from './components/SizeControls.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import ToastRegion from './components/ToastRegion.vue'
import Toolbox from './components/Toolbox.vue'
import { TOOL_ICONS, TOOL_ORDER } from './components/toolIcons'
import ZoomPill from './components/ZoomPill.vue'
import { useConvertImage } from './composables/useConvertImage'
import { useElementSize } from './composables/useElementSize'
import { hasOpenLayer } from './composables/useEscapeLayer'
import { useFitByPriority } from './composables/useFitByPriority'
import type { MessageTone } from './composables/useToasts'
import { plural } from './i18n/plural'
import { patternExtentPx, rowShiftPx, rowTopPx } from './rendering/patternRenderer'
import { useKeyboardShortcuts, type KeyboardShortcut } from './composables/useKeyboardShortcuts'
import { useMirrorState } from './composables/useMirrorState'
import { usePatternLibrary } from './composables/usePatternLibrary'
import { usePatternZoom } from './composables/usePatternZoom'
import { useQrExport } from './composables/useQrExport'
import { useSelectionGesture } from './composables/useSelectionGesture'
import { useSettledPattern } from './composables/useSettledPattern'
import { useSpaceDragPan } from './composables/useSpaceDragPan'
import { useToasts } from './composables/useToasts'
import { BEAD_CATALOG, beadLabel, findBead } from './domain/beads'
import type { Bead } from './domain/beads'
import { CELL_SIZE_PX, GRID_BORDER_PX, rotationSwapsAxes, type GridPosition, type PreviewCell, type Technique } from './domain/grid'
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
  isInFinishedRow,
  keepFinishedRows,
  mirroredCells,
  mostRecentlyUpdated,
  moveToRow,
  paintCells,
  patternGeometry,
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
import { loadMakerName, saveMakerName } from './domain/makerName'
import {
  importPatterns,
  libraryFileName,
  patternExportFileName,
  patternFileName,
  serializeLibrary,
  serializePattern,
} from './domain/patternFile'
import { exportPatternPdf, exportPatternPng } from './rendering/patternExport'
import { printText } from './rendering/printText'
import { patternFromShareLink } from './domain/qrExport'
import { removeLineRefusal, removeSelectedLine, resizePattern, type ResizeRequest } from './domain/resize'
import type { Tool } from './domain/tool'
import { provideI18n } from './i18n/useI18n'

const { t, locale } = provideI18n()

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
    candidate ? formatSizeMm(estimatedSizeMm(pattern, candidate), unitLabels, locale.value) : '—'

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

/** Short-lived results, shown as toasts in the canvas box (ticket 76). */
const { toasts, show: showToast, dismiss: dismissToast } = useToasts()

/**
 * The "Saved" toast (tickets 115, 76; SaveStates card). Only ever raised by a write that landed; a refused one raises
 * saveFailed instead.
 */
const SAVED_TOAST = 'save-confirmation'

function clearSavedConfirmation() {
  dismissToast(SAVED_TOAST)
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

  showToast(SAVED_TOAST, t.value.tools.savedConfirmation)
}

/** The header, and whether it has had to drop the imports' labels to stay on one line (ticket 142). */
const headerEl = ref<HTMLElement>()
const compactImports = useFitByPriority(headerEl, [() => locale.value, () => !!activePattern.value])

/** The canvas area's own element, measured live (ticket 27) so the Pattern's fit zoom tracks the real available space instead of a guessed constant. */
const canvasAreaEl = ref<HTMLElement | null>(null)
const { width: canvasAreaWidth, height: canvasAreaHeight } = useElementSize(canvasAreaEl)

const { zoom, zoomIn, zoomOut, resetZoom } = usePatternZoom(
  () => activePattern.value,
  canvasAreaWidth,
  canvasAreaHeight,
)

/** The floating zoom cluster's own readout (ticket 57 moved the cluster here, off PatternCanvas): derived from the same zoom the grid scales by, rather than threaded down as a second prop — it's a pure Math.round(zoom * 100) either way (see usePatternZoom.ts). */
const zoomPercent = computed(() => Math.round(zoom.value * 100))

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

/** The canvas strip's size meta: the open Pattern's own grid, or the Pattern a framed picture will make. */
const stripSize = computed(() =>
  framing.value
    ? framing.value.dimensions
    : activePattern.value
      ? { columns: activePattern.value.columns, rows: activePattern.value.rows }
      : undefined,
)

/** The strip's zoom level: framing's own while framing, the Pattern's otherwise, none with nothing on the board. */
const stripZoomPercent = computed(() =>
  framing.value ? convertZoomPercent.value : activePattern.value ? zoomPercent.value : undefined,
)

/** The Technique's name, the background word behind the board (ticket 143). */
function techniqueWord(technique: Technique): string {
  const form = t.value.form
  return technique === 'peyote' ? form.techniquePeyote : technique === 'brick' ? form.techniqueBrick : form.techniqueLoom
}

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
 * Mirror's own session state (ticket 62): axis counts, copy mode, and both preview computations, all behind one small
 * interface -- see composables/useMirrorState.ts. Ticket 174 hid Mirror's UI pending its own redesign, so only the
 * bookkeeping a Resize and a Pattern switch still need is pulled out here; the axis counts stay forever at their
 * NO_MIRROR_AXES default with no UI left to move them off it, which is exactly what leaves paint/fill/erase's own
 * live-mirror calls (mirrorAxisCounts.value below) inert without deleting them. Destructured under their original
 * names (rather than kept as one `mirror` object) so refs and computeds stay top-level setup bindings, which is what
 * lets the template auto-unwrap them -- the same convention usePatternZoom's zoom/zoomIn/etc. already follow below.
 * commitGridChange is a hoisted function declaration further down this file, so passing it here (before its own
 * definition) is safe: by the time useMirrorState calls it, the module has finished initializing.
 */
const {
  axisCounts: mirrorAxisCounts,
  copyMode: mirrorCopyMode,
  previewedAxisCounts: previewedMirrorAxisCounts,
  currentDimmedCells: mirrorCurrentDimmedCells,
  restoreAxisCounts: restoreMirrorAxisCounts,
  clearAxisCounts: clearMirrorAxisCounts,
  reset: resetMirrorState,
} = useMirrorState(() => activePattern.value, commitGridChange)

/** Undo/redo stacks of snapshots (see domain/history.ts); reset whenever the open Pattern changes since it's an editing-session aid, not part of the saved Pattern. Each entry carries a grid, plus whatever else the command also changed: Row progress (Delete all, ticket 42, and Resize), the Bead (Replace Bead, ticket 48) and the grid size with Mirror's axis counts (Resize, ADR 0017) — see UndoEntry. */
const history = ref<History<UndoEntry>>(emptyHistory())

/** Whether the Delete all confirmation modal (ticket 42) is open. The global Escape handler (onKeyDown) defers to the modal's own while this is true, rather than also backing out of Select. */
const deleteAllConfirmOpen = ref(false)

/** Whether the Change size modal (ticket 153) is open. */
const changeSizeOpen = ref(false)

/**
 * The Patterns an import brought in while another Pattern is open, held back until the person says whether to switch
 * to one of them (ticket 154); undefined when there is nothing to ask. They join the library on either answer.
 */
const pendingImport = ref<Pattern[] | undefined>()

/** Whether Save current, offered when the last save failed, was tried and the device refused it too. */
const importSaveRefused = ref(false)

/** The Pattern the import would open: the most recently updated of what came in, the same pick the library makes for an empty library. */
const pendingImportOpens = computed(() => (pendingImport.value ? mostRecentlyUpdated(pendingImport.value) : undefined))

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
  pasteProjectionActive,
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

/** Whether the Drawer (ticket 168; the iPad mini tier's left column) is open. Only the Tools button (744-1023px) ever sets it true. */
const drawerOpen = ref(false)

/** A toast for the More menu's own PatternImport (ticket 168): there is no room beside its buttons in there, so a result arrives above the bottom toolbar instead (ImportResult card). */
function onImportToast(id: string, text: string, tone: MessageTone) {
  showToast(id, text, tone)
}

/** The phone Tool sheet's four tiles (ToolSheet card), same order and icons as everywhere else the four tools list themselves. */
const phoneTools = computed(() => TOOL_ORDER.map((id) => ({ id, icon: TOOL_ICONS[id], label: toolLabel(id) })))

function toolLabel(tool: Tool): string {
  return { paint: t.value.tools.paintLabel, fill: t.value.tools.fillLabel, select: t.value.tools.selectLabel, erase: t.value.tools.eraseLabel }[tool]
}

/** Which of the phone tier's six ToolSheets is open (ticket 79; Dock card), or none. Tapping the Dock button of the open sheet closes it, same as pressing it again. */
const openPhoneSheet = ref<PhoneSheet | null>(null)

function onSelectPhoneSheet(sheet: PhoneSheet) {
  openPhoneSheet.value = openPhoneSheet.value === sheet ? null : sheet
}

/** New Pattern on the phone tier (PhoneForms card): its own full-height modal sheet, opened from the Pattern sheet. */
const phoneNewPatternOpen = ref(false)
/** Saved Patterns on the phone tier: a separate non-modal sheet, opened from the Pattern sheet's Saved Patterns icon. */
const phoneSavedPatternsOpen = ref(false)

function onSelectPatternFromPhoneDrawer(id: string) {
  onSelectPattern(id)
  phoneSavedPatternsOpen.value = false
  openPhoneSheet.value = null
}

/**
 * The canvas panel's own horizontal scroller (ticket 95) -- what Space+drag panning scrolls sideways; vertical
 * panning scrolls the window instead, since nothing in this shell traps vertical overflow of its own (see
 * .app-shell__canvas's own comment below).
 */
const canvasScrollEl = ref<HTMLElement | null>(null)

/** Where the framing step puts its controls: the canvas box's bottom, in the Progress bar's place (ticket 150). */
const framingControlsEl = ref<HTMLElement>()
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
  changeSizeOpen.value = false
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

/*
 * Painting with the keyboard (ticket 159; BeadCursor card). The Pattern is one Tab stop with a bead cursor: arrows move
 * it, Shift + arrows extend a Selection, Home / End go to the row's ends, Page Up / Down move ten rows, Space or Enter
 * uses the current tool through the same handlers (and undo history) as a pointer press, and Escape leaves. The cursor
 * shows only after keyboard focus, and one polite announcement follows each action.
 */
const beadCursor = ref<GridPosition>({ row: 0, column: 0 })
const keyboardOnPattern = ref(false)
/** Whether Shift + arrows is stretching a Selection, begun at the bead the cursor was on. */
let keyboardSelecting = false
const announcement = ref('')

function announce(text: string) {
  // Cleared first, so the same words said twice are still heard twice.
  announcement.value = ''
  void nextTick(() => {
    announcement.value = text
  })
}

/** A bead color in words: the Palette's name for it, "Custom" for any other color, "empty" for none. */
function colorWords(hex: string | null | undefined): string {
  if (!hex) return t.value.a11y.emptyBead
  const color = PALETTE.find((entry) => entry.hex.toLowerCase() === hex.toLowerCase())
  return color ? (t.value.colorNames[color.id] ?? hex) : t.value.colorNames.custom!
}

function announceCursor() {
  const pattern = activePattern.value
  if (!pattern) return
  const { row, column } = beadCursor.value
  announce(
    t.value.a11y.cursorPosition
      .replace('{row}', String(row + 1))
      .replace('{column}', String(column + 1))
      .replace('{color}', colorWords(pattern.grid[row]?.[column]?.color)),
  )
}

function onPatternKeyboardFocus(focused: boolean) {
  keyboardOnPattern.value = focused
  const pattern = activePattern.value
  if (focused && pattern) {
    beadCursor.value = {
      row: Math.min(beadCursor.value.row, pattern.rows - 1),
      column: Math.min(beadCursor.value.column, pattern.columns - 1),
    }
    onCellHover(beadCursor.value.row, beadCursor.value.column)
    announceCursor()
  } else {
    finishKeyboardSelection()
    onHoverEnd()
  }
}

function finishKeyboardSelection() {
  if (keyboardSelecting) {
    keyboardSelecting = false
    endStroke()
  }
}

/** Keeps the cursor two beads from any edge of the visible part of the canvas box. */
function keepCursorInView() {
  const pattern = activePattern.value
  const scroller = canvasScrollEl.value
  const surface = scroller?.querySelector<HTMLElement>('[data-testid="pattern-surface"]')
  if (!pattern || !scroller || !surface) return
  const { row, column } = beadCursor.value
  const extent = patternExtentPx(pattern.technique, pattern.columns, pattern.rows)
  const gridX = rowShiftPx(pattern.technique, row) + column * CELL_SIZE_PX
  const gridY = rowTopPx(pattern.technique, row)
  // Each quarter turn clockwise carries a bead's own top-left (x, y) to the turned picture's own top-left corner for
  // it, the same forward mapping patternRenderer's gridToRegion uses (composing it with itself for 180°/270°, ticket 171).
  const [x, y] = (() => {
    switch (pattern.rotation) {
      case 90:
        return [extent.height - gridY - CELL_SIZE_PX, gridX]
      case 180:
        return [extent.width - gridX - CELL_SIZE_PX, extent.height - gridY - CELL_SIZE_PX]
      case 270:
        return [gridY, extent.width - gridX - CELL_SIZE_PX]
      default:
        return [gridX, gridY]
    }
  })()
  const bead = CELL_SIZE_PX * zoom.value
  const margin = bead * 2
  const box = scroller.getBoundingClientRect()
  const origin = surface.getBoundingClientRect()
  const left = origin.left + (x + GRID_BORDER_PX) * zoom.value
  const top = origin.top + (y + GRID_BORDER_PX) * zoom.value
  if (left - margin < box.left) scroller.scrollLeft -= box.left - (left - margin)
  else if (left + bead + margin > box.right) scroller.scrollLeft += left + bead + margin - box.right
  if (top - margin < box.top) scroller.scrollTop -= box.top - (top - margin)
  else if (top + bead + margin > box.bottom) scroller.scrollTop += top + bead + margin - box.bottom
}

function moveCursor(row: number, column: number, extend: boolean) {
  const pattern = activePattern.value
  if (!pattern) return
  const next = {
    row: Math.max(0, Math.min(pattern.rows - 1, row)),
    column: Math.max(0, Math.min(pattern.columns - 1, column)),
  }
  if (extend) {
    if (!keyboardSelecting) {
      keyboardSelecting = true
      beginSelectPress(beadCursor.value.row, beadCursor.value.column)
    }
    extendSelection(next.row, next.column)
  } else {
    finishKeyboardSelection()
  }
  beadCursor.value = next
  onCellHover(next.row, next.column)
  keepCursorInView()
  announceCursor()
}

/** Space or Enter: the current tool on the bead under the cursor, as one pointer press and release. */
function useToolAtCursor() {
  const pattern = activePattern.value
  if (!pattern) return
  const { row, column } = beadCursor.value
  const before = pattern.grid
  const color = selectedColorHex()
  onCellPrimaryDown(row, column)
  endStroke()
  if (activePattern.value?.grid === before) return
  const tool = activeTool.value
  announce(
    tool === 'erase'
      ? t.value.a11y.erased
      : (tool === 'fill' ? t.value.a11y.filled : t.value.a11y.painted).replace('{color}', colorWords(color)),
  )
}

function onPatternKey(event: KeyboardEvent) {
  const { row, column } = beadCursor.value
  const pattern = activePattern.value
  if (!pattern) return
  // Rotated, the picture is turned clockwise: on-screen arrows move along whichever grid axis now points that way
  // (ticket 171) -- undoing the same turn gridToRegion's forward mapping applies to the picture itself.
  const turn = (dRow: number, dColumn: number): [number, number] => {
    switch (pattern.rotation) {
      case 90:
        return [-dColumn, dRow]
      case 180:
        return [-dRow, -dColumn]
      case 270:
        return [dColumn, -dRow]
      default:
        return [dRow, dColumn]
    }
  }
  const steps: Record<string, [number, number]> = {
    ArrowUp: turn(-1, 0),
    ArrowDown: turn(1, 0),
    ArrowLeft: turn(0, -1),
    ArrowRight: turn(0, 1),
  }
  const step = steps[event.key]
  if (step) {
    moveCursor(row + step[0], column + step[1], event.shiftKey)
  } else if (event.key === 'Home') {
    moveCursor(row, 0, false)
  } else if (event.key === 'End') {
    moveCursor(row, pattern.columns - 1, false)
  } else if (event.key === 'PageUp') {
    moveCursor(row - 10, column, false)
  } else if (event.key === 'PageDown') {
    moveCursor(row + 10, column, false)
  } else if (event.key === ' ' || event.key === 'Enter') {
    useToolAtCursor()
  } else if (event.key === 'Escape' && !selection.value) {
    // Leaves the Pattern; with a Selection up, Escape clears that first (the app's own Escape order).
    ;(event.target as HTMLElement).blur()
  } else {
    return
  }
  // Handled here: Space doesn't pan, Enter doesn't mark a row done, the arrows don't scroll the box.
  event.preventDefault()
  event.stopPropagation()
}

function onPatternKeyUp(event: KeyboardEvent) {
  if (event.key === 'Shift') finishKeyboardSelection()
}

/** The Pattern's accessible name (ScreenReaders card): "Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done". */
const patternLabel = computed(() => {
  const pattern = activePattern.value
  if (!pattern) return undefined
  const colors = new Set(pattern.grid.flat().map((cell) => cell.color).filter(Boolean)).size
  const [columns, rows] = rotationSwapsAxes(pattern.rotation) ? [pattern.rows, pattern.columns] : [pattern.columns, pattern.rows]
  const parts = [
    t.value.a11y.patternLabel
      .replace('{name}', pattern.name)
      .replace('{columns}', String(columns))
      .replace('{rows}', String(rows))
      .replace('{colors}', plural(locale.value, colors, t.value.a11y.colorsCount)),
  ]
  if (pattern.rowProgress.enabled) {
    const position = pattern.rowProgress.direction === 'rows' ? pattern.rowProgress.currentRow : pattern.rowProgress.currentColumn
    const total = pattern.rowProgress.direction === 'rows' ? pattern.rows : pattern.columns
    parts.push(t.value.a11y.progressDone.replace('{row}', String(position)).replace('{total}', String(total)))
  }
  return parts.join(', ')
})

/** Skip to Pattern: moves keyboard focus straight onto the Pattern. */
function focusPattern() {
  canvasScrollEl.value?.querySelector<HTMLElement>('[data-testid="pattern-surface"]')?.focus()
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

/** Picking a color while any other tool is active switches to Paint (ticket 171): the point of picking a color is to paint with it. */
function switchToPaintOnColorPick() {
  if (activeTool.value !== 'paint') {
    onSelectTool('paint')
  }
}

/** Choosing a Palette swatch deselects Custom color and any Image color (CONTEXT.md); the Custom slot keeps showing its last hex, just unselected. */
function onSelectColor(colorId: string) {
  selectedColorId.value = colorId
  selectedImageColor.value = undefined
  switchToPaintOnColorPick()
}

/** Choosing a Custom color makes it the paint color and deselects whichever Palette swatch or Image color was active, vice versa. */
function onSelectCustomColor(hex: string) {
  customColor.value = hex
  selectedColorId.value = undefined
  selectedImageColor.value = undefined
  switchToPaintOnColorPick()
}

/** Choosing one of the open Pattern's Image colors (ticket 58) paints with it, the same way a Palette swatch does; the Custom slot keeps its own last hex, unselected. */
function onSelectImageColor(hex: string) {
  selectedImageColor.value = hex
  selectedColorId.value = undefined
  switchToPaintOnColorPick()
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

/** Withholds a shortcut while the Delete all, Replace bead, Change size or import confirmation, the QR panel, the shortcuts help overlay or a menu is open — same precedence Escape already gives those modals (see the Escape entry below). */
function noModalOpen(): boolean {
  return (
    !hasOpenLayer() &&
    !deleteAllConfirmOpen.value &&
    !replaceBeadPendingBead.value &&
    !changeSizeOpen.value &&
    !pendingImport.value &&
    !qrExport.panelOpen.value &&
    !shortcutsHelpOpen.value
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
  // ticket 90: Del clears just the selected cells under Select with a Selection present, else activates Eraser.
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
  // Row progress group (ticket 94): P toggles it on/off, D toggles direction, Enter/Shift+Enter (and Space/
  // Shift+Space, ticket 178) move the pointer.
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
  // ticket 178: Space/Shift+Space mirror Enter/Shift+Enter above, marking the current row done/not done -- the same
  // guard against a focused Toolbox/Progress bar button, since Space activates one natively (Enter already needed
  // this for Tab+Enter; Space needs it even more, being every button's own native activation key).
  {
    matches: (event) => event.key === ' ' && !event.shiftKey && !isFocusedOnToolboxButton(event),
    guard: noModalOpen,
    action: () => {
      if (activePattern.value?.rowProgress.enabled) {
        onMoveRow(1)
      }
    },
  },
  {
    matches: (event) => event.key === ' ' && event.shiftKey && !isFocusedOnToolboxButton(event),
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
 * PNG and PDF export (tickets 73, 74): the open Pattern drawn by the Pattern renderer into a picture, or into printable
 * pages with its color legend and bead counts, and handed over as a download. Drawing a large Pattern takes a moment, so
 * the buttons wait until it is done.
 */
/**
 * The maker's name for the PDF and PNG exports (ticket 161; CONTEXT.md): kept on this device like the theme, set from
 * the Export menu's last row through its modal.
 */
const makerName = ref(loadMakerName())
const nameOnExportsOpen = ref(false)

function onSaveMakerName(name: string) {
  makerName.value = saveMakerName(name)
  nameOnExportsOpen.value = false
}

/** Which export is being drawn, if any: the save box says so while it takes a while (ticket 158). */
const exporting = ref<'png' | 'pdf' | undefined>()

async function runExport(make: (pattern: Pattern) => Promise<Blob>, extension: 'png' | 'pdf', type: string) {
  const pattern = activePattern.value
  if (!pattern || exporting.value) {
    return
  }
  exporting.value = extension
  try {
    // Read as the Pattern itself, as the QR export does: drawing reads every bead.
    downloadFile(patternExportFileName(pattern, extension), await make(toRaw(pattern)), type)
  } finally {
    exporting.value = undefined
  }
}

/**
 * Export Pattern as the way out (ticket 158; forms-and-states.md): the open Pattern as a Pattern file, offered when a
 * save fails and when a Pattern is too large for a QR code. With none open, a failed save offers the whole library.
 */
function onExportPatternFile() {
  const pattern = activePattern.value
  if (pattern) {
    downloadFile(patternFileName(pattern), serializePattern(pattern))
  } else {
    downloadFile(libraryFileName(), serializeLibrary(patterns.value))
  }
}

function onExportPng() {
  // The words the picture prints (ticket 164), in the app's language, with the maker's name (ticket 161).
  return runExport(
    (pattern) => exportPatternPng(pattern, printText(pattern, t.value, locale.value, makerName.value, new Date())),
    'png',
    'image/png',
  )
}

function onExportPdf() {
  // The words the pages print (ticket 162), in the app's language, with the maker's name (ticket 161).
  return runExport(
    (pattern) => exportPatternPdf(pattern, printText(pattern, t.value, locale.value, makerName.value, new Date())),
    'pdf',
    'application/pdf',
  )
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

  // Eraser (ticket 176): single-bead erase by default, the same stroke path right-click erase already used --
  // so it works on touch/phone without needing a right-click. Right-click stays as-is (see onCellSecondaryDown);
  // it's now simply redundant with the primary press while Eraser is the active tool, and still the only way to
  // erase without leaving Paint, or to flood-erase without leaving Fill.
  if (activeTool.value === 'erase') {
    beginOrCommitPress('erase', null, row, column)
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

  if (strokeMode.value === 'erase') {
    paintStrokeCell(row, column, null)
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

/** Right-click erase, mapped to the active tool (ticket 25): flood-erase in one click under Fill, single-cell/dragged-line erase under Paint and Eraser -- the latter now redundant with Eraser's own primary press (ticket 176), and kept for Paint/Fill where it's the only erase available without switching tools. */
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

/** Opens the Change size modal (ticket 153); refused under the same Row progress lock as Resize. */
function onRequestChangeSize() {
  if (activePattern.value && !activePattern.value.rowProgress.enabled) {
    changeSizeOpen.value = true
  }
}

/** Confirming Change size is a Resize like any other: one undo step, Mirror's axis counts reset (see commitSizeChange). */
function onConfirmChangeSize(request: ResizeRequest) {
  changeSizeOpen.value = false
  onResize(request)
}

/**
 * Imported Patterns (ticket 154): with none open they simply join the library, which opens one. With one open they
 * wait for the person's answer, so nothing on screen changes before it.
 */
function onImportPatterns(imported: Pattern[]) {
  if (!activePattern.value || imported.length === 0) {
    addPatterns(imported)
    return
  }
  importSaveRefused.value = false
  pendingImport.value = imported
}

/** Keep current (and Escape): the import joins the library and the open Pattern stays open, as importing always did. */
function onKeepCurrentAfterImport() {
  const imported = pendingImport.value
  pendingImport.value = undefined
  if (imported) {
    addPatterns(imported)
  }
}

/** Switch: the import joins the library and its most recent Pattern opens (Undo history and Selection reset, the clipboard survives, as on any Pattern switch). */
function onSwitchToImported() {
  const imported = pendingImport.value
  const opens = pendingImportOpens.value
  pendingImport.value = undefined
  if (imported) {
    addPatterns(imported)
    if (opens) {
      activePatternId.value = opens.id
    }
  }
}

/** Save current: writes the library as it stands now; the modal turns to the plain question once that gets through (saveFailed clears), or says so if it didn't. */
function onSaveBeforeImportSwitch() {
  importSaveRefused.value = !saveNow()
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
 * Steps the Pattern's rotation one quarter turn clockwise (see Pattern.rotation, ticket 171) — a purely visual turn,
 * not a grid edit, so it doesn't go through commitGridChange/undo. Still refits the zoom, since the on-screen
 * footprint swaps at 90°/270° (it's unchanged at 180°, but refitting either way is harmless).
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
    <!-- Skip to Pattern (ticket 159): the first Tab stop, visible only while focused. -->
    <a v-if="activePattern && !framing" class="app-shell__skip" href="#pattern" data-testid="skip-to-pattern" @click.prevent="focusPattern">
      {{ t.a11y.skipToPattern }}
    </a>
    <!-- One polite announcement per action (ticket 159): the bead cursor's place, what the key just did. -->
    <p class="app-shell__announcer" role="status" aria-live="polite" data-testid="announcer">{{ announcement }}</p>

    <!--
      The header (ticket 142; Header card): 64px, in order — the brand; the open Pattern's summary and Bead pill (only
      while a Pattern is open) and Replace bead; a flexible gap; the two imports with their one-line results; New
      Pattern; EN / RU; the theme control; Keyboard shortcuts. Nothing shrinks but the Pattern's name. When it still
      doesn't fit, it fits by priority (`writing.md`, Fitting longer text): the imports drop their labels first
      (compactImports).
    -->
    <header ref="headerEl" class="app-header" :class="{ 'app-header--compact': compactImports }" data-testid="app-topbar">
      <!--
        Tools opens the Drawer (ticket 168; Drawer card): the iPad mini tier's own way into the left column, shown
        only 744-1023px -- at 1024px and up the column is docked and this button has nothing to do.
      -->
      <span class="app-header__tools">
        <IconButton
          icon="sidebar"
          :label="t.header.toolsButton"
          :selected="drawerOpen"
          data-testid="drawer-open-button"
          @click="drawerOpen = !drawerOpen"
        />
      </span>
      <h1 class="app-header__brand">
        <AppLogo class="app-header__mark" :size="22" />
        <span class="app-header__name app-header__phone-hide">{{ t.app.title }}</span>
      </h1>

      <!--
        The phone header (ticket 79; responsive.md, 0-743px): the Pattern name with its size and save state, in place
        of the Pattern summary/Bead pill/Replace bead -- Replace bead moves into the Pattern sheet's Bead pill row.
      -->
      <p v-if="activePattern" class="app-header__phone-only app-header__phone-pattern" data-testid="phone-pattern-info">
        <span class="app-header__summary" data-testid="phone-pattern-summary" :title="summarizePattern(activePattern)">
          {{ summarizePattern(activePattern) }}
        </span>
        <AppIcon :name="saveFailed ? 'warning' : 'check'" :size="14" :class="{ 'app-header__phone-save--failed': saveFailed }" class="app-header__phone-save" />
      </p>

      <template v-if="activePattern">
        <p class="app-header__editing app-header__phone-hide" data-testid="pattern-info">
          <span class="app-header__summary" data-testid="current-pattern-summary" :title="summarizePattern(activePattern)">
            {{ summarizePattern(activePattern) }}
          </span>
          <span class="app-header__pill" data-testid="current-pattern-bead">{{ activeBeadLabel }}</span>
        </p>
        <span class="app-header__phone-hide">
          <AppSelect
            variant="primary"
            data-testid="replace-bead-select"
            :aria-label="t.replaceBead.selectLabel"
            :value="''"
            @change="onPickReplaceBead($event.target as HTMLSelectElement)"
          >
            <option value="" disabled>{{ t.replaceBead.selectLabel }}</option>
            <option v-for="bead in replaceBeadCandidates" :key="bead.id" :value="bead.id">
              {{ beadLabel(bead) }}
            </option>
          </AppSelect>
        </span>
      </template>

      <span class="app-header__gap" />

      <!-- Imported Patterns go straight into the library, which decides what to open and persists them. Moves into the More menu at the iPad mini tier (ticket 168), where a toast reports the result instead; at the phone tier it lives in the Pattern sheet. -->
      <div class="app-header__imports app-header__phone-hide" data-testid="pattern-actions">
        <PatternImport :patterns="patterns" :compact="compactImports" @import="onImportPatterns" />
      </div>
      <span class="app-header__phone-hide">
        <AppButton
          variant="primary"
          icon="plus"
          data-testid="new-pattern-button"
          :disabled="patterns.length === 0"
          @click="onNewPattern"
        >
          {{ t.patterns.newPatternButton }}
        </AppButton>
      </span>
      <!-- Undo/Redo (ticket 79): the phone header's own, alongside the Dock's four tools/colour -- the same history as every other Undo/Redo in the app. -->
      <template v-if="activePattern">
        <span class="app-header__phone-only">
          <IconButton icon="undo" shape="round" :label="t.palette.undoButton" data-testid="phone-undo-button" :disabled="!canUndo(history)" @click="onUndo" />
        </span>
        <span class="app-header__phone-only">
          <IconButton icon="redo" shape="round" :label="t.palette.redoButton" data-testid="phone-redo-button" :disabled="!canRedo(history)" @click="onRedo" />
        </span>
      </template>
      <span class="app-header__wide-only"><LanguageSwitcher /></span>
      <span class="app-header__wide-only"><ThemeToggle /></span>
      <!-- Keyboard shortcuts only helps a fine pointer or a keyboard (ticket 166; responsive.md "Input, not width"); at the phone tier it moves into the More menu instead of its own button. -->
      <span class="app-header__shortcuts app-header__phone-hide">
        <IconButton
          icon="keyboard"
          shape="round"
          :label="t.shortcutsHelp.title"
          data-testid="shortcuts-button"
          @click="shortcutsHelpOpen = true"
        />
      </span>
      <!--
        The More menu (ticket 168, 79; OverflowMenu card): 744-1023px, Import a file/QR code, Language, Theme and Name
        on exports; below 744px the same menu drops Import (the Pattern sheet's job there) and adds Keyboard shortcuts
        (any-pointer: fine only, .app-header__more-shortcuts).
      -->
      <span class="app-header__more">
        <AppMenu :label="t.header.moreButton" icon="more" align="end" data-testid="header-more-menu">
          <div class="app-header__more-imports">
            <PatternImport :patterns="patterns" toast-results testid-prefix="menu-" @import="onImportPatterns" @import-result="onImportToast" />
          </div>
          <div class="app-header__more-row">
            <span class="app-header__more-label">{{ t.languageSwitcher.ariaLabel }}</span>
            <LanguageSwitcher />
          </div>
          <div class="app-header__more-row app-header__more-row--wrap">
            <span class="app-header__more-label">{{ t.theme.groupLabel }}</span>
            <ThemeToggle />
          </div>
          <AppMenuItem class="app-header__more-shortcuts" icon="keyboard" data-testid="more-shortcuts" @select="shortcutsHelpOpen = true">
            {{ t.shortcutsHelp.title }}
          </AppMenuItem>
          <template #footer>
            <div class="app-header__more-row" data-testid="more-name-on-exports">
              <span class="app-header__more-label">{{ t.saveBox.nameOnExports }}</span>
              <AppMenuItem data-testid="more-name-on-exports-change" @select="nameOnExportsOpen = true">
                {{ makerName ? t.saveBox.changeName : t.saveBox.addName }}
              </AppMenuItem>
            </div>
          </template>
        </AppMenu>
      </span>
    </header>

    <!--
      The notice row (ticket 141): library-wide notices sit directly under the header, full width, and the row takes no
      space while there is nothing to say. A failed write to this device's storage (ticket 55, ADR 0012) is one: it's
      about the whole Pattern library, not the open Pattern, and has to be visible whether or not one is open.
      It is a danger Message (ticket 76), announced the moment it appears, and it stays up until a save gets through
      (see usePatternLibrary's saveFailed): there's nothing to close, since the edit really isn't saved yet.
    -->
    <div v-if="saveFailed" class="app-shell__notices" data-testid="app-notices">
      <AppMessage tone="danger" placement="notice" :closable="false">
        <span data-testid="save-failed-message">{{ t.storage.saveFailedMessage }}</span>
        <template #actions>
          <AppButton variant="in-box" size="sm" icon="export" data-testid="save-failed-export" @click="onExportPatternFile">
            {{ t.saveBox.exportPatternFile }}
          </AppButton>
        </template>
      </AppMessage>
    </div>

    <div class="app-shell__body">
      <!--
        The left column (ticket 141, ADR 0021): one column that scrolls on its own, holding separate boxes in a fixed
        order — the Toolbox (or the New Pattern form in its place), the save box (ticket 148), Beads needed, Saved
        Patterns. The first box is the form with no Pattern open or while a Convert image framing step is up (ticket
        58: the frame is sized by these very fields and follows them as they're edited, so taking them away mid-framing
        would freeze the frame at whatever it last read), the Toolbox otherwise.
      -->
      <AppDrawer :open="drawerOpen" :label="t.header.toolsButton" @close="drawerOpen = false">
      <aside class="app-shell__column" :aria-label="t.a11y.toolsLandmark" data-testid="app-main-panel">
        <section v-if="!activePattern || framing" class="app-shell__new-pattern" data-testid="new-pattern-box">
          <h2 class="app-shell__box-title">{{ t.patterns.newPatternButton }}</h2>
          <NewPatternForm
            @submit="onCreatePattern"
            @draft="onNewPatternDraft"
            @convert-image="startConvertImage"
          />
        </section>
        <!--
          Hidden while framing takes the canvas panel over (ticket 58): these are the open Pattern's editing tools, and a
          Pattern nobody can see is not one to offer Undo, Rotate or Delete all against. Cancel brings both the
          Pattern and its Toolbox straight back.
        -->
        <Toolbox
          v-else-if="activePattern"
          ref="toolboxRef"
          :pattern="activePattern"
          :active-tool="activeTool"
          :selected-color-id="selectedColorId"
          :custom-color="customColor"
          :selected-image-color="selectedImageColor"
          :can-undo="canUndo(history)"
          :can-redo="canRedo(history)"
          :can-copy="!!selection"
          :can-remove-selected-line="canRemoveSelectedLine"
          @select-tool="onSelectTool"
          @select-color="onSelectColor"
          @select-custom-color="onSelectCustomColor"
          @select-image-color="onSelectImageColor"
          @undo="onUndo"
          @redo="onRedo"
          @toggle-rotate="onToggleRotate"
          @copy="onCopy"
          @delete-all="onRequestDeleteAll"
          @change-size="onRequestChangeSize"
          @remove-selected-line="onRemoveSelectedLine"
        />
        <!-- The save box (ticket 148): the library's save state, Save Pattern and Export ▾, beside the open Pattern's tools. -->
        <SaveBox
          v-if="activePattern && !framing"
          :save-failed="saveFailed"
          :qr-too-large="qrExport.tooLarge.value"
          :exporting="exporting"
          :pattern-name="activePattern.name"
          :maker-name="makerName"
          @edit-maker-name="nameOnExportsOpen = true"
          @save="onSave"
          @export-pattern="onExportPatternFile"
          @export-qr="qrExport.open"
          @export-png="onExportPng"
          @export-pdf="onExportPdf"
        />
        <BeadQuantities :pattern="settledPattern" />
        <PatternList
          :patterns="patterns"
          :active-pattern-id="activePatternId"
          @select="onSelectPattern"
          @remove="removePattern"
        />
      </aside>
      </AppDrawer>

      <!--
        The canvas box (ticket 141): all the width right of the left column and the full height of the main area. The
        page never scrolls; the Pattern scrolls inside the box.
      -->
      <main class="app-shell__canvas-column">
        <div
          class="app-shell__canvas"
          :class="{ 'app-shell__canvas--pan': spaceHeld, 'app-shell__canvas--panning': spacePanning }"
          data-testid="app-canvas"
        >
          <!--
            The canvas box's header strip (ticket 143): what is on the board and its zoom. While a picture is being
            framed (ticket 58) its zoom is the framing step's own, over its own 100–800% range (domain/imageFraming),
            since that zoom moves the picture under a fixed frame rather than scaling the Pattern on screen. The strip
            never scrolls, zooms or rotates with the Pattern below it.
          -->
          <CanvasStrip
            class="app-shell__canvas-strip"
            :size="stripSize"
            :zoom-percent="stripZoomPercent"
            :hint="keyboardOnPattern ? t.a11y.keyboardHint : undefined"
            :title="framing ? t.convertImage.heading : undefined"
            @zoom-in="framing ? convertZoomIn() : zoomIn()"
            @zoom-out="framing ? convertZoomOut() : zoomOut()"
            @reset="framing ? convertResetZoom() : resetZoom()"
          />

          <!-- The drawing area: the rest of the box, measured for the fit zoom (it doesn't grow with the Pattern). -->
          <div ref="canvasAreaEl" class="app-shell__drawing" data-testid="app-drawing-area">
            <CanvasBackdrop v-if="activePattern && !framing" :word="techniqueWord(activePattern.technique)" />

            <!-- The phone tier's own zoom (ticket 79; ZoomPill card): no canvas strip there, so this floats over the Pattern's bottom-right corner instead. -->
            <ZoomPill
              v-if="activePattern && !framing"
              class="app-shell__zoom-pill"
              :zoom-percent="zoomPercent"
              @zoom-in="zoomIn"
              @zoom-out="zoomOut"
              @reset="resetZoom"
            />

            <div class="app-shell__canvas-row">
              <div ref="canvasScrollEl" class="app-shell__canvas-scroll" :class="{ 'app-shell__canvas-scroll--empty': !activePattern && !framing }">
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
                  :controls-to="framingControlsEl"
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
                  :cursor="keyboardOnPattern ? beadCursor : undefined"
                  :label="patternLabel"
                  @cursor-key="onPatternKey"
                  @keyup="onPatternKeyUp"
                  @keyboard-focus="onPatternKeyboardFocus"
                  @cell-primary-down="onCellPrimaryDown"
                  @cell-primary-move="onCellPrimaryMove"
                  @cell-secondary-down="onCellSecondaryDown"
                  @cell-secondary-move="onCellSecondaryMove"
                  @cell-hover="onCellHover"
                  @hover-end="onHoverEnd"
                  @select-line="onSelectLine"
                />
                <EmptyCanvas v-else />
              </div>

            </div>
          </div>

          <!-- Short-lived results (ticket 76): bottom-right of the canvas box, above the Progress bar. -->
          <ToastRegion
            :class="{ 'app-shell__toasts--above-progress': activePattern && !framing }"
            :toasts="toasts"
            @dismiss="dismissToast"
          />

          <!-- The framing step's controls, in the Progress bar's place (ticket 150; ConvertImage card). -->
          <div v-if="framing" ref="framingControlsEl" data-testid="framing-controls" />

          <!--
            The Selection context bar (ticket 168; ContextBar card): floats above the Progress bar on phone and iPad
            mini, offering what a Selection can do without needing the Drawer or a right-click. Absent at 1024px and
            up, where the Toolbox's own Remove line/Copy already cover this.
          -->
          <ContextBar
            v-if="activePattern && !framing"
            class="app-shell__context-bar"
            :selection-size="selection ? { columns: selection.columns, rows: selection.rows } : undefined"
            :paste-armed="pasteProjectionActive"
            :can-remove-line="canRemoveSelectedLine"
            @copy="onCopy"
            @rotate="onToggleRotate"
            @remove-line="onRemoveSelectedLine"
            @dismiss="backOutOfSelect"
          />

          <!--
            Progress bar (ticket 144): along the canvas box's bottom edge, always there while a Pattern is open (not
            while a picture is being framed), since its first control is the switch that turns Row progress on.
          -->
          <ProgressBar
            v-if="activePattern && !framing"
            :pattern="activePattern"
            @move-row="onMoveRow"
            @toggle-row-progress="onToggleRowProgress"
            @toggle-row-direction="onToggleRowDirection"
          />
        </div>
      </main>

    </div>

    <!--
      The iPad mini tier's own toolbar (ticket 168; BottomToolbar card): the four tools, the colour, Undo and Redo,
      under the thumb, so drawing never needs the Drawer. A flex sibling of the body, not nested in the canvas box, so
      it takes its own height off the bottom of the screen rather than sitting inside the canvas box's own padding
      (ADR 0018: the canvas resizes once, when this shows or hides with the tier, not per frame).
    -->
    <BottomToolbar
      v-if="activePattern && !framing"
      class="app-shell__bottom-toolbar"
      :active-tool="activeTool"
      :selected-color-id="selectedColorId"
      :can-undo="canUndo(history)"
      :can-redo="canRedo(history)"
      @select-tool="onSelectTool"
      @select-color="onSelectColor"
      @undo="onUndo"
      @redo="onRedo"
    />

    <!--
      Phone tier bottom: two states. With no Pattern open, a focused pattern-management bar (New Pattern + Import +
      Import QR) replaces the Dock so the first action is immediately obvious. Once a Pattern is open the Dock appears
      with the drawing tools. The BottomToolbar (iPad mini) is always rendered independently.
    -->
    <div v-if="!framing && !activePattern" class="app-shell__phone-pattern-bar" data-testid="phone-pattern-bar">
      <AppButton variant="primary" icon="plus" data-testid="phone-bar-new-pattern" @click="phoneNewPatternOpen = true">
        {{ t.patterns.newPatternButton }}
      </AppButton>
      <PatternImport compact toast-results :patterns="patterns" testid-prefix="phone-bar-" @import="onImportPatterns" @import-result="onImportToast" />
    </div>
    <AppDock
      v-else-if="!framing && !!activePattern"
      class="app-shell__dock"
      :active-tool="activeTool"
      :selected-color-id="selectedColorId"
      :open-sheet="openPhoneSheet"
      @select-sheet="onSelectPhoneSheet"
    />

    <BottomSheet v-if="openPhoneSheet === 'tool' && activePattern" :title="t.toolbox.groups.tools" @close="openPhoneSheet = null">
      <div class="phone-sheet__tiles">
        <button
          v-for="tool in phoneTools"
          :key="tool.id"
          type="button"
          class="ui-control phone-sheet__tile"
          :class="{ 'phone-sheet__tile--active': activeTool === tool.id }"
          :data-testid="`sheet-tool-${tool.id}`"
          :aria-pressed="activeTool === tool.id"
          @click="onSelectTool(tool.id)"
        >
          <AppIcon :name="tool.icon" :size="22" />
          <span>{{ tool.label }}</span>
        </button>
      </div>
      <div class="phone-sheet__links">
        <AppLink icon="remove-line" :disabled="!canRemoveSelectedLine" data-testid="sheet-remove-line" @click="onRemoveSelectedLine(); openPhoneSheet = null">
          {{ t.tools.removeLineShort }}
        </AppLink>
        <AppLink icon="delete" danger data-testid="sheet-delete-all" @click="onRequestDeleteAll(); openPhoneSheet = null">
          {{ t.deleteAll.button }}
        </AppLink>
      </div>
    </BottomSheet>

    <BottomSheet v-if="openPhoneSheet === 'color' && activePattern" :title="t.toolbox.groups.colors" @close="openPhoneSheet = null">
      <PalettePicker :selected-color-id="selectedColorId" @select="onSelectColor" />
      <div class="phone-sheet__color-buttons">
        <CustomColorPicker
          :color="customColor"
          :selected="!selectedColorId && !selectedImageColor && !!customColor"
          @select="onSelectCustomColor"
        />
        <ImageColorsButton :colors="activePattern.imageColors" :selected-color="selectedImageColor" @select="onSelectImageColor" />
      </div>
    </BottomSheet>

    <BottomSheet v-if="openPhoneSheet === 'edit' && activePattern" :title="t.toolbox.groups.edit" @close="openPhoneSheet = null">
      <div class="phone-sheet__edit">
        <IconButton icon="undo" variant="toolbox" size="lg" :label="t.palette.undoButton" :disabled="!canUndo(history)" @click="onUndo" />
        <IconButton icon="redo" variant="toolbox" size="lg" :label="t.palette.redoButton" :disabled="!canRedo(history)" @click="onRedo" />
        <IconButton icon="rotate" variant="toolbox" size="lg" :label="t.palette.rotateButton" :selected="activePattern.rotation !== 0" @click="onToggleRotate" />
        <IconButton icon="copy" variant="toolbox" size="lg" :label="t.tools.copyButton" :disabled="!selection" @click="onCopy" />
        <IconButton
          icon="import"
          variant="toolbox"
          size="lg"
          :label="t.tools.pasteLabel"
          :disabled="!pasteProjectionActive"
          data-testid="sheet-paste"
          @click="openPhoneSheet = null"
        />
      </div>
    </BottomSheet>

    <BottomSheet v-if="openPhoneSheet === 'size' && activePattern" :title="t.toolbox.groups.size" @close="openPhoneSheet = null">
      <SizeControls :pattern="activePattern" @change-size="onRequestChangeSize" />
    </BottomSheet>

    <!--
      The Pattern sheet (PhoneForms, ToolSheet cards): modal, taller, with a scrim -- an accidental tap past its edge
      shouldn't lose the way back to New Pattern or Import, unlike the five light sheets above.
    -->
    <BottomSheet v-if="openPhoneSheet === 'pattern'" modal :title="t.header.patternSheetLabel" @close="openPhoneSheet = null; phoneSavedPatternsOpen = false">
      <template v-if="activePattern">
        <p class="phone-sheet__bead-row">
          <span class="app-header__pill" data-testid="phone-sheet-bead">{{ activeBeadLabel }}</span>
          <AppSelect
            variant="primary"
            data-testid="phone-replace-bead-select"
            :aria-label="t.replaceBead.selectLabel"
            :value="''"
            @change="onPickReplaceBead($event.target as HTMLSelectElement)"
          >
            <option value="" disabled>{{ t.replaceBead.selectLabel }}</option>
            <option v-for="bead in replaceBeadCandidates" :key="bead.id" :value="bead.id">
              {{ beadLabel(bead) }}
            </option>
          </AppSelect>
        </p>
        <SaveBox
          :save-failed="saveFailed"
          :qr-too-large="qrExport.tooLarge.value"
          :exporting="exporting"
          :pattern-name="activePattern.name"
          :maker-name="makerName"
          @edit-maker-name="nameOnExportsOpen = true"
          @save="onSave"
          @export-pattern="onExportPatternFile"
          @export-qr="qrExport.open"
          @export-png="onExportPng"
          @export-pdf="onExportPdf"
        />
        <BeadQuantities :pattern="settledPattern" />
      </template>
      <div class="phone-sheet__pattern-actions">
        <!-- New Pattern: never disabled -- with no Patterns yet this is the only way to reach the form (the wider tiers show it inline by default). -->
        <AppButton variant="primary" icon="plus" data-testid="phone-new-pattern-button" @click="phoneNewPatternOpen = true">
          {{ t.patterns.newPatternButton }}
        </AppButton>
        <PatternImport compact :patterns="patterns" testid-prefix="pattern-sheet-" @import="onImportPatterns" />
        <IconButton
          icon="save"
          :label="t.patterns.heading"
          :disabled="patterns.length === 0"
          data-testid="phone-saved-patterns-button"
          @click="phoneSavedPatternsOpen = true"
        />
      </div>
    </BottomSheet>

    <!-- New Pattern (PhoneForms card): its own full-height modal sheet from the Pattern sheet, the same form the wider tiers show inline. -->
    <BottomSheet v-if="phoneNewPatternOpen" modal :title="t.patterns.newPatternButton" @close="phoneNewPatternOpen = false">
      <NewPatternForm
        @submit="(payload) => { onCreatePattern(payload); phoneNewPatternOpen = false; openPhoneSheet = null }"
        @draft="onNewPatternDraft"
        @convert-image="(draft) => { startConvertImage(draft); phoneNewPatternOpen = false; openPhoneSheet = null }"
      />
    </BottomSheet>

    <!-- Saved Patterns: a non-modal sheet opened from the Pattern sheet's Saved Patterns icon. Selecting a pattern closes both this and the Pattern sheet. -->
    <BottomSheet v-if="phoneSavedPatternsOpen" :title="t.patterns.heading" @close="phoneSavedPatternsOpen = false">
      <PatternList
        :patterns="patterns"
        :active-pattern-id="activePatternId"
        @select="onSelectPatternFromPhoneDrawer"
        @remove="removePattern"
      />
    </BottomSheet>

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

    <ChangeSizeModal
      v-if="changeSizeOpen && activePattern"
      :pattern="activePattern"
      @confirm="onConfirmChangeSize"
      @cancel="changeSizeOpen = false"
    />

    <!-- Import asks before switching (ticket 154). With a failed save the question is about saving first. -->
    <ConfirmModal
      v-if="pendingImport && pendingImportOpens && activePattern"
      data-testid="import-switch-modal"
      :title="t.importSwitch.title"
      :message="
        saveFailed
          ? t.importSwitch.unsavedMessage.replace('{current}', () => activePattern!.name)
          : (pendingImport.length === 1 ? t.importSwitch.messageOne : t.importSwitch.messageMany)
              .replace('{count}', () => String(pendingImport!.length))
              .replaceAll('{imported}', () => pendingImportOpens!.name)
              .replaceAll('{current}', () => activePattern!.name)
      "
      :confirm-label="saveFailed ? t.importSwitch.switchAnywayButton : t.importSwitch.switchButton"
      :cancel-label="t.importSwitch.keepButton"
      :extra-label="saveFailed ? t.importSwitch.saveButton : undefined"
      :confirm-danger="false"
      @confirm="onSwitchToImported"
      @cancel="onKeepCurrentAfterImport"
      @extra="onSaveBeforeImportSwitch"
    >
      <p v-if="saveFailed && importSaveRefused" class="app-shell__modal-error" role="alert" data-testid="import-switch-save-failed">
        {{ t.storage.saveFailedMessage }}
      </p>
    </ConfirmModal>

    <QrExportPanel
      v-if="qrExport.panelOpen.value && activePattern"
      :matrix="qrExport.matrix.value!"
      :summary="summarizePattern(activePattern)"
      @close="qrExport.close"
    />

    <ShortcutsHelp v-if="shortcutsHelpOpen" @close="shortcutsHelpOpen = false" />

    <NameOnExportsModal
      v-if="nameOnExportsOpen"
      :name="makerName"
      @save="onSaveMakerName"
      @cancel="nameOnExportsOpen = false"
    />
  </div>
</template>

<style scoped>
/*
 * The app shell (ticket 141, ADR 0021): header, notice row, then the body, filling the screen exactly. The page itself
 * never scrolls: the left column scrolls on its own, and the Pattern scrolls inside the canvas box, so the header, the
 * Toolbox's top and the canvas box's own top and bottom stay in view on a Pattern of any size.
 */
.app-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  background: var(--canvas);
}

/*
 * The header (ticket 142; Header card): 64px on `canvas`, a `line-soft` rule under it, items 10px apart, none
 * shrinking but the Pattern's name.
 */
.app-header {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  min-height: var(--header-height);
  /* Screen edges (ticket 166; responsive.md): grows past 64px for a notch/dynamic island, `env()` falling back to 0. */
  padding: env(safe-area-inset-top) var(--space-32) 0;
  background: var(--canvas);
  border-bottom: 1px solid var(--line-soft);
}

/* The phone tier (ticket 79): 52px, tighter side padding; a phone on its side (responsive.md, bp-phone-landscape) drops to 44px. */
@media (max-width: 743px) {
  .app-header {
    min-height: var(--header-height-phone);
    padding-right: var(--space-16);
    padding-left: var(--space-16);
  }
}

@media (max-width: 743px) and (max-height: 499px) {
  .app-header {
    min-height: var(--header-height-phone-landscape);
  }
}

.app-header > * {
  flex: none;
}

.app-header__shortcuts {
  display: none;
}

@media (any-pointer: fine) {
  .app-header__shortcuts {
    display: inline-flex;
  }
}

/*
 * The iPad mini tier (ticket 168; responsive.md, 744-1023px): Tools opens the Drawer, and Import/Language/Theme move
 * into the More menu -- everything a wider tier keeps inline in the header. The More menu carries on below 744px
 * (the phone tier, ticket 79) too, since it holds the same Theme/Language/Name on exports there; only the Tools
 * button and the More menu's own Import row are specific to 744-1023px (below that the phone header has no Drawer to
 * open, and imports move into the Pattern sheet instead -- see .app-header__more-imports and .app-header__phone-*).
 */
.app-header__tools,
.app-header__more,
.app-header__phone-only {
  display: none;
}

@media (max-width: 1023px) {
  .app-header__wide-only,
  .app-header__phone-hide {
    display: none;
  }

  .app-header__more {
    display: inline-flex;
  }
}

@media (min-width: 744px) and (max-width: 1023px) {
  .app-header__tools {
    display: inline-flex;
  }
}

@media (max-width: 743px) {
  .app-header__phone-only {
    display: inline-flex;
  }

  .app-header__more-imports {
    display: none;
  }
}

.app-header__more-imports {
  padding: var(--space-4);
}

.app-header__more-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-8);
}

.app-header__more-row--wrap {
  flex-wrap: wrap;
}

.app-header__more-label {
  font: var(--type-body);
  color: var(--body);
}

/* The phone header's combined Pattern name/size + save state (ticket 79), in the wide header's Pattern summary's place. */
.app-header__phone-pattern {
  display: none;
  align-items: center;
  gap: var(--space-6);
  min-width: 0;
  margin: 0;
}

.app-header__phone-save {
  flex: none;
  color: var(--accent-strong);
}

.app-header__phone-save--failed {
  color: var(--danger);
}

@media (max-width: 743px) {
  .app-header__phone-pattern {
    display: flex;
  }
}

/* Keyboard shortcuts inside the phone's More menu only helps a fine pointer or keyboard, same rule as ticket 166's standalone header button. */
.app-header__more-shortcuts {
  display: none;
}

@media (max-width: 743px) and (any-pointer: fine) {
  .app-header__more-shortcuts {
    display: flex;
  }
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0 var(--space-10) 0 0;
}

.app-header__mark {
  color: var(--accent);
}

.app-header__name {
  font: var(--type-brand);
  letter-spacing: var(--tracking-brand);
  color: var(--ink);
}

/* The Pattern's summary and its Bead pill. */
.app-header__editing {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
}

/*
 * Only once the imports have dropped their labels may the Pattern's name give way, cut with an ellipsis (the second
 * fitting step); the Bead pill keeps its size.
 */
.app-header--compact > .app-header__editing {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
}

.app-header__summary {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* The Bead pill (BeadPill card): read-only. */
.app-header__pill {
  flex: none;
  padding: var(--space-4) var(--space-12);
  font: var(--type-pill);
  color: var(--ink);
  white-space: nowrap;
  background: var(--pill);
  border-radius: var(--radius-full);
}

.app-header > .app-header__gap {
  flex: 1 1 0;
}

.app-header__imports {
  display: flex;
  align-items: center;
  gap: var(--space-10);
}

@media (max-width: 1023px) {
  .app-header__imports {
    display: none;
  }
}

.app-shell__skip {
  position: absolute;
  top: var(--space-8);
  left: var(--space-8);
  z-index: var(--z-tooltip);
  padding: var(--space-8) var(--space-12);
  font: var(--type-control);
  color: var(--ink);
  background: var(--canvas);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  transform: translateY(-200%);
}

.app-shell__skip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
  transform: none;
}

/* Heard, not seen. */
.app-shell__announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* The notice row under the header, full width; it only exists while there is something to say. */
.app-shell__notices {
  flex: none;
  padding: var(--space-16) var(--space-32) 0;
}

/* An error inside a confirmation, in the danger color (forms-and-states.md). */
.app-shell__modal-error {
  margin: 0 0 var(--space-8);
  color: var(--danger);
}

/* Toasts sit 16px above the Progress bar while it shows. */
.app-shell__toasts--above-progress {
  --toast-bottom: calc(var(--progress-height) + var(--space-16));
}

/*
 * The Selection context bar (ticket 168; ContextBar card): floats 10px from the canvas box's own edges, just above
 * the Progress bar, on phone and iPad mini only -- the Toolbox's own Remove line/Copy links cover this at 1024px and
 * up, where there's no need for it to float over the Pattern.
 */
.app-shell__context-bar {
  display: none;
}

@media (max-width: 1023px) {
  .app-shell__context-bar {
    position: absolute;
    right: var(--space-10);
    bottom: calc(var(--progress-height) + var(--space-10));
    left: var(--space-10);
    z-index: var(--z-context-bar);
    display: flex;
  }
}

/* The iPad mini tier's own toolbar (ticket 168; BottomToolbar card): a flex sibling of the body, shown only there. */
.app-shell__bottom-toolbar {
  display: none;
}

@media (min-width: 744px) and (max-width: 1023px) {
  .app-shell__bottom-toolbar {
    display: flex;
    flex: none;
  }
}

/* The phone tier's Dock (ticket 79): a flex sibling of the body, the same reason BottomToolbar is one. */
.app-shell__dock {
  display: none;
}

/* Phone pattern-management bar: shown instead of the Dock when no Pattern is open. */
.app-shell__phone-pattern-bar {
  display: none;
}

@media (max-width: 743px) {
  .app-shell__dock {
    display: flex;
    flex: none;
  }

  .app-shell__phone-pattern-bar {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-8);
    height: var(--dock-height);
    padding: 0 var(--space-16);
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--canvas);
    border-top: 1px solid var(--line-soft);
  }

  /* New Pattern grows to take the remaining width; the two import icons sit at a fixed square size beside it. */
  .app-shell__phone-pattern-bar :deep(.app-button) {
    flex: 1 1 0;
  }

  /* No canvas strip on phone (responsive.md): ZoomPill floats over the Pattern instead. */
  .app-shell__canvas-strip {
    display: none;
  }
}

.app-shell__zoom-pill {
  display: none;
}

@media (max-width: 743px) {
  .app-shell__zoom-pill {
    position: absolute;
    right: var(--space-16);
    bottom: var(--space-16);
    z-index: var(--z-canvas-overlay);
    display: inline-flex;
  }
}

/* The phone ToolSheets' own content (ticket 79; ToolSheet card). */
.phone-sheet__tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
}

.phone-sheet__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  height: 4.5rem;
  color: var(--body);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.phone-sheet__tile--active {
  color: var(--accent-strong);
  border-color: var(--accent-strong);
}

.phone-sheet__tile:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.phone-sheet__links {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-16);
}

.phone-sheet__color-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  margin-top: var(--space-12);
}

.phone-sheet__edit {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-8);
}

.phone-sheet__bead-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0 0 var(--space-16);
}

.phone-sheet__pattern-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-8);
  margin-top: var(--space-16);
  padding-top: var(--space-16);
  border-top: 1px solid var(--line-soft);
}

.phone-sheet__pattern-actions .app-button {
  flex: 1 1 0;
}

/*
 * The body: the 326px left column (312px boxes plus a 14px gutter for its thin scrollbar) and the canvas box, which
 * takes all the remaining width and the full height (ticket 141; `responsive.md`, MacBook Air tier). minmax(0, 1fr)
 * lets the canvas box shrink below its content instead of pushing the page wider.
 */
.app-shell__body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: var(--column-width) minmax(0, 1fr);
  gap: var(--space-14);
  min-height: 0;
  padding: var(--space-24) var(--space-32);
}

/*
 * iPad 13" tier (ticket 167; responsive.md, `bp-tablet-lg` 1024px to just under `bp-laptop`): the column docks again
 * at 300px (286px boxes, the same 14px scrollbar gutter as the reference tier), page padding drops to 16px all
 * round, and the boxes sit 12px apart instead of 16px. Every other tier below this is built from here down, as a
 * further override at its own literal breakpoint (responsive.md can't be read from a custom property).
 */
@media (min-width: 1024px) and (max-width: 1279px) {
  .app-shell__body {
    grid-template-columns: var(--column-width-tablet-lg) minmax(0, 1fr);
    padding: var(--space-16);
  }
}

/*
 * iPad mini and phone tiers (ticket 168, 79; responsive.md, under `bp-tablet-lg` 1024px): the column leaves the grid
 * track entirely. 744-1023px, the Drawer wrapping it switches to `position: fixed` (AppDrawer.vue's own media query)
 * and floats over the canvas box instead; under 744px AppDrawer hides it altogether -- the phone tier's Dock and
 * ToolSheets reach the same controls through their own, separate markup instead (Toolbox/SaveBox/Beads
 * needed/Saved Patterns stay mounted inside the hidden Drawer, just not visibly). Either way the canvas box takes
 * the whole row on its own.
 */
@media (max-width: 1023px) {
  .app-shell__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* The phone tier (ticket 79): tighter page padding; a phone on its side leaves room for the Dock's own left rail (AppDock.vue's matching media query -- position: fixed, so it needs this padding rather than a flex/grid track). */
@media (max-width: 743px) {
  .app-shell__body {
    padding: var(--space-16);
  }
}

@media (max-width: 743px) and (max-height: 499px) {
  .app-shell__body {
    padding-left: calc(4rem + env(safe-area-inset-left));
  }
}

/* The left column scrolls on its own, and never scrolls the canvas. height: 100% matters once the Drawer wrapping it switches to position: fixed (744-1023px): a percentage height needs a definite one to resolve against, and there it's the Drawer's own fixed box; in the grid it was already this tall via the row's default stretch. */
.app-shell__column {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-16);
  box-sizing: border-box;
  min-height: 0;
  padding-right: var(--space-14);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

@media (min-width: 1024px) and (max-width: 1279px) {
  .app-shell__column {
    gap: var(--space-12);
  }
}

/* Each box keeps its content height and fills the column's width. */
.app-shell__column > * {
  flex: none;
  width: auto;
}

/* The New Pattern form's box (ticket 149; NewPatternForm card): the Toolbox's panel, its title in the `title` role. */
.app-shell__new-pattern {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
  box-sizing: border-box;
  padding: var(--space-24);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
}

.app-shell__box-title {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

/* The canvas box's cell: the rest of the width, the full height. */
.app-shell__canvas-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/*
 * The canvas box (ticket 141): all the width right of the left column and the full height of the body, on the same
 * dot-grid notepad texture as the Toolbox until ticket 143 restyles it. Its rows stack top to bottom (the zoom cluster,
 * a horizontal Progress bar, then the Pattern), and the Pattern's own row takes the rest of the height.
 *
 * The Pattern scrolls inside .app-shell__canvas-scroll, both ways: the page never does. The Pattern's own box
 * (PatternCanvas) sizes itself to the open Pattern's shape rather than stretching, and centers itself with margin:
 * auto — block layout, not flex, inside the scroller (ticket 28): a flex container with justify-content: center and
 * overflow: auto has a long-standing browser bug where an overflowing child's start edge can't be scrolled to.
 *
 * The zoom cluster is a sibling of the scroller, not a descendant, so it never scrolls, zooms or rotates along with the
 * Pattern below it.
 */
.app-shell__canvas {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--box);
  border: 1px solid var(--box-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}

/*
 * The drawing area (ticket 143): the rest of the canvas box under the strip. Its size is measured for the fit zoom,
 * so it takes a share of the box (flex-basis 0), never the Pattern's size. The background highlight fills it behind
 * everything; what follows it is positioned too, so it paints over the highlight.
 */
.app-shell__drawing {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.app-shell__drawing > :not(.canvas-backdrop) {
  position: relative;
}

/*
 * Space+drag panning (ticket 95): a grab cursor while Space is held, switching to grabbing once the drag actually starts
 * (BeadHover card). It wins over the board's own crosshair.
 */
.app-shell__canvas--pan,
.app-shell__canvas--pan :deep(*) {
  cursor: grab;
}

.app-shell__canvas--panning,
.app-shell__canvas--panning :deep(*) {
  cursor: grabbing;
}

/*
 * Centers the Pattern's scroll box in the drawing area both ways while it is smaller than the area; once it is bigger,
 * the scroll box is capped at the area's size (max-height below; min-width: 0 across) and scrolls instead.
 */
.app-shell__canvas-row {
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  align-items: center;
  min-height: 0;
}

.app-shell__canvas-scroll {
  box-sizing: border-box;
  min-width: 0;
  max-height: 100%;
  overflow: auto;
}

/* When no Pattern is open the scroll panel stretches to fill the whole row so the dot board covers it edge to edge. */
.app-shell__canvas-scroll--empty {
  align-self: stretch;
  width: 100%;
  overflow: hidden;
}
</style>
