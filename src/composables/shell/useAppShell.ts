import { computed, inject, provide, ref, watch, type InjectionKey } from 'vue'
import { beadColorAt } from '../../domain/project'
import { provideI18n } from '../../i18n/useI18n'
import { changedSetting } from '../../domain/frameKind'
import { plural } from '../../i18n/plural'
import { useThemePick } from '../../theme/useThemePick'
import { browserServices, type Services } from '../../services/index'
import { devicePreferencesKey } from '../../services/devicePreferences'
import type { GridPosition } from '../../domain/grid'
import { useMediaQuery } from '../ui/useMediaQuery'
import { shownBeads, type Layer } from '../../domain/layers'
import { copyLayerSelection, selectionFrame, selectionHoldsAllBeads } from '../../domain/selection'
import type { FramePress } from '../../rendering/frameHandles'
import type { Tool } from '../../domain/tool'
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
import { useBeadShapeFlow } from '../project/useBeadShapeFlow'
import { useExportFlow } from '../export/useExportFlow'
import { migrateLegacyMakerName } from '../../services/legacyMakerName'
import { useImportSwitchFlow } from '../import/useImportSwitchFlow'
import { useNewProjectFlow } from '../project/useNewProjectFlow'
import type { OpenPanel } from './openPanel'
import { useOverlayVisibility } from './useOverlayVisibility'
import { useUpdatePrompt } from './useUpdatePrompt'
import { usePaintStroke } from '../tools/usePaintStroke'
import { usePinchPan } from '../canvas/usePinchPan'
import { useProjectLabels } from '../project/useProjectLabels'
import { useProjectLibrary } from '../project/useProjectLibrary'
import { useStorageAskFlow } from '../project/useStorageAskFlow'
import { useSavedProjectConfirms } from '../project/useSavedProjectConfirms'
import { useRemoveColorFlow } from '../palette/useRemoveColorFlow'
import { useReplaceBeadFlow } from '../palette/useReplaceBeadFlow'
import { useRowOps } from '../project/useRowOps'
import { useSelectionGesture } from '../tools/useSelectionGesture'
import { useSettledProject } from '../project/useSettledProject'
import { useSaveOnPageHide } from '../project/useSaveOnPageHide'
import { useSpaceDragPan } from '../canvas/useSpaceDragPan'
import { useToasts } from '../ui/useToasts'
import { provideBeadColors, useBeadColors } from '../palette/useBeadColors'
import { provideColorPick, provideMoveColor, provideRemoveAddedColor, provideRemoveAllAddedColors, useProjectPalette } from '../tools/usePalette'
import { useToolAndColor } from '../tools/useToolAndColor'
import { useToolPill } from '../tools/useToolPill'
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

  // Convert image's framing step (ticket 58, ADR 0010): independent of the open Project, so nothing here touches
  // replaceProject, undo or the Row lock; framing over an open Project takes the canvas panel over until
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
  const { framing, onNewProjectDraft, onCreateProject, onCreateFromStarter, onConvertImageCreate } = useNewProjectFlow({
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
  const { inputMode, inputModeAvailable, setInputMode, surfaceInputMode, handedness, setHandedness } = usePenInputMode(services.devicePreferences)

  /** Canvas sizing, zoom and the strip's size/zoom meta (tickets 27, 57, 197). */
  const { bindCanvasArea, canvasAreaWidth, zoom, scroll, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, centreOn, visibleCentre, zoomPercent, stripZoomPercent } =
    useCanvasFraming({
      currentProject,
      framing: () => framing.value,
      convertZoomPercent: () => convertZoomPercent.value,
    })

  /** Undo/redo history and the commit/step logic around it (ticket 189). Its deps reach for Selection
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
    restore: (snapshot) => editing.restore(snapshot),
  })

  /** Every undoable change to the open Project (ADR 0036), and the session resets it runs. Its deps reach for Selection
   * state declared below, through lazy arrows only called at runtime. */
  const editing = useEdit({
    currentProject,
    replaceProject,
    recordHistory,
    resetAfterFrameChange: () => {
      clearSelectionAndHover()
    },
    flushPendingSave,
  })
  const { edit } = editing

  /** The Select tool's whole gesture (ticket 63): the Selection, the in-session clipboard, the in-progress press and
   * the Select-tool paste preview. Only ever called into while Select is the active tool, or from a command that
   * isn't tied to a tool. */
  const {
    selection,
    refusals: selectionRefusals,
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
  } = useSelectionGesture(
    currentProject,
    edit,
    (count, loss) => showToast('paste-clipped', plural(locale.value, count, loss === 'shape' ? t.value.tools.droppedOnShapeMessage : t.value.tools.pasteClippedMessage), 'info'),
  )

  /** Touch has no Escape, so Undo and a second tap on Select leave paste mode there (ticket 437, ADR
   * 0016). */
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

  /** The Palette: the open Project's built-in colors and the Custom colors that joined it (ticket 0525). */
  const { palette, addUsed, removeAdded, removeAllAdded, moveColor } = useProjectPalette({ currentProject, edit })
  provideBeadColors(useBeadColors({ currentProject, palette, addUsed }))

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

  /** Where the Tool pill is docked, what its colour control shows and the recent colours (ticket 439, ADR 0046). */
  const toolPill = useToolPill({
    preferences: services.devicePreferences,
    selectedColorHex,
    palette: () => palette.value,
    onSelectColor,
    onSelectCustomColor: (hex) => onSelectCustomColor(hex),
  })

  /** Whether Pick color from canvas is on (ticket 398); see pickColorAt. */
  const pickingColor = ref(false)

  /** Whether the next Selection becomes the Frame (ticket 568): armed by the Frame panel's Select a frame, ended by the
   * Selection being made, Escape or another tool. */
  const selectingFrame = ref(false)

  // Choosing a tool. The Eraser clears an existing Selection first (ticket 313), like Del under Select, so Select all
  // asks for Delete all's confirmation (ticket 415); leaving Select drops the Selection, as for every other tool.
  function onSelectTool(tool: Tool) {
    pickingColor.value = false
    selectingFrame.value = false
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
    if (selectionHoldsAllBeads(shownBeads(project), current)) deleteAll.onRequestDeleteAll()
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

  /** Select a frame (ticket 568): Select is the tool, and the Selection the next drag makes is framed on release. */
  function onSelectFrame() {
    onSelectTool('select')
    selectingFrame.value = true
    showToast('select-frame', t.value.frame.selectFrameHint, 'info')
  }

  /** The end of a Select press: when the drag was made to set the Frame, the Frame is set to it. */
  function endSelectPressFraming() {
    endSelectPress()
    if (!selectingFrame.value || !selection.value) return
    selectingFrame.value = false
    onFrameFromSelection()
    resetSelection()
  }

  /** Escape under Select: ends the framing drag too, which counts as the key being used. */
  function backOutOfSelectOrFraming(): boolean {
    const was = selectingFrame.value
    selectingFrame.value = false
    return backOutOfSelect() || was
  }

  /** Copy (ticket 437, ADR 0016): keeps the drawn beads, clears the Selection and arms paste mode under Select; with
   * no drawn bead the bar's button is disabled and the shortcut does nothing (ticket 499). */
  function onCopy() {
    if (copySelected()) selectTool('select')
  }

  /** Cut (tickets 415, 447): copies and empties the Selection, then, as Copy does, arms paste mode under Select. */
  function onCut() {
    if (cutSelected()) selectTool('select')
  }

  /** The Paste tool and the Selection bar's Paste button (ticket 447): paste mode under Select, nothing stamped. */
  function onPasteMode() {
    if (armPaste()) selectTool('select')
  }

  /** Ctrl/Cmd+V (ticket 92) pastes at the pointer and, like Copy, leaves paste mode on under Select (ADR 0016). */
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

  /** Removing added colors from the Palette, one or all, each after a confirmation (tickets 228, 304, 0532). */
  const removeColor = useRemoveColorFlow({ palette, removeAdded, removeAllAdded, selectedColorId, onSelectColor, showToast, messages, locale: currentLocale })
  provideRemoveAddedColor(removeColor.onRequestRemoveAddedColor)
  provideRemoveAllAddedColors(removeColor.onRequestRemoveAllAddedColors)

  /** The question before a Custom frame's setting drops painted beads (tickets 0592, 0593, 0597), in that setting's
   * words: how many the outer rounds, last rows or strands' ends would take with them. */
  const sizeConfirm = computed(() => {
    const ask = frameFlow.sizeAsk.value
    if (!ask) return undefined
    const setting = changedSetting(ask.change)
    const words = setting === 'fringeStyle' ? t.value.frame.fringeStyle : t.value.frame.sizeSettings[setting]
    return { title: words.confirmTitle, message: plural(locale.value, ask.lost, words.confirmMessage), button: words.confirmButton }
  })

  provideMoveColor(moveColor)

  /** A Custom color that is about to paint a cell joins the Palette on its first use (ticket 227). */
  function onPaintColorUsed(hex: string) {
    if (selectedColorId.value) return
    const { outcome, colorId } = addUsed(hex)
    if (outcome === 'added' && colorId) onCustomColorAdded(colorId)
  }

  /** A Custom color was picked (ticket 398): it becomes the paint color and, with a slot free, joins the Palette at
   * once. */
  function onSelectCustomColor(hex: string) {
    selectCustomColor(hex)
    onPaintColorUsed(hex)
  }

  /** Pick color from canvas (ticket 398): the next press on a bead takes its color (an empty cell does nothing); a
   * tool choice or Escape ends it. */
  function pickColorAt(row: number, column: number, layer?: Layer): boolean {
    if (!pickingColor.value) return false
    const project = currentProject()
    const hex = project ? beadColorAt(project, row, column, layer) : null
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
    activeTool: () => activeTool.value,
    endSelectPress: endSelectPressFraming,
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
  } = useCanvasPointer({
    currentProject,
    activeTool: () => activeTool.value,
    spaceHeld: () => spaceHeld.value,
    strokeMode: () => strokeMode.value,
    selectedColorHex,
    pastePreviewCells,
    beginSelectPress,
    extendSelection,
    tapPiece,
    beginOrCommitPress: (mode, color, row, column) => {
      // Before the press, so the Palette's Undo step comes before the stroke's own.
      if (mode === 'paint' && color) onPaintColorUsed(color)
      beginOrCommitPress(mode, color, row, column)
    },
    paintStrokeCell,
    pasteAt: pasteAtCell,
    pickColorAt,
  })

  const { announcement, announce } = useA11yAnnouncer()

  /** Delete all and its confirmation (tickets 42, 198). */
  const deleteAll = useDeleteAllFlow({ currentProject, edit })

  /** Edit Frame: moving and resizing the Frame and stepping its edges, Fit to drawing and Remove Frame (tickets 233,
   * 417). */
  /** The one panel open over the canvas (ticket 510): Menu, Project or the Frame panel. */
  const openPanel = ref<OpenPanel | null>(null)
  const frameFlow = useFrameFlow({
    openPanel,
    currentProject,
    edit,
    announce,
    showToast,
    messages,
    locale: () => locale.value,
    centreOn,
    visibleCentre,
  })
  /** The edit pencil in the Frame's gutter (ticket 452, ADR 0054). */
  const editFrame = frameFlow.toggleHandles

  /** Rotate: the Selection a quarter turn, with a Message saying when it covered beads (ticket 416, ADR 0052). */
  const rotateFlow = useRotateSelectionFlow({
    edit,
    currentProject,
    selection,
    announce,
    showToast,
    onUndo,
    messages,
    locale: () => locale.value,
  })

  /** Rotate Frame: the Frame and its own beads a quarter turn, one Undo step (ticket 471, ADR 0052, 0066). */
  const rotateFrameFlow = useRotateFrameFlow({ edit, currentProject, announce, messages })

  /** Rotate canvas: the picture a quarter turn, saved but no Undo step (ticket 471, ADR 0052). */
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

  const beadShapeFlow = useBeadShapeFlow({ currentProject, edit })

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
  const overlays = useOverlayVisibility({ selectProject: savedProjectConfirms.onRequestSwitch, openPanel })

  /** Whether the `?` shortcuts help overlay (ticket 96) is open: a single boolean with no logic, so it stays here. */
  const shortcutsHelpOpen = ref(false)

  usePageZoomLock()
  useViewportGuard()
  useAppShortcutTable({
    activeProject: currentProject,
    activeTool: () => activeTool.value,
    hasSelection: () => !!selection.value,
    selectionHasBeads: () => !!selection.value && !!currentProject() && copyLayerSelection(currentProject()!, selection.value) !== undefined,
    canUndo: () => canUndo.value,
    canRedo: () => canRedo.value,
    hasClipboard,
    onPickColorKey: toolPill.pickByKey,
    cancelColorPick: () => {
      const was = pickingColor.value
      pickingColor.value = false
      return was
    },
    hasOpenLayer,
    anyDialogOpen: () =>
      deleteAll.deleteAllConfirmOpen.value ||
      frameFlow.removeConfirmOpen.value ||
      frameFlow.replaceConfirmOpen.value ||
      !!frameFlow.switchQuestion.value ||
      !!removeColor.pendingColorRemovalId.value ||
      removeColor.removeAllColorsConfirmOpen.value ||
      !!replaceBead.replaceBeadPendingBead.value ||
      !!importSwitch.pendingImport.value ||
      !!savedProjectConfirms.pendingRemove.value ||
      !!savedProjectConfirms.pendingSwitch.value ||
      manageProject.duplicating.value !== undefined ||
      manageProject.deleting.value ||
      manageProject.deletingAll.value ||
      storageAsk.storageNoteOpen.value ||
      shortcutsHelpOpen.value,
    backOutOfSelect: backOutOfSelectOrFraming,
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
    onToggleFramePanel: frameFlow.toggleBar,
    onCopy,
    pasteAtPointer,
    onRotate: rotateFlow.onRotate,
    canRemoveSelectedLine: () => removeLine.canRemoveSelectedLine.value,
    onRemoveSelectedLine: removeLine.onRemoveSelectedLine,
    canNamePiece: () => namePiece.canNamePiece.value,
    hasPaintColor,
    onNamePiece: namePiece.onNamePiece,
    onToggleRowDirection: rowOps.onToggleRowDirection,
    onMoveRow: rowOps.onMoveRow,
    onResetProgress: rowOps.onResetProgress,
    onZoomIn: () => zoomIn(),
    onZoomOut: () => zoomOut(),
    onFit: resetZoom,
    openShortcutsHelp: () => {
      shortcutsHelpOpen.value = true
    },
  })

  watch(activeProjectId, () => {
    resetHistory()
    // Selection resets here through the module's reset(); the clipboard deliberately survives a Project switch
    // (ticket 92, ADR 0016), unlike Undo/Redo history and Selection.
    resetSelection()
    deleteAll.onCancelDeleteAll()
    frameFlow.cancelRemove()
    frameFlow.cancelReplace()
    replaceBead.onCancelReplaceBead()
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
    onCreateProject,
    onCreateFromStarter,
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
    handedness,
    setHandedness,
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
    backOutOfSelect: backOutOfSelectOrFraming,
    previewCells,
    endStroke,
    onCellPrimaryDown,
    onCellPrimaryMove,
    onCellHover,
    onHoverEnd,
    ...rowOps,
    onRotate: rotateFlow.onRotate,
    onRotateFrame: rotateFrameFlow.onRotateFrame,
    onRotateCanvas: rotateCanvasFlow.onRotateCanvas,
    ...deleteAll,
    pendingColorRemovalHex: removeColor.pendingColorRemovalHex,
    removeAllColorsConfirmOpen: removeColor.removeAllColorsConfirmOpen,
    removeAllColorsMessage: removeColor.removeAllColorsMessage,
    onConfirmRemoveAllAddedColors: removeColor.onConfirmRemoveAllAddedColors,
    onCancelRemoveAllAddedColors: removeColor.onCancelRemoveAllAddedColors,
    onCancelRemoveAddedColor: removeColor.onCancelRemoveAddedColor,
    onConfirmRemoveAddedColor: removeColor.onConfirmRemoveAddedColor,
    ...removeLine,
    settingFrame: frameFlow.settingFrame,
    framePanelShown: frameFlow.barShown,
    framePanelOpen: frameFlow.barOpen,
    frameHandlesOn: frameFlow.handlesOn,
    frameDraftProject: frameFlow.draftProject,
    frameLocked: frameFlow.frameLocked,
    onEditFrame: editFrame,
    onToggleFramePanel: frameFlow.toggleBar,
    onCloseFramePanel: frameFlow.closeBar,
    onFrameKey: (event: KeyboardEvent) => {
      if (frameFlow.onKey(event)) event.preventDefault()
    },
    onFramePress: frameFlow.press,
    onFrameDrag: frameFlow.drag,
    onFrameRelease: frameFlow.release,
    onFrameCancel: frameFlow.cancel,
    onStepFrameEdge: frameFlow.stepEdge,
    onResizeFrame: frameFlow.resizeTo,
    onRenameFrame: frameFlow.rename,
    onSetTechnique: frameFlow.setTechnique,
    onSetBrickBlock: frameFlow.setBrickBlock,
    onSetNetSize: frameFlow.setNetSize,
    onSetCanvasNetSize: frameFlow.setCanvasNetSize,
    onSetCanvasTechnique: frameFlow.setCanvasTechnique,
    switchQuestion: frameFlow.switchQuestion,
    onSetSwitchNetSize: frameFlow.setSwitchNetSize,
    onSetSwitchBrickBlock: frameFlow.setSwitchBrickBlock,
    onCancelSwitchTechnique: frameFlow.cancelSwitch,
    onConfirmSwitchTechnique: frameFlow.confirmSwitch,
    onSetCanvasBrickBlock: frameFlow.setCanvasBrickBlock,
    onSetBeadShape: beadShapeFlow.setBeadShape,
    onFitFrame: frameFlow.fit,
    onSelectFrame,
    onRemoveFrame: frameFlow.remove,
    removeFrameConfirmOpen: frameFlow.removeConfirmOpen,
    onCancelRemoveFrame: frameFlow.cancelRemove,
    onConfirmRemoveFrame: frameFlow.confirmRemove,
    removeFrameTakesBeads: frameFlow.removeTakesBeads,
    onPlaceFrameFromStarter: frameFlow.placeFromStarter,
    onSetFrameSettings: frameFlow.setSettings,
    sizeConfirm,
    onCancelSize: frameFlow.cancelSize,
    onConfirmSize: frameFlow.confirmSize,
    replaceFrameConfirmOpen: frameFlow.replaceConfirmOpen,
    onCancelReplaceFrame: frameFlow.cancelReplace,
    onConfirmReplaceFrame: frameFlow.confirmReplace,
    onBringFrameIntoView: frameFlow.bringIntoView,
    ...replaceBead,
    ...importSwitch,
    ...storageAsk,
    ...exportFlow,
    ...namePiece,
    saveNow,
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
