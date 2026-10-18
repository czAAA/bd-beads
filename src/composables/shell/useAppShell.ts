import { computed, inject, provide, ref, watch, type InjectionKey } from 'vue'
import { beadColorAt, type CreateProjectInput } from '../../domain/project'
import { provideI18n } from '../../i18n/useI18n'
import { useThemePick } from '../../theme/useThemePick'
import { browserServices, type Services } from '../../services/index'
import { devicePreferencesKey } from '../../services/devicePreferences'
import type { GridPosition } from '../../domain/grid'
import { useMediaQuery } from '../ui/useMediaQuery'
import { selectionFrame, selectionHoldsAllBeads } from '../../domain/selection'
import type { FramePress } from '../../rendering/frameHandles'
import type { Tool } from '../../domain/tool'
import { rotationSwapsAxes } from '../../domain/grid'
import { gridAxisOfDirection } from '../../domain/mirror'
import { useAppShortcutTable } from './useAppShortcutTable'
import { usePageZoomLock } from './usePageZoomLock'
import { useViewportGuard } from './useViewportGuard'
import { usePenInputMode } from './usePenInputMode'
import { useProjectManageFlow } from '../project/useProjectManageFlow'
import { useA11yAnnouncer } from '../ui/useA11yAnnouncer'
import { useCanvasFraming } from '../canvas/useCanvasFraming'
import { useCanvasPointer } from '../canvas/useCanvasPointer'
import { useConvertImage } from '../import/useConvertImage'
import { useEdit } from '../project/useEdit'
import { useDeleteAllFlow } from '../project/useDeleteAllFlow'
import { useFrameFlow } from '../project/useFrameFlow'
import { useNamePieceFlow } from '../project/useNamePieceFlow'
import { useRemoveLineFlow } from '../project/useRemoveLineFlow'
import { useRotateSelectionFlow } from '../tools/useRotateSelectionFlow'
import { useRotateFrameFlow } from '../tools/useRotateFrameFlow'
import { useRotateCanvasFlow } from '../canvas/useRotateCanvasFlow'
import { hasOpenLayer } from '../ui/useOverlayLayer'
import { useExportFlow } from '../export/useExportFlow'
import { migrateLegacyMakerName } from '../../services/legacyMakerName'
import { useImportSwitchFlow } from '../import/useImportSwitchFlow'
import { useKeyboardCursor } from '../canvas/useKeyboardCursor'
import { useMirrorState } from '../tools/useMirrorState'
import { useNewProjectFlow } from '../project/useNewProjectFlow'
import { useOverlayVisibility } from './useOverlayVisibility'
import { useUpdatePrompt } from './useUpdatePrompt'
import { usePaintStroke } from '../tools/usePaintStroke'
import { usePinchPan } from '../canvas/usePinchPan'
import { useProjectLabels } from '../project/useProjectLabels'
import { useProjectLibrary } from '../project/useProjectLibrary'
import { useStorageAskFlow } from '../project/useStorageAskFlow'
import { useSavedProjectConfirms } from '../project/useSavedProjectConfirms'
import { useReplaceBeadFlow } from '../palette/useReplaceBeadFlow'
import { useRowOps } from '../project/useRowOps'
import { useSaveFlow } from '../export/useSaveFlow'
import { useSelectionGesture } from '../tools/useSelectionGesture'
import { useSettledProject } from '../project/useSettledProject'
import { useSaveOnPageHide } from '../project/useSaveOnPageHide'
import { useSpaceDragPan } from '../canvas/useSpaceDragPan'
import { useToasts } from '../ui/useToasts'
import { provideColorPick, provideMoveColor, provideRemoveAddedColor, useAddedColors } from '../tools/usePalette'
import { DEFAULT_PALETTE_COLOR_ID, useToolAndColor } from '../tools/useToolAndColor'
import { useToolPill } from '../tools/useToolPill'
import { useToolAtCursor } from '../tools/useToolAtCursor'
import { provideTourFormReset, useTour } from '../tour/useTour'
import { useUndoHistory } from '../project/useUndoHistory'

// The app's composition root (ADR 0020): wires every composable the shell uses into one flat context; nothing here
// decides anything. Deps are lazy arrows so composables can reference each other. Call once from the root setup (see
// provideAppShell).
function wireAppShell(services: Services) {
  const { t, locale } = provideI18n(services.devicePreferences)
  // The theme pick is shared by the header's controls; this is where it is first read, from this device's preferences.
  useThemePick(services.devicePreferences)

  /** Asking the browser to keep the library, at a device's first save (ticket 399). */
  const storageAsk = useStorageAskFlow({
    persistentStorage: services.persistentStorage,
    devicePreferences: services.devicePreferences,
  })

  // Temporary (ADR 0060): the device-wide Maker's name moves onto the Projects before they are read; ticket 391 removes
  // it.
  migrateLegacyMakerName(services.libraryStore)

  // The Project library and persistence (ticket 55, ADR 0012): replaceProject is the single commit point for the open
  // Project and saves as it lands; a dragged stroke defers its save per cell and writes once at the end (see
  // usePaintStroke).
  const {
    projects,
    activeProjectId,
    activeProject,
    saveFailed,
    unsaved,
    addProject,
    addProjects,
    replaceProject,
    removeProject,
    removeAllProjects,
    flushPendingSave,
    saveNow,
  } = useProjectLibrary(services.libraryStore, storageAsk.onLibrarySaved)

  const currentProject = () => activeProject.value
  const messages = () => t.value
  const currentLocale = () => locale.value

  const { activeBeadLabel, projectLabel } = useProjectLabels({ currentProject, messages, locale: currentLocale })

  /** Short-lived results, shown as toasts in the canvas box (ticket 76). */
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts()

  /** "Update ready", once a newer version has downloaded behind the open page (ticket 69). */
  useUpdatePrompt({ updates: services.appUpdates, messages, showToast })

  /** Save and its "Saved" confirmation (tickets 115, 119, 195). */
  const { onSave, clearSavedConfirmation } = useSaveFlow({
    currentProject,
    saveNow,
    messages,
    showToast,
    dismissToast,
    downloadFile: services.downloadFile,
  })

  // Convert image's framing step (ticket 58, ADR 0010): independent of the open Project, so nothing here touches
  // replaceProject, undo, Mirror or the Row lock; framing over an open Project takes the canvas panel over until
  // Cancel.
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

  /** New-Project creation, blank or from Convert image, and the framing step's gate (tickets 58, 196). */
  const { framing, newProjectDraft, onNewProjectDraft, onCreateProject, onConvertImageCreate } = useNewProjectFlow({
    addProject,
    convertImage: () => convertImageSource.value,
    cancelConvertImage,
  })

  /** The Rulers toggle (R, the canvas strip's button): on by default and kept on the device. */
  const showRulers = services.devicePreferences.get('rulers')
  const toggleRulers = () => void (showRulers.value = !showRulers.value)
  const rowHighlight = services.devicePreferences.get('rowHighlight')
  const toggleRowHighlight = () => void (rowHighlight.value = !rowHighlight.value)

  /** The input mode toggle (tickets 325, 326): offered once a pen has been seen. */
  const { inputMode, inputModeAvailable, setInputMode, surfaceInputMode } = usePenInputMode(services.devicePreferences)

  /** Canvas sizing, zoom and the strip's size/zoom meta (tickets 27, 57, 197). */
  const { bindCanvasArea, canvasAreaWidth, zoom, scroll, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, reveal, centreOn, zoomPercent, stripZoomPercent } =
    useCanvasFraming({
      currentProject,
      framing: () => framing.value,
      convertZoomPercent: () => convertZoomPercent.value,
    })

  /** Undo/redo history and the commit/step logic around it (ticket 189). Its deps reach for Mirror and Selection
   * state declared below, through lazy arrows only called at runtime. */
  const {
    canUndo,
    canRedo,
    record: recordHistory,
    reset: resetHistory,
    onUndo: undoStep,
    onRedo,
  } = useUndoHistory({
    currentProject,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    restore: (snapshot) => editing.restore(snapshot),
  })

  /** Every undoable change to the open Project (ADR 0036), and the session resets it runs. Its deps reach for Mirror
   * and Selection state declared below, through lazy arrows only called at runtime. */
  const editing = useEdit({
    currentProject,
    replaceProject,
    recordHistory,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    restoreMirrorAxisCounts: (counts) => restoreMirrorAxisCounts(counts),
    resetAfterFrameChange: () => {
      clearMirrorAxisCounts()
      clearSelectionAndHover()
    },
    flushPendingSave,
  })
  const { edit } = editing

  // Mirror's session state (ticket 62): ticket 174 hid its UI, so only the bookkeeping a Frame change and Project
  // switch need remains; axis counts stay at NO_MIRROR_AXES, which keeps paint/fill/erase's live-mirror calls inert.
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
  } = useMirrorState(currentProject, edit)

  /** -/=/[/] (ADR 0006): steps the Left–right or Top–bottom axis count as seen on screen; a quarter turn swaps which
   * grid-space axis each drives. */
  function onStepMirrorAxis(direction: 'leftRight' | 'topBottom', delta: number) {
    const project = currentProject()
    if (!project) {
      return
    }

    const axis = gridAxisOfDirection(direction, rotationSwapsAxes(project.rotation))
    onSetMirrorAxisCount(axis, mirrorAxisCounts.value[axis] + delta)
  }

  /** The Select tool's whole gesture (ticket 63): the Selection, the in-session clipboard, the in-progress press and
   * the Select-tool paste preview. Only ever called into while Select is the active tool, or from a command that
   * isn't tied to a tool. */
  const {
    selection,
    refusals: selectionRefusals,
    refuse: refuseSelection,
    beginPress: beginSelectPress,
    extendPress: extendSelection,
    endPress: endSelectPress,
    cancel: backOutOfSelect,
    leaveSelectTool,
    copy: copySelected,
    pasteAt: pasteAtGesture,
    deleteSelection: onEmptySelection,
    cut: cutSelected,
    armPaste,
    dismissPaste: leavePasteMode,
    fill: fillSelection,
    tapPiece,
    selectAll: selectAllBeads,
    beginAdjust,
    dragAdjust,
    endAdjust,
    pastePreviewCells,
    clearSelection: resetSelection,
    pasteProjectionActive,
    hasClipboard,
  } = useSelectionGesture(currentProject, edit, () => mirrorAxisCounts.value, () => mirrorCopyMode.value)

  /** Touch has no Escape or right-click, so Undo and a second tap on Select leave paste mode there (ticket 437, ADR
   * 0057). */
  const touch = useMediaQuery('(pointer: coarse)')

  /** Undo, which on touch also leaves paste mode. */
  function onUndo() {
    if (touch.value) leavePasteMode()
    undoStep()
  }

  /** A Selection (or hover) that no longer fits after a step or a size change changed the grid. */
  function clearSelectionAndHover() {
    resetSelection()
    hoveredCell.value = undefined
  }

  /** The Palette: the built-in colors and the Custom colors that joined it, kept on the device (ticket 227). */
  const { palette, addedCount, addUsed, removeAdded, moveColor } = useAddedColors(services.addedColorsStore)

  /** The active tool and which of the two paint colors is chosen (tickets 58, 171, 206). */
  const {
    activeTool,
    selectedColorId,
    customColor,
    selectedColorHex,
    previewColor,
    onSelectTool: selectTool,
    onSelectColor,
    onSelectCustomColor: selectCustomColor,
    onCustomColorAdded,
  } = useToolAndColor({ leaveSelectTool, palette: () => palette.value })

  /** Where the Tool pill is docked, what its colour control shows and the recent colours (ticket 439, ADR 0059). */
  const toolPill = useToolPill({
    preferences: services.devicePreferences,
    selectedColorHex,
    palette: () => palette.value,
    onSelectColor,
    onSelectCustomColor: (hex) => onSelectCustomColor(hex),
  })

  /** Whether Pick color from canvas is on (ticket 398); see pickColorAt. */
  const pickingColor = ref(false)

  // Choosing a tool. The Eraser clears an existing Selection first (ticket 313), like Del under Select, so Select all
  // asks for Delete all's confirmation (ticket 415); leaving Select drops the Selection, as for every other tool.
  function onSelectTool(tool: Tool) {
    pickingColor.value = false
    // Another tool leaves paste mode (Piece included, which leaveSelectTool spares); a second tap on Select does on
    // touch.
    if (tool !== 'select' || (touch.value && activeTool.value === 'select')) leavePasteMode()
    if (tool === 'erase' && selection.value) {
      onClearSelection()
    }
    selectTool(tool)
  }

  /** Clear selection (Del, ticket 415): one Undo step. A Selection of every placed bead (Select all) is Delete all
   * instead, via its confirmation, so no finished row remains. */
  function onClearSelection() {
    const project = currentProject()
    const current = selection.value
    if (!project || !current) return
    if (selectionHoldsAllBeads(project.beads, current)) deleteAll.onRequestDeleteAll()
    else onEmptySelection()
  }

  /** Fill (ticket 415): the Selection takes the current color; nothing with no color chosen. */
  /** Whether a color is chosen to paint with: Fill needs one (ticket 415). */
  function hasPaintColor() {
    return selectedColorHex() !== undefined
  }

  function onFillSelection() {
    const color = selectedColorHex()
    if (color) fillSelection(color)
  }

  /** Frame from a Selection (ticket 415): the Frame becomes the Selection's rectangle. */
  function onFrameFromSelection() {
    if (selection.value) frameFlow.setTo(selectionFrame(selection.value))
  }

  /** Copy (ticket 437, ADR 0057): keeps the drawn beads, clears the Selection and arms paste mode under Select; a
   * Selection with no drawn bead says so. */
  function onCopy() {
    if (copySelected()) selectTool('select')
    else showToast('copy-nothing', t.value.tools.copyNothingMessage, 'info')
  }

  /** Cut (tickets 415, 447): copies and empties the Selection, then, as Copy does, arms paste mode under Select. */
  function onCut() {
    if (cutSelected()) selectTool('select')
  }

  /** The Paste tool and the Selection bar's Paste button (ticket 447): paste mode under Select, nothing stamped. */
  function onPasteMode() {
    if (armPaste()) selectTool('select')
  }

  /** Ctrl/Cmd+V (ticket 92) pastes at the pointer and, like Copy, leaves paste mode on under Select (ADR 0057). */
  function pasteAtCell(cell: GridPosition | undefined): boolean {
    if (!pasteAtGesture(cell)) return false
    selectTool('select')
    return true
  }

  /** Select all (ticket 414): selects the rectangle round every bead and makes Select the active tool, so the
   * Selection can be copied, cut or resized at once. Nothing on an empty canvas. */
  function onSelectAll() {
    if (!selectAllBeads()) return
    // Select and Piece share a Selection, so switching to Select keeps the one just made.
    onSelectTool('select')
  }

  /** The Selection's handles or inside were pressed (ticket 414): the active tool decides what a tap inside does. */
  function onSelectionPress(target: FramePress, cell: GridPosition) {
    beginAdjust(target, cell, activeTool.value === 'piece' ? 'piece' : 'select')
  }

  /** An added swatch is removed (ticket 228): painted cells keep their hex. Removing the active one steps back to
   * the default color; a toast offers Undo. */
  function onRemoveAddedColor(colorId: string) {
    const wasSelected = selectedColorId.value === colorId
    const restore = removeAdded(colorId)
    if (!restore) return
    if (wasSelected) onSelectColor(DEFAULT_PALETTE_COLOR_ID)
    // One toast per swatch, so removing a second doesn't take the first one's Undo away.
    showToast(`palette-removed-${colorId}`, t.value.palette.removed, 'info', {
      label: t.value.palette.undoButton,
      run: () => {
        // Selected again only if nothing else was chosen since.
        if (restore() && wasSelected && selectedColorId.value === DEFAULT_PALETTE_COLOR_ID) onSelectColor(colorId)
      },
    })
  }

  /** The added swatch whose removal awaits confirmation (ticket 304); undefined when no such dialog is open. */
  const pendingColorRemovalId = ref<string>()
  const pendingColorRemovalHex = computed(() => palette.value.find((color) => color.id === pendingColorRemovalId.value)?.hex)
  function onRequestRemoveAddedColor(colorId: string) {
    pendingColorRemovalId.value = colorId
  }
  function onCancelRemoveAddedColor() {
    pendingColorRemovalId.value = undefined
  }
  function onConfirmRemoveAddedColor() {
    const colorId = pendingColorRemovalId.value
    pendingColorRemovalId.value = undefined
    if (colorId) onRemoveAddedColor(colorId)
  }
  provideRemoveAddedColor(onRequestRemoveAddedColor)
  provideMoveColor(moveColor)

  /** A Custom color that has just painted a cell joins the Palette on its first use (ticket 227); at the limit it
   * still paints, and the user is told once per color. */
  let limitToldFor: string | undefined
  function onPaintColorUsed(hex: string) {
    if (selectedColorId.value) return
    const { outcome, colorId } = addUsed(hex)
    if (outcome === 'added' && colorId) {
      onCustomColorAdded(colorId)
    } else if (outcome === 'full' && limitToldFor !== hex) {
      limitToldFor = hex
      showToast('palette-full', t.value.palette.limitReached, 'info')
    }
  }

  /** A Custom color was picked (ticket 398): it becomes the paint color and, with a slot free, joins the Palette at
   * once. */
  function onSelectCustomColor(hex: string) {
    selectCustomColor(hex)
    onPaintColorUsed(hex)
  }

  /** Pick color from canvas (ticket 398): the next press on a bead takes its color (an empty cell does nothing); a
   * tool choice or Escape ends it. */
  function pickColorAt(row: number, column: number): boolean {
    if (!pickingColor.value) return false
    const project = currentProject()
    const hex = project ? beadColorAt(project, row, column) : null
    if (hex) {
      pickingColor.value = false
      onSelectCustomColor(hex)
    }
    return true
  }
  provideColorPick({ picking: pickingColor, toggle: () => (pickingColor.value = !pickingColor.value) })

  /** A Paint-tool drag (ticket 24): the stroke lifecycle and its one undo step and one save (ticket 190). strokeMode
   * is 'paint'/'erase' while a stroke is in progress, else null. */
  const { strokeMode, endStroke, cancelStroke, paintStrokeCell, beginOrCommitPress } = usePaintStroke({
    currentProject,
    edit: editing,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    mirrorCopyMode: () => mirrorCopyMode.value,
    activeTool: () => activeTool.value,
    endSelectPress,
  })

  /** The open Project for what only summarises it: it follows a stroke a few times a second, and is exact when the
   * stroke ends. */
  const settledProject = useSettledProject(currentProject, () => strokeMode.value !== null)

  /** The canvas panel's horizontal scroller (ticket 95), which Space+drag scrolls sideways; vertical panning scrolls
   * the window, as nothing traps vertical overflow. */
  const canvasScrollEl = ref<HTMLElement | null>(null)
  const { spaceHeld, panning: spacePanning } = useSpaceDragPan(panBy)

  /** A template function ref for the canvas panel's scroller, so the element stays the wiring's own rather than a
   * name the panel has to declare. */
  function bindCanvasScroll(el: unknown) {
    canvasScrollEl.value = el instanceof HTMLElement ? el : null
  }

  /** Two fingers on the Project pinch to zoom and pan it (ticket 79); the one-finger paint stroke in progress is
   * taken back when the second lands. */
  usePinchPan(canvasScrollEl, { zoom: () => zoom.value, setZoom, panBy, cancelStroke: () => cancelStroke() })

  /** Mouse, touch and pen input on the Project (tickets 22-25, 31, 33, 92, 95, 176, 206). */
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
    currentProject,
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
    tapPiece,
    beginOrCommitPress: (mode, color, row, column) => {
      beginOrCommitPress(mode, color, row, column)
      if (mode === 'paint' && color) onPaintColorUsed(color)
    },
    paintStrokeCell,
    pasteAt: pasteAtCell,
    pickColorAt,
  })

  /** Painting with the keyboard (tickets 159, 194): the announcer needs the cursor and the cursor the announcer, so
   * the announcer reads the cursor lazily. */
  const { announcement, announce, announceCursor, colorWords } = useA11yAnnouncer({
    messages,
    currentProject,
    beadCursor: () => beadCursor.value,
  })

  const { invokeToolAt, extendSelectionTo, finishExtending } = useToolAtCursor({
    messages,
    currentProject,
    activeTool: () => activeTool.value,
    selectedColorHex,
    pressCell: onCellPrimaryDown,
    endStroke,
    beginSelectPress,
    leavePasteMode,
    extendSelection,
    refuseSelection,
    announce,
    colorWords,
  })

  const { beadCursor, cursorShown, onProjectKeyboardFocus, onProjectKey, onProjectKeyUp } = useKeyboardCursor({
    currentProject,
    reveal,
    hasSelection: () => !!selection.value,
    onCellHover,
    onHoverEnd,
    announceCursor,
    invokeToolAt,
    extendSelectionTo,
    finishExtending,
  })

  /** Delete all and its confirmation (tickets 42, 198). */
  const deleteAll = useDeleteAllFlow({ currentProject, edit })

  /** Edit Frame: moving and resizing the Frame and stepping its edges, Fit to drawing and Remove Frame (tickets 233,
   * 417). */
  const frameFlow = useFrameFlow({
    currentProject,
    edit,
    announce,
    showToast,
    messages,
    centreOn,
  })
  /** The edit toggle on the Frame's margin outline (ticket 452, ADR 0062). */
  const editFrame = frameFlow.toggleEdit

  /** Rotate: the Selection a quarter turn, with a Message saying how many beads it covered (ticket 416, ADR 0052). */
  const rotateFlow = useRotateSelectionFlow({
    edit,
    currentProject,
    selection,
    announce,
    showToast,
    onUndo,
    messages,
    locale: currentLocale,
  })

  /** Rotate Frame: the Frame, its margin and the beads inside a quarter turn, one Undo step (ticket 471, ADR 0063). */
  const rotateFrameFlow = useRotateFrameFlow({
    edit,
    currentProject,
    announce,
    showToast,
    onUndo,
    messages,
    locale: currentLocale,
  })

  /** Rotate canvas: the picture a quarter turn, saved but no Undo step (ticket 471, ADR 0063). */
  const rotateCanvasFlow = useRotateCanvasFlow({ currentProject, replaceProject, announce, messages })

  /** Remove line: the selected whole row or column of the Frame, as one undo step (tickets 123, 199, 233). */
  const removeLine = useRemoveLineFlow({
    currentProject,
    edit,
    selection: () => selection.value,
  })

  /** Name Piece: the dialog that gives the selected Piece a name, which makes it a Schema (ticket 406). */
  const namePiece = useNamePieceFlow({
    currentProject,
    edit,
    selection: () => selection.value,
  })

  /** Replace Bead, its select and its confirmation (tickets 48, 113, 205). */
  const replaceBead = useReplaceBeadFlow({ currentProject, edit, messages, locale: currentLocale })

  /** Project import and the keep-current / save-and-switch / switch decision (tickets 154, 168, 200). */
  const importSwitch = useImportSwitchFlow({
    currentProject,
    addProjects,
    openProject: (id) => {
      activeProjectId.value = id
    },
    saveNow,
    showToast,
  })

  /** Exporting as a file, PNG or PDF, and the maker's name they print (tickets 68, 73, 74, 158, 161, 202). */
  const exportFlow = useExportFlow({
    currentProject,
    projects: () => projects.value,
    messages,
    locale: currentLocale,
    downloadFile: services.downloadFile,
    replaceProject,
    showToast,
  })

  /** Rotate and the Row progress controls; none is an undo step (tickets 32, 171, 201). */
  const rowOps = useRowOps({ currentProject, replaceProject, showToast, messages })

  /** The deferred save's safety net (see useSaveOnPageHide). */
  useSaveOnPageHide(flushPendingSave)

  function onSelectProject(id: string) {
    activeProjectId.value = id
  }

  function onNewProject() {
    activeProjectId.value = undefined
  }

  /** Saved Projects asks before removing a thumbnail's Project or switching to it (ticket 232). */
  const savedProjectConfirms = useSavedProjectConfirms({
    currentProject,
    findProject: (id) => projects.value.find((project) => project.id === id),
    openProject: onSelectProject,
    removeProject,
    saveNow,
  })

  /** Rename, Duplicate and Delete for the open Project, from the Project panel (spec 0440, ticket 443). */
  const manageProject = useProjectManageFlow({
    currentProject,
    projects: () => projects.value,
    replaceProject,
    addProject,
    removeProject,
    removeAllProjects,
    closeProject: onNewProject,
  })

  /** The Drawer and the phone tier's sheets (tickets 79, 168, 188, 204). */
  const overlays = useOverlayVisibility({ selectProject: savedProjectConfirms.onRequestSwitch })
  // Menu, Project and the Frame bar are one panel at a time (ticket 475).
  watch(overlays.openPhoneSheet, (sheet) => {
    if (sheet) frameFlow.closeEdit()
  })
  watch(frameFlow.editOn, (open) => {
    if (open) overlays.openPhoneSheet.value = null
  })

  /** Whether the `?` shortcuts help overlay (ticket 96) is open: a single boolean with no logic, so it stays here. */
  const shortcutsHelpOpen = ref(false)

  /** The Tour (ticket 80): walks this editor through the same commit paths; needs whether the Project is open to
   * drawing and Create's hand-off. Dim layer: TourLayer. */
  const tour = useTour({
    store: services.tourStore,
    currentProject,
    hasProject: (id) => projects.value.some((project) => project.id === id),
    openProject: onSelectProject,
    openNewProjectForm: onNewProject,
    activeTool: () => activeTool.value,
    selectedColorId: () => selectedColorId.value,
    selection: () => selection.value,
    pasteArmed: () => pasteProjectionActive.value,
    edit,
    replaceProject,
    undo: onUndo,
    clearSelection: clearSelectionAndHover,
    draftName: () => newProjectDraft.value?.name,
    createProject: onCreateProject,
    showToast,
    messages,
  })
  provideTourFormReset(tour.formResetTick)

  /** While the Tour points somewhere other than the Project, the Project only scrolls and zooms: nothing on it
   * draws. */
  function unlessTourLocks<Args extends unknown[]>(handler: (...args: Args) => void) {
    return (...args: Args) => {
      if (!tour.canvasLocked.value) {
        handler(...args)
      }
    }
  }

  usePageZoomLock()
  useViewportGuard()
  useAppShortcutTable({
    activeProject: currentProject,
    activeTool: () => activeTool.value,
    hasSelection: () => !!selection.value,
    canUndo: () => canUndo.value,
    canRedo: () => canRedo.value,
    hasClipboard,
    addedColorCount: () => addedCount.value,
    paletteColorIdAt: (slot) => palette.value[slot]?.id,
    cancelColorPick: () => {
      const was = pickingColor.value
      pickingColor.value = false
      return was
    },
    hasOpenLayer,
    anyDialogOpen: () =>
      deleteAll.deleteAllConfirmOpen.value ||
      frameFlow.removeConfirmOpen.value ||
      !!pendingColorRemovalId.value ||
      !!replaceBead.replaceBeadPendingBead.value ||
      !!importSwitch.pendingImport.value ||
      !!savedProjectConfirms.pendingRemove.value ||
      !!savedProjectConfirms.pendingSwitch.value ||
      manageProject.duplicating.value !== undefined ||
      manageProject.deleting.value ||
      manageProject.deletingAll.value ||
      storageAsk.storageNoteOpen.value ||
      shortcutsHelpOpen.value,
    backOutOfSelect,
    onUndo,
    onRedo,
    onSelectTool,
    onSelectAll,
    onSelectColor,
    onClearSelection,
    onCut,
    onPasteMode,
    onFillSelection,
    onFrameFromSelection,
    onToggleRulers: toggleRulers,
    onToggleRowHighlight: toggleRowHighlight,
    onEditFrame: editFrame,
    onCopy,
    pasteAtPointer,
    onSave,
    onRotate: rotateFlow.onRotate,
    canRemoveSelectedLine: () => removeLine.canRemoveSelectedLine.value,
    onRemoveSelectedLine: removeLine.onRemoveSelectedLine,
    canNamePiece: () => namePiece.canNamePiece.value,
    hasPaintColor,
    onNamePiece: namePiece.onNamePiece,
    onToggleRowDirection: rowOps.onToggleRowDirection,
    onMoveRow: rowOps.onMoveRow,
    onResetProgress: rowOps.onResetProgress,
    onStepMirrorAxis,
    onToggleMirrorCopyMode,
    onMirrorCurrent,
    onZoomIn: () => zoomIn(),
    onZoomOut: () => zoomOut(),
    onFit: resetZoom,
    openShortcutsHelp: () => {
      shortcutsHelpOpen.value = true
    },
  })

  /** Skip to Project: moves keyboard focus straight onto the Project. */
  function focusProject() {
    canvasScrollEl.value?.querySelector<HTMLElement>('[data-testid="project-surface"]')?.focus()
  }

  watch(activeProjectId, () => {
    resetHistory()
    // Selection resets here through the module's reset(); the clipboard deliberately survives a Project switch
    // (ticket 92, ADR 0016), unlike Undo/Redo history and Selection.
    resetSelection()
    // Mirror's session state is an editing-session setting, reset on a Project switch (ticket 44/45 decision) --
    // through this single reset point, per the ticket 62 decision, rather than a watcher of its own.
    resetMirrorState()
    deleteAll.onCancelDeleteAll()
    frameFlow.cancelRemove()
    replaceBead.onCancelReplaceBead()
    clearSavedConfirmation()
    pickingColor.value = false
  })

  return {
    t,
    locale,
    // The library
    projects,
    activeProjectId,
    activeProject,
    saveFailed,
    unsaved,
    ...savedProjectConfirms,
    ...manageProject,
    onNewProject,
    activeBeadLabel,
    projectLabel,
    settledProject,
    // Notices
    toasts,
    dismissToast,
    announcement,
    announce,
    // Creating a Project, and framing a picture for one
    framing,
    onNewProjectDraft,
    onCreateProject: (payload: CreateProjectInput) => onCreateProject(tour.normalizeCreate(payload)),
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
    scroll,
    showRulers,
    toggleRulers,
    rowHighlight,
    toggleRowHighlight,
    inputMode,
    setInputMode,
    inputModeAvailable,
    surfaceInputMode,
    panBy,
    scrollBy,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomPercent,
    stripZoomPercent,
    spaceHeld,
    spacePanning,
    focusProject,
    // Editing
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    activeTool,
    selectedColorId,
    customColor,
    previewColor,
    onSelectTool,
    onSelectAll,
    onSelectColor,
    onSelectCustomColor,
    ...toolPill,
    selectedColorHex,
    selection,
    onSelectionPress,
    onSelectionDrag: dragAdjust,
    onSelectionRelease: endAdjust,
    pasteProjectionActive,
    hasClipboard,
    onCopy,
    onCut,
    onPasteMode,
    onClearSelection,
    onFillSelection,
    hasPaintColor,
    onFrameFromSelection,
    selectionRefusals,
    backOutOfSelect,
    previewCells,
    previewedMirrorAxisCounts,
    mirrorCurrentDimmedCells,
    mirrorAxisCounts,
    mirrorCopyMode,
    onSetMirrorAxisCount,
    onToggleMirrorCopyMode,
    onMirrorCurrent,
    onMirrorCurrentHover,
    endStroke,
    onCellPrimaryDown: unlessTourLocks(onCellPrimaryDown),
    onCellPrimaryMove: unlessTourLocks(onCellPrimaryMove),
    onCellSecondaryDown: unlessTourLocks(onCellSecondaryDown),
    onCellSecondaryMove: unlessTourLocks(onCellSecondaryMove),
    onCellHover,
    onHoverEnd,
    beadCursor,
    cursorShown,
    onProjectKeyboardFocus,
    onProjectKey: unlessTourLocks(onProjectKey),
    onProjectKeyUp,
    tour,
    ...rowOps,
    onRotate: rotateFlow.onRotate,
    onRotateFrame: rotateFrameFlow.onRotateFrame,
    onRotateCanvas: rotateCanvasFlow.onRotateCanvas,
    ...deleteAll,
    pendingColorRemovalHex,
    onCancelRemoveAddedColor,
    onConfirmRemoveAddedColor,
    ...removeLine,
    settingFrame: frameFlow.settingFrame,
    frameBarShown: frameFlow.barShown,
    frameBarOpen: frameFlow.editOn,
    frameBarFrom: frameFlow.barFrom,
    frameDraftProject: frameFlow.draftProject,
    frameLocked: frameFlow.frameLocked,
    onEditFrame: editFrame,
    onCloseFrameBar: frameFlow.closeEdit,
    onFrameKey: (event: KeyboardEvent) => {
      if (frameFlow.onKey(event)) event.preventDefault()
    },
    onFramePress: frameFlow.press,
    onFrameDrag: frameFlow.drag,
    onFrameRelease: frameFlow.release,
    onFrameCancel: frameFlow.cancel,
    onStepFrameEdge: frameFlow.stepEdge,
    onResizeFrame: frameFlow.resizeTo,
    onSetTechnique: frameFlow.setTechnique,
    onSetBrickBlock: frameFlow.setBrickBlock,
    onFitFrame: frameFlow.fit,
    onRemoveFrame: frameFlow.remove,
    removeFrameConfirmOpen: frameFlow.removeConfirmOpen,
    onCancelRemoveFrame: frameFlow.cancelRemove,
    onConfirmRemoveFrame: frameFlow.confirmRemove,
    onBringFrameIntoView: frameFlow.bringIntoView,
    ...replaceBead,
    ...importSwitch,
    ...storageAsk,
    ...exportFlow,
    ...namePiece,
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
  provide(devicePreferencesKey, services.devicePreferences)
  return context
}

/** The wired app, for a shell component: destructure what it draws on, and refs unwrap in its template as they
 * always did in App.vue. */
export function useAppShell(): AppShellContext {
  const context = inject(appShellKey)
  if (!context) {
    throw new Error('useAppShell() needs provideAppShell() called by an ancestor')
  }
  return context
}
