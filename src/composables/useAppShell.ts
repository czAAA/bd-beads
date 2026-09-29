import { inject, provide, ref, watch, type InjectionKey } from 'vue'
import { provideI18n } from '../i18n/useI18n'
import { useThemePick } from '../theme/useThemePick'
import { browserServices, type Services } from '../services'
import { useAppShortcutTable } from './useAppShortcutTable'
import { useA11yAnnouncer } from './useA11yAnnouncer'
import { useCanvasFraming } from './useCanvasFraming'
import { useCanvasPointer } from './useCanvasPointer'
import { useChangeSizeFlow } from './useChangeSizeFlow'
import { useConvertImage } from './useConvertImage'
import { useDeleteAllFlow } from './useDeleteAllFlow'
import { hasOpenLayer } from './useEscapeLayer'
import { useExportFlow } from './useExportFlow'
import { useImportSwitchFlow } from './useImportSwitchFlow'
import { useKeyboardCursor } from './useKeyboardCursor'
import { useMirrorState } from './useMirrorState'
import { useNewPatternFlow } from './useNewPatternFlow'
import { useOverlayVisibility } from './useOverlayVisibility'
import { usePaintStroke } from './usePaintStroke'
import { usePinchPan } from './usePinchPan'
import { usePatternLabels } from './usePatternLabels'
import { usePatternLibrary } from './usePatternLibrary'
import { useReplaceBeadFlow } from './useReplaceBeadFlow'
import { useRowOps } from './useRowOps'
import { useSaveFlow } from './useSaveFlow'
import { useSelectionGesture } from './useSelectionGesture'
import { useSettledPattern } from './useSettledPattern'
import { useSharedPatternLink } from './useSharedPatternLink'
import { useSpaceDragPan } from './useSpaceDragPan'
import { useToasts } from './useToasts'
import { useToolAndColor } from './useToolAndColor'
import { useToolAtCursor } from './useToolAtCursor'
import { useUndoHistory } from './useUndoHistory'

/**
 * The app's composition root (ADR 0023): every composable App.vue's shell components draw on, wired to each other and
 * handed over as one flat context. Nothing here decides anything itself; each concern lives in its own composable,
 * whose deps are lazy arrows so two of them can reference each other (Undo history and Mirror, say). Call it once,
 * from the root component's setup (see provideAppShell).
 */
function wireAppShell(services: Services) {
  const { t, locale } = provideI18n(services.localeStore)
  // The theme pick is shared by the header's controls; this is where it is first read, from this device's store.
  useThemePick(services.themePickStore)

  /**
   * The Pattern library, which one is open, and persistence (ticket 55, ADR 0012) — every Pattern change goes through
   * one of these mutators, and nothing here touches storage directly. replacePattern is the single commit point for a
   * change to the open Pattern, and saves it as it lands; a dragged stroke is the one edit that doesn't, asking for its
   * save to be deferred per cell and writing once when the stroke ends (see usePaintStroke).
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
  } = usePatternLibrary(services.libraryStore)

  const currentPattern = () => activePattern.value
  const messages = () => t.value
  const currentLocale = () => locale.value

  const { activeBeadLabel, patternLabel } = usePatternLabels({ currentPattern, messages, locale: currentLocale })

  /** Short-lived results, shown as toasts in the canvas box (ticket 76). */
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts()

  /** Save and its "Saved" confirmation (tickets 115, 119, 195). */
  const { onSave, clearSavedConfirmation } = useSaveFlow({
    currentPattern,
    saveNow,
    messages,
    showToast,
    dismissToast,
    downloadFile: services.downloadFile,
  })

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

  /** New-Pattern creation, blank or from Convert image, and the framing step's gate (tickets 58, 196). */
  const { framing, onNewPatternDraft, onCreatePattern, onConvertImageCreate } = useNewPatternFlow({
    addPattern,
    convertImage: () => convertImageSource.value,
    cancelConvertImage,
  })

  /** Canvas sizing, zoom and the strip's size/zoom meta (tickets 27, 57, 197). */
  const { bindCanvasArea, canvasAreaWidth, zoom, zoomIn, zoomOut, setZoom, resetZoom, zoomPercent, stripSize, stripZoomPercent } =
    useCanvasFraming({
      currentPattern,
      framing: () => framing.value,
      convertZoomPercent: () => convertZoomPercent.value,
    })

  /** Undo/redo history and the commit/step logic around it (ticket 189). Its deps reach for Mirror and Selection state declared below, through lazy arrows only called at runtime. */
  const {
    canUndo,
    canRedo,
    record: recordHistory,
    reset: resetHistory,
    commitGridChange,
    onUndo,
    onRedo,
  } = useUndoHistory({
    currentPattern,
    replacePattern,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    restoreMirrorAxisCounts: (counts) => restoreMirrorAxisCounts(counts),
    clearSelectionAndHover,
  })

  /**
   * Mirror's own session state (ticket 62): axis counts, copy mode, and both preview computations. Ticket 174 hid
   * Mirror's UI pending its own redesign, so only the bookkeeping a Resize and a Pattern switch still need is pulled
   * out here; the axis counts stay forever at their NO_MIRROR_AXES default, which is exactly what leaves paint/fill/
   * erase's own live-mirror calls inert without deleting them.
   */
  const {
    axisCounts: mirrorAxisCounts,
    copyMode: mirrorCopyMode,
    previewedAxisCounts: previewedMirrorAxisCounts,
    currentDimmedCells: mirrorCurrentDimmedCells,
    restoreAxisCounts: restoreMirrorAxisCounts,
    clearAxisCounts: clearMirrorAxisCounts,
    reset: resetMirrorState,
  } = useMirrorState(currentPattern, commitGridChange)

  /** The Select tool's whole gesture (ticket 63): the Selection, the in-session clipboard, the in-progress press and the Select-tool paste preview. Only ever called into while Select is the active tool, or from a command that isn't tied to a tool. */
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
  } = useSelectionGesture(currentPattern, commitGridChange, () => mirrorAxisCounts.value, () => mirrorCopyMode.value)

  /** A Selection (or hover) that no longer fits after a step or a size change changed the grid. */
  function clearSelectionAndHover() {
    resetSelection()
    hoveredCell.value = undefined
  }

  /** The active tool and which of the three paint colors is chosen (tickets 58, 171, 206). */
  const {
    activeTool,
    selectedColorId,
    customColor,
    selectedImageColor,
    selectedColorHex,
    previewColor,
    onSelectTool,
    onSelectColor,
    onSelectCustomColor,
    onSelectImageColor,
    resetImageColor,
  } = useToolAndColor({ leaveSelectTool })

  /** A Paint-tool drag (ticket 24): the stroke lifecycle and its one undo step and one save (ticket 190). strokeMode is 'paint'/'erase' while a stroke is in progress, else null. */
  const { strokeMode, endStroke, paintStrokeCell, beginOrCommitPress } = usePaintStroke({
    currentPattern,
    replacePattern,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    mirrorCopyMode: () => mirrorCopyMode.value,
    activeTool: () => activeTool.value,
    commitGridChange,
    recordHistory,
    endSelectPress,
    flushPendingSave,
  })

  /** The open Pattern for what only summarises it: it follows a stroke a few times a second, and is exact when the stroke ends. */
  const settledPattern = useSettledPattern(currentPattern, () => strokeMode.value !== null)

  /** The open Pattern for the code that shares it, which nobody watches change: it waits for the stroke to end. */
  const shareablePattern = useSettledPattern(currentPattern, () => strokeMode.value !== null, Number.POSITIVE_INFINITY)

  /**
   * The canvas panel's own horizontal scroller (ticket 95) -- what Space+drag panning scrolls sideways; vertical
   * panning scrolls the window instead, since nothing in the shell traps vertical overflow of its own.
   */
  const canvasScrollEl = ref<HTMLElement | null>(null)
  const { spaceHeld, panning: spacePanning } = useSpaceDragPan(canvasScrollEl)

  /** A template function ref for the canvas panel's scroller, so the element stays the wiring's own rather than a name the panel has to declare. */
  function bindCanvasScroll(el: unknown) {
    canvasScrollEl.value = el instanceof HTMLElement ? el : null
  }

  /** Two fingers on the Pattern pinch to zoom and pan it (ticket 79); the one-finger paint stroke in progress ends when the second lands. */
  usePinchPan(canvasScrollEl, { zoom: () => zoom.value, setZoom, endStroke: () => endStroke() })

  /** Mouse, touch and pen input on the Pattern (tickets 22-25, 31, 33, 92, 95, 176, 206). */
  const {
    hoveredCell,
    previewCells,
    onCellHover,
    onHoverEnd,
    pasteAtPointer,
    onCellPrimaryDown,
    onCellPrimaryMove,
    onCellSecondaryDown,
    onCellSecondaryMove,
  } = useCanvasPointer({
    currentPattern,
    activeTool: () => activeTool.value,
    spaceHeld: () => spaceHeld.value,
    strokeMode: () => strokeMode.value,
    selectedColorHex,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    mirrorCopyMode: () => mirrorCopyMode.value,
    pastePreviewCells,
    beginSelectPress,
    extendSelection,
    backOutOfSelect,
    beginOrCommitPress,
    paintStrokeCell,
    pasteAt: pasteAtCell,
  })

  /** Painting with the keyboard (tickets 159, 194): the announcer needs the cursor and the cursor the announcer, so the announcer reads the cursor lazily. */
  const { announcement, announce, announceCursor, colorWords } = useA11yAnnouncer({
    messages,
    currentPattern,
    beadCursor: () => beadCursor.value,
  })

  const { invokeToolAt, extendSelectionTo, finishExtending } = useToolAtCursor({
    messages,
    currentPattern,
    activeTool: () => activeTool.value,
    selectedColorHex,
    pressCell: onCellPrimaryDown,
    endStroke,
    beginSelectPress,
    extendSelection,
    announce,
    colorWords,
  })

  const { beadCursor, keyboardOnPattern, onPatternKeyboardFocus, onPatternKey, onPatternKeyUp } = useKeyboardCursor({
    currentPattern,
    zoom: () => zoom.value,
    scroller: () => canvasScrollEl.value,
    hasSelection: () => !!selection.value,
    onCellHover,
    onHoverEnd,
    announceCursor,
    invokeToolAt,
    extendSelectionTo,
    finishExtending,
  })

  /** Delete all and its confirmation (tickets 42, 198). */
  const deleteAll = useDeleteAllFlow({ currentPattern, replacePattern, recordHistory })

  /** Resize, Change size and Remove selected row/column, one shared undo-committing path (tickets 123, 153, 199). */
  const changeSize = useChangeSizeFlow({
    currentPattern,
    replacePattern,
    recordHistory,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    clearMirrorAxisCounts,
    selection: () => selection.value,
    clearSelectionAndHover,
  })

  /** Replace Bead, its select and its confirmation (tickets 48, 113, 205). */
  const replaceBead = useReplaceBeadFlow({ currentPattern, replacePattern, recordHistory, messages, locale: currentLocale })

  /** Pattern import and the keep-current / save-and-switch / switch decision (tickets 154, 168, 200). */
  const importSwitch = useImportSwitchFlow({
    currentPattern,
    addPatterns,
    openPattern: (id) => {
      activePatternId.value = id
    },
    saveNow,
    showToast,
  })

  /** Exporting as a file, PNG, PDF or QR code, and the maker's name they print (tickets 68, 73, 74, 158, 161, 202). */
  const exportFlow = useExportFlow({
    currentPattern,
    patterns: () => patterns.value,
    shareablePattern: () => shareablePattern.value,
    messages,
    locale: currentLocale,
    downloadFile: services.downloadFile,
    makerNameStore: services.makerNameStore,
  })

  /** Rotate and the Row progress controls; none is an undo step (tickets 32, 171, 201). */
  const rowOps = useRowOps({ currentPattern, replacePattern, resetZoom })

  /** Opening a scanned QR export's link, and the page-hide and unmount saves (tickets 55, 68, 203). */
  useSharedPatternLink({ patterns: () => patterns.value, addPattern, flushPendingSave })

  function onSelectPattern(id: string) {
    activePatternId.value = id
  }

  function onNewPattern() {
    activePatternId.value = undefined
  }

  /** The Drawer and the phone tier's sheets (tickets 79, 168, 188, 204). */
  const overlays = useOverlayVisibility({ selectPattern: onSelectPattern })

  /** Whether the `?` shortcuts help overlay (ticket 96) is open: a single boolean with no logic, so it stays here. */
  const shortcutsHelpOpen = ref(false)

  /** For the Escape precedence: asks every Tool group to collapse before backing out of Select (ticket 41). */
  const toolbox = ref<{ collapseExpandedGroup: () => boolean } | null>(null)

  /** A template function ref for the Toolbox, for the same reason as bindCanvasScroll. */
  function bindToolbox(el: unknown) {
    toolbox.value = (el as typeof toolbox.value) ?? null
  }

  useAppShortcutTable({
    activePattern: currentPattern,
    activeTool: () => activeTool.value,
    hasSelection: () => !!selection.value,
    hasOpenLayer,
    anyDialogOpen: () =>
      deleteAll.deleteAllConfirmOpen.value ||
      !!replaceBead.replaceBeadPendingBead.value ||
      changeSize.changeSizeOpen.value ||
      !!importSwitch.pendingImport.value ||
      exportFlow.qrExport.panelOpen.value ||
      shortcutsHelpOpen.value,
    collapseExpandedToolGroup: () => toolbox.value?.collapseExpandedGroup() ?? false,
    backOutOfSelect,
    onUndo,
    onRedo,
    onSelectTool,
    onSelectColor,
    onDeleteSelection,
    onToggleRotate: rowOps.onToggleRotate,
    onCopy,
    pasteAtPointer,
    onSave,
    onToggleRowProgress: rowOps.onToggleRowProgress,
    onToggleRowDirection: rowOps.onToggleRowDirection,
    onMoveRow: rowOps.onMoveRow,
    openShortcutsHelp: () => {
      shortcutsHelpOpen.value = true
    },
  })

  /** Skip to Pattern: moves keyboard focus straight onto the Pattern. */
  function focusPattern() {
    canvasScrollEl.value?.querySelector<HTMLElement>('[data-testid="pattern-surface"]')?.focus()
  }

  watch(activePatternId, () => {
    resetHistory()
    // Selection resets here through the module's reset(); the clipboard deliberately survives a Pattern switch
    // (ticket 92, ADR 0016), unlike Undo/Redo history and Selection.
    resetSelection()
    // Mirror's session state is an editing-session setting, reset on a Pattern switch (ticket 44/45 decision) --
    // through this single reset point, per the ticket 62 decision, rather than a watcher of its own.
    resetMirrorState()
    deleteAll.onCancelDeleteAll()
    changeSize.changeSizeOpen.value = false
    replaceBead.onCancelReplaceBead()
    exportFlow.qrExport.close()
    clearSavedConfirmation()
    resetImageColor()
  })

  return {
    t,
    locale,
    // The library
    patterns,
    activePatternId,
    activePattern,
    saveFailed,
    removePattern,
    onSelectPattern,
    onNewPattern,
    activeBeadLabel,
    patternLabel,
    settledPattern,
    // Notices
    toasts,
    dismissToast,
    announcement,
    // Creating a Pattern, and framing a picture for one
    framing,
    onNewPatternDraft,
    onCreatePattern,
    onConvertImageCreate,
    startConvertImage,
    cancelConvertImage,
    convertZoom,
    convertPan,
    convertMaxColors,
    setConvertPan,
    setConvertMaxColors,
    convertZoomIn,
    convertZoomOut,
    convertResetZoom,
    // The canvas
    bindCanvasArea,
    canvasAreaWidth,
    bindCanvasScroll,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomPercent,
    stripSize,
    stripZoomPercent,
    spaceHeld,
    spacePanning,
    focusPattern,
    // Editing
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    activeTool,
    selectedColorId,
    customColor,
    selectedImageColor,
    previewColor,
    onSelectTool,
    onSelectColor,
    onSelectCustomColor,
    onSelectImageColor,
    selection,
    pasteProjectionActive,
    onCopy,
    onSelectLine,
    backOutOfSelect,
    previewCells,
    previewedMirrorAxisCounts,
    mirrorCurrentDimmedCells,
    endStroke,
    onCellPrimaryDown,
    onCellPrimaryMove,
    onCellSecondaryDown,
    onCellSecondaryMove,
    onCellHover,
    onHoverEnd,
    beadCursor,
    keyboardOnPattern,
    onPatternKeyboardFocus,
    onPatternKey,
    onPatternKeyUp,
    bindToolbox,
    ...rowOps,
    ...deleteAll,
    ...changeSize,
    ...replaceBead,
    ...importSwitch,
    ...exportFlow,
    onSave,
    ...overlays,
    shortcutsHelpOpen,
    // The decoder Convert image reads a picked picture with, for the components that take a file
    decodeImage: services.decodeImage,
  }
}

/** What the shell components draw on: the wiring's own return, so the two can't drift apart. */
export type AppShellContext = ReturnType<typeof wireAppShell>

const appShellKey: InjectionKey<AppShellContext> = Symbol('appShell')

/** Wires the app and shares it with every component below the caller; call once, from the root component's setup. */
export function provideAppShell(services: Services = browserServices): AppShellContext {
  const context = wireAppShell(services)
  provide(appShellKey, context)
  return context
}

/** The wired app, for a shell component: destructure what it draws on, and refs unwrap in its template as they always did in App.vue. */
export function useAppShell(): AppShellContext {
  const context = inject(appShellKey)
  if (!context) {
    throw new Error('useAppShell() needs provideAppShell() called by an ancestor')
  }
  return context
}
