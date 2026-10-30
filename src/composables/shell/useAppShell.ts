import { computed, inject, provide, ref, watch, type InjectionKey } from 'vue'
import { beadColorAt } from '../../domain/layerBeads'
import { provideI18n } from '../../i18n/useI18n'
import { plural } from '../../i18n/plural'
import { useThemePick } from '../../theme/useThemePick'
import { browserServices, type Services } from '../../services/index'
import { devicePreferencesKey } from '../../services/devicePreferences'
import type { GridPosition } from '../../domain/grid'
import { useMediaQuery } from '../ui/useMediaQuery'
import type { Layer } from '../../domain/layers'
import { selectionFrame, selectionHasBeads, selectionHoldsAllBeads } from '../../domain/selection'
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
import { useConvertImageFlow } from '../import/useConvertImageFlow'
import { loadColorCatalog } from '../../services/colorCatalogs'
import { useEdit } from '../project/useEdit'
import { useDeleteAllFlow } from '../project/useDeleteAllFlow'
import { useFrameFlow } from '../project/useFrameFlow'
import { useNamePieceFlow } from '../project/useNamePieceFlow'
import { useRemoveLineFlow } from '../project/useRemoveLineFlow'
import { useRotateSelectionFlow } from '../tools/useRotateSelectionFlow'
import { useRotateFrameFlow } from '../tools/useRotateFrameFlow'
import { useRotateCanvasFlow } from '../canvas/useRotateCanvasFlow'
import { hasOpenLayer } from '../ui/useOverlayLayer'
import { useBackgroundFlow } from '../project/useBackgroundFlow'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { withStartBackground } from '../../domain/layerRecord'
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
import { useMirrorFlow } from '../tools/useMirrorFlow'
import { useMirrorSelectionFlow } from '../tools/useMirrorSelectionFlow'
import { useUndoHistory } from '../project/useUndoHistory'
import { useDialogs } from './useDialogs'
import { useFeedbackFlow } from './useFeedbackFlow'

// The app's composition root (ADR 0020): wires every composable together and hands each part of the shell its own
// context (ticket 0618); nothing here decides anything. Deps are lazy arrows so composables can reference each other.
// Call once from the root setup (see provideAppShell).
function wireAppShell(services: Services) {
  const { t, locale } = provideI18n(services.devicePreferences)
  // The theme pick is shared by the header's controls; this is where it is first read, from this device's preferences.
  useThemePick(services.devicePreferences)

  /** Which dialog shows (ticket 0618): every flow that asks a question opens it here, so the root holds one value. */
  const dialogs = useDialogs()

  /** Asking the browser to keep the library, at a device's first save (ticket 399). */
  const storageAsk = useStorageAskFlow({
    persistentStorage: services.persistentStorage,
    devicePreferences: services.devicePreferences,
    dialogs,
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

  /** Short-lived results, shown as toasts in the canvas box (ticket 76). */
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts()

  /** "Update ready", once a newer version has downloaded behind the open page (ticket 69). */
  useUpdatePrompt({ updates: services.appUpdates, messages, showToast })

  /** The device's last Background pick (ticket 0666): a new Project's layers start on it, and keep it on every device. */
  const backgrounds = useCanvasBackground(currentProject, services.devicePreferences)
  const addNewProject = (project: Parameters<typeof addProject>[0]) => addProject(withStartBackground(project, backgrounds.start.value))

  // Convert image (spec 0645, ADR 0010): a dialog creating a new Project, independent of the open one, so nothing here
  // touches replaceProject, undo or the Row lock.
  const convertImage = useConvertImageFlow({ dialogs, addProject: addNewProject })

  /** New-Project creation, blank or from a Starter (tickets 196, 0596). */
  const { onCreateProject, onCreateFromStarter } = useNewProjectFlow({ addProject: addNewProject })

  /** The Rulers toggle (R, the canvas strip's button): on by default and kept on the device. */
  const showRulers = services.devicePreferences.get('rulers')
  const toggleRulers = () => void (showRulers.value = !showRulers.value)
  const rowHighlight = services.devicePreferences.get('rowHighlight')
  const toggleRowHighlight = () => void (rowHighlight.value = !rowHighlight.value)

  /** The input mode toggle (tickets 325, 326): offered once a pen has been seen. */
  const { inputMode, inputModeAvailable, setInputMode, surfaceInputMode, handedness, setHandedness } = usePenInputMode(services.devicePreferences)

  /** Canvas sizing, zoom and the strip's size/zoom meta (tickets 27, 57, 197). */
  const { bindCanvasArea, zoom, scroll, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, centreOn, visibleCentre, visibleCentrePx, canvasOnScreen, stripZoomPercent, orientation: canvasOrientation, twistPhase, pinchStep, endTwist } =
    useCanvasFraming({ currentProject, keepTwist: (turned) => rotateCanvasFlow.onTwistCanvas(turned) })

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
    // Undo and Redo stop Row done's motion on the Pattern (ticket 0730).
    restore: (snapshot) => {
      rowOps.stopRowMotion()
      editing.restore(snapshot)
    },
    settle: () => editing.settle(),
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

  /** Mirror (ADR 0082, ticket 0703): the Project's setting, the tile's light, the popover and key `8`; on the open
   * Canvas its Axes' handles, placed at the view's middle and dragged as one Undo step (ticket 0704). */
  const mirror = useMirrorFlow({ currentProject, replaceProject, edit, viewCentre: visibleCentrePx })

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
    pastePreviewStamp,
    clearSelection: resetSelection,
    pasteProjectionActive,
    hasClipboard,
  } = useSelectionGesture(
    currentProject,
    edit,
    (count, loss) => showToast('paste-clipped', plural(locale.value, count, loss === 'shape' ? t.value.tools.droppedOnShapeMessage : t.value.tools.pasteClippedMessage), 'info'),
    () => mirror.setting.value,
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
  /** The Feedback sheet (ADR 0081, ticket 0700): the Menu's two entries and the Bead colors list's foot row open it. */
  const feedback = useFeedbackFlow({ feedback: services.feedback, locale: currentLocale, messages, showToast, dialogs })
  provideBeadColors(
    useBeadColors({ currentProject, palette, addUsed, selectedColorId: () => selectedColorId.value, report: feedback.onOpenFeedback }),
  )

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
    if (selectionHoldsAllBeads(project, current)) deleteAll.onRequestDeleteAll()
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
  const removeColor = useRemoveColorFlow({ palette, removeAdded, removeAllAdded, selectedColorId, onSelectColor, showToast, messages, locale: currentLocale, dialogs })
  provideRemoveAddedColor(removeColor.onRequestRemoveAddedColor)
  provideRemoveAllAddedColors(removeColor.onRequestRemoveAllAddedColors)

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
  const { strokeMode, fillRefusals, endStroke, cancelStroke, paintStrokeCells, beginOrCommitPress } = usePaintStroke({
    currentProject,
    edit: editing,
    activeTool: () => activeTool.value,
    endSelectPress: endSelectPressFraming,
    mirror: () => mirror.setting.value,
    onScreen: canvasOnScreen,
    showToast,
    messages,
  })

  /** The open Project for what only summarises it, Beads needed and the accessible name: it waits for a stroke's end
   * to follow it (tickets 0674, 0680). */
  const settledProject = useSettledProject(currentProject, () => strokeMode.value !== null)
  const { projectLabel } = useProjectLabels({ currentProject: () => settledProject.value, messages, locale: currentLocale })

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
  usePinchPan(canvasScrollEl, { zoom: () => zoom.value, pinch: pinchStep, cancelStroke: () => cancelStroke(), endTwist })

  /** Mouse, touch and pen input on the Project (tickets 22-25, 31, 33, 92, 95, 176, 206). */
  const {
    hoveredCell,
    previewCells,
    previewStamp,
    onCellHover,
    onHoverEnd,
    pasteAtPointer,
    onCellPrimaryDown,
    onCellPrimaryMove,
    onCellsPrimaryMove,
  } = useCanvasPointer({
    currentProject,
    activeTool: () => activeTool.value,
    spaceHeld: () => spaceHeld.value,
    strokeMode: () => strokeMode.value,
    selectedColorHex,
    pastePreviewCells,
    pastePreviewStamp,
    beginSelectPress,
    extendSelection,
    tapPiece,
    beginOrCommitPress: (mode, color, row, column, layer) => {
      // Before the press, so the Palette's Undo step comes before the stroke's own.
      if (mode === 'paint' && color) onPaintColorUsed(color)
      beginOrCommitPress(mode, color, row, column, layer)
    },
    paintStrokeCells,
    mirror: () => mirror.setting.value,
    pasteAt: pasteAtCell,
    pickColorAt,
  })

  const { announcement, announce } = useA11yAnnouncer()

  /** Delete all and its confirmation (tickets 42, 198). */
  const deleteAll = useDeleteAllFlow({ currentProject, edit, dialogs })

  /** Edit Frame: moving and resizing the Frame and stepping its edges, Fit to drawing and Remove Frame (tickets 233,
   * 417). */
  /** The one panel open over the canvas (ticket 510): Menu, Project or the Frame panel. */
  const openPanel = ref<OpenPanel | null>(null)
  const frameFlow = useFrameFlow({
    openPanel,
    currentProject,
    edit,
    hold: editing.hold,
    settle: editing.settle,
    announce,
    showToast,
    messages,
    locale: () => locale.value,
    centreOn,
    visibleCentre,
    dialogs,
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

  /** Mirror (Selection bar): the fragment copied to its counterparts, one Undo step (ticket 0707, spec 0702). */
  const mirrorSelectionFlow = useMirrorSelectionFlow({
    edit,
    selection,
    mirror: () => mirror.setting.value,
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

  /** Remove line: the selected whole row or column of the Frame, as one undo step, asking first where it touches
   * finished rows (tickets 123, 199, 233, 0647). */
  const removeLine = useRemoveLineFlow({
    currentProject,
    edit,
    selection: () => selection.value,
    dialogs,
    messages,
    locale: () => locale.value,
  })

  /** Name Piece: the dialog that gives the selected Piece a name, which makes it a Schema (ticket 406). */
  const namePiece = useNamePieceFlow({
    currentProject,
    edit,
    selection: () => selection.value,
    dialogs,
  })

  /** Replace Bead, its select and its confirmation (tickets 48, 113, 205). */
  const replaceBead = useReplaceBeadFlow({ currentProject, edit, messages, locale: currentLocale, dialogs })

  /** Project import and the keep-current / save-and-switch / switch decision (tickets 154, 168, 200). */
  const importSwitch = useImportSwitchFlow({
    currentProject,
    addProjects,
    openProject: (id) => {
      activeProjectId.value = id
    },
    saveNow,
    dialogs,
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

  /** Each layer's Background (ticket 0666): a view, so no Edit. */
  const backgroundFlow = useBackgroundFlow({ currentProject, replaceProject, remember: backgrounds.remember, start: () => backgrounds.start.value })

  /** Rotate and the Row progress controls; none is an undo step (tickets 32, 171, 201). */
  const rowOps = useRowOps({ currentProject, replaceProject, showToast, messages, dialogs })

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
    dialogs,
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
    dialogs,
  })

  /** The Drawer and the phone tier's sheets (tickets 79, 168, 188, 204). */
  const overlays = useOverlayVisibility({ selectProject: savedProjectConfirms.onRequestSwitch, openPanel })

  /** Whether the `?` shortcuts help overlay (ticket 96) is open: a dialog with no flow of its own, so it is asked here. */
  const shortcutsHelpOpen = dialogs.flag('shortcuts')
  const onOpenShortcutsHelp = () => void (shortcutsHelpOpen.value = true)
  const onCloseShortcutsHelp = () => void (shortcutsHelpOpen.value = false)

  usePageZoomLock()
  useViewportGuard()
  useAppShortcutTable({
    activeProject: currentProject,
    activeTool: () => activeTool.value,
    hasSelection: () => !!selection.value,
    selectionHasBeads: () => !!selection.value && !!currentProject() && selectionHasBeads(currentProject()!, selection.value),
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
    anyDialogOpen: () => dialogs.open.value !== undefined,
    backOutOfSelect: backOutOfSelectOrFraming,
    onUndo,
    onRedo,
    onSelectTool,
    onSelectAll,
    onSelectColor,
    onClearSelection,
    onCut,
    onPasteMode,
    onToggleMirror: mirror.toggle,
    onFillSelection,
    onFrameFromSelection,
    onToggleRulers: toggleRulers,
    onToggleRowHighlight: toggleRowHighlight,
    onEditFrame: editFrame,
    onToggleFramePanel: frameFlow.toggleBar,
    onCopy,
    pasteAtPointer,
    onRotate: rotateFlow.onRotate,
    selectionInFinishedRows: () => rotateFlow.heldBack.value,
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
    openShortcutsHelp: onOpenShortcutsHelp,
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

  /** The Frame panel's keys: an arrow steps or moves the Frame, and the page doesn't scroll for it. */
  const onFrameKey = (event: KeyboardEvent) => {
    if (frameFlow.onKey(event)) event.preventDefault()
  }

  return {
    /** The shell's own frame (AppShell): the announcer, the save-failed notice, and a stroke ending anywhere on it. */
    shell: {
      t,
      saveFailed,
      announcement,
      endStroke,
      onExportProjectFile: exportFlow.onExportProjectFile,
      /** A picture dropped or pasted on the app opens Convert image with it set (spec 0645). */
      onPictureForConvert: convertImage.onPicture,
      dialogOpen: dialogs.open,
    },
    /** The canvas box (CanvasPanel): its strip, the drawing surface, the Tool pill, the Context and Progress bars, the
     * toasts. */
    canvas: {
      t,
      locale,
      // The library and the panels the strip opens
      projects,
      activeProject,
      projectLabel,
      openPanel,
      onSelectPanel: overlays.onSelectPanel,
      openMenuOnForm: overlays.openMenuOnForm,
      onImportProjects: importSwitch.onImportProjects,
      toasts,
      dismissToast,
      // The view
      bindCanvasArea,
      bindCanvasScroll,
      zoom,
      scroll,
      /** The Canvas's orientation as shown: live while two fingers twist it (ticket 0672). */
      canvasOrientation,
      /** Whether two fingers twist the Canvas, or it eases onto a quarter turn after them (ticket 0709). */
      twistPhase,
      showRulers,
      /** Whether a Paint or Eraser stroke is going on, so the surface holds what it counts until it ends (ticket 0674). */
      stroking: computed(() => strokeMode.value !== null),
      toggleRulers,
      rowHighlight,
      toggleRowHighlight,
      /** The last press of Row done or Row not done, which the Pattern's motion plays from (ticket 0730). */
      rowPress: rowOps.rowPress,
      panBy,
      scrollBy,
      setZoom,
      zoomIn,
      zoomOut,
      resetZoom,
      stripZoomPercent,
      spaceHeld,
      spacePanning,
      surfaceInputMode,
      handedness,
      onRotateCanvas: rotateCanvasFlow.onRotateCanvas,
      // Drawing and the Selection
      canUndo,
      canRedo,
      onUndo,
      onRedo,
      activeTool,
      selectedColorHex,
      selectedColorId,
      customColor,
      previewColor,
      onSelectTool,
      onSelectColor,
      onSelectCustomColor,
      toolPillPosition: toolPill.toolPillPosition,
      toolPillPopoverOpen: toolPill.toolPillPopoverOpen,
      recentsInPill: toolPill.recentsInPill,
      pickRecent: toolPill.pickRecent,
      // Mirror (ticket 0703): the Project's setting, the popover and the Frame's count limits; the open Canvas's Axes
      // and their handles (ticket 0704)
      mirrorSetting: mirror.setting,
      mirrorLimits: mirror.limits,
      mirrorOnCanvas: mirror.onCanvas,
      mirrorPopoverOpen: mirror.popoverOpen,
      onMirrorChange: mirror.update,
      mirrorCanvasAxes: mirror.canvasAxes,
      mirrorHeldAxis: mirror.heldAxis,
      onAxisPress: mirror.pressAxis,
      onAxisDrag: mirror.dragAxis,
      onAxisRelease: mirror.releaseAxis,
      previewCells,
      previewStamp,
      onCellPrimaryDown,
      onCellPrimaryMove,
      onCellsPrimaryMove,
      onCellHover,
      onHoverEnd,
      selection,
      selectionRefusals,
      fillRefusals,
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
      onSelectAll,
      onRotate: rotateFlow.onRotate,
      // The Selection bar's Mirror, offered while Mirror is on (ticket 0707)
      mirrorOn: mirror.on,
      onMirrorSelection: mirrorSelectionFlow.onMirrorSelection,
      canNamePiece: namePiece.canNamePiece,
      onNamePiece: namePiece.onNamePiece,
      onRenameSchema: namePiece.onRenameSchema,
      canRemoveSelectedLine: removeLine.canRemoveSelectedLine,
      onRemoveSelectedLine: removeLine.onRemoveSelectedLine,
      // The Frame and Row progress
      onFrameFromSelection,
      onFrameSchema: frameFlow.setTo,
      settingFrame: frameFlow.settingFrame,
      framePanelOpen: frameFlow.barOpen,
      frameDraftProject: frameFlow.draftProject,
      onToggleFramePanel: frameFlow.toggleBar,
      onEditFrame: editFrame,
      onFrameKey,
      onFitFrame: frameFlow.fit,
      onRemoveFrame: frameFlow.remove,
      onFramePress: frameFlow.press,
      onFrameDrag: frameFlow.drag,
      onFrameRelease: frameFlow.release,
      onFrameCancel: frameFlow.cancel,
      onToggleRowDirection: rowOps.onToggleRowDirection,
      onMoveRow: rowOps.onMoveRow,
      onResetProgress: rowOps.onResetProgress,
      // The margin sheet's tools and title block (ticket 0657): the flows the Frame and Project panels ask too
      onRotateFrame: rotateFrameFlow.onRotateFrame,
      onRenameFrame: frameFlow.rename,
      onSetFrameTechnique: frameFlow.setTechnique,
      onSetFrameSetting: (id: string, value: number) => frameFlow.setWeaveSetting('frame', id, value),
      onSaveMakerName: exportFlow.onSaveMakerName,
      onSetLetters: exportFlow.onSetLetters,
      exportOpener: overlays.exportOpener,
      onOpenExport: overlays.onOpenExport,
    },
    /** The panels over the canvas box (AppPanels): Menu with New Project and the Projects library, Project, and the
     * Frame panel. Each control only asks; the flows do the work. */
    panels: {
      t,
      openPanel,
      exportOpener: overlays.exportOpener,
      menuOpensOnForm: overlays.menuOpensOnForm,
      phoneSavedProjectsOpen: overlays.phoneSavedProjectsOpen,
      onSelectProjectFromPhoneDrawer: overlays.onSelectProjectFromPhoneDrawer,
      onOpenShortcutsHelp,
      onOpenFeedback: feedback.onOpenFeedback,
      // Menu: the device and the library
      toolPillPosition: toolPill.toolPillPosition,
      inputMode,
      setInputMode,
      inputModeAvailable,
      handedness,
      setHandedness,
      projects,
      activeProjectId,
      onRequestRemove: savedProjectConfirms.onRequestRemove,
      onImportProjects: importSwitch.onImportProjects,
      onExportLibraryFile: exportFlow.onExportLibraryFile,
      onRequestDeleteAllProjects: manageProject.onRequestDeleteAllProjects,
      // New Project
      onNewProjectDraft: convertImage.onNewProjectDraft,
      onCreateProject,
      onCreateFromStarter,
      onOpenConvertImage: convertImage.open,
      // Project
      activeProject,
      saveFailed,
      unsaved,
      saveNow,
      onRenameProject: manageProject.onRenameProject,
      onRequestDuplicate: manageProject.onRequestDuplicate,
      onRequestDelete: manageProject.onRequestDelete,
      onRequestDeleteAll: deleteAll.onRequestDeleteAll,
      // Each layer's Layer settings (ticket 0670): the Canvas's in Project, the Frame's in the Frame panel
      onSetTechnique: frameFlow.setLayerTechnique,
      onSetWeaveSetting: frameFlow.setWeaveSetting,
      onSetBackground: backgroundFlow.setBackground,
      onRequestReplaceBead: replaceBead.onRequestReplaceBead,
      onExportProjectFile: exportFlow.onExportProjectFile,
      onSaveMakerName: exportFlow.onSaveMakerName,
      // The Frame panel
      settledProject,
      framePanelShown: frameFlow.barShown,
      onCloseFramePanel: frameFlow.closeBar,
      onStepFrameEdge: frameFlow.stepEdge,
      onResizeFrame: frameFlow.resizeTo,
      onRotateFrame: rotateFrameFlow.onRotateFrame,
      onRemoveFrame: frameFlow.remove,
      onRenameFrame: frameFlow.rename,
      onFitFrame: frameFlow.fit,
      onSelectFrame,
      onSetFrameSettings: frameFlow.setSettings,
      onPlaceFrameFromStarter: frameFlow.placeFromStarter,
      onFrameKey,
      exporting: exportFlow.exporting,
      onExportPng: exportFlow.onExportPng,
      onExportPdf: exportFlow.onExportPdf,
      onSetLetters: exportFlow.onSetLetters,
    },
    /** The dialogs (AppDialogs): which one the registry shows, what each asks about, and its answers. */
    dialogs: {
      t,
      open: dialogs.open,
      activeProject,
      saveFailed,
      onConfirmDeleteAll: deleteAll.onConfirmDeleteAll,
      onCancelDeleteAll: deleteAll.onCancelDeleteAll,
      onConfirmResetProgress: rowOps.onConfirmResetProgress,
      onCancelResetProgress: rowOps.onCancelResetProgress,
      onConfirmRemoveFrame: frameFlow.confirmRemove,
      onCancelRemoveFrame: frameFlow.cancelRemove,
      removeLinePrompt: removeLine.removeLinePrompt,
      onConfirmRemoveLine: removeLine.confirmRemoveLine,
      onCancelRemoveLine: removeLine.cancelRemoveLine,
      onConfirmReplaceFrame: frameFlow.confirmReplace,
      onCancelReplaceFrame: frameFlow.cancelReplace,
      pendingColorRemovalHex: removeColor.pendingColorRemovalHex,
      onConfirmRemoveAddedColor: removeColor.onConfirmRemoveAddedColor,
      onCancelRemoveAddedColor: removeColor.onCancelRemoveAddedColor,
      removeAllColorsMessage: removeColor.removeAllColorsMessage,
      onConfirmRemoveAllAddedColors: removeColor.onConfirmRemoveAllAddedColors,
      onCancelRemoveAllAddedColors: removeColor.onCancelRemoveAllAddedColors,
      replaceBeadPendingBead: replaceBead.replaceBeadPendingBead,
      replaceBeadConfirmMessage: replaceBead.replaceBeadConfirmMessage,
      onConfirmReplaceBead: replaceBead.onConfirmReplaceBead,
      onCancelReplaceBead: replaceBead.onCancelReplaceBead,
      pendingImport: importSwitch.pendingImport,
      pendingImportOpens: importSwitch.pendingImportOpens,
      importSaveRefused: importSwitch.importSaveRefused,
      onSwitchToImported: importSwitch.onSwitchToImported,
      onKeepCurrentAfterImport: importSwitch.onKeepCurrentAfterImport,
      onSaveBeforeImportSwitch: importSwitch.onSaveBeforeImportSwitch,
      pendingRemove: savedProjectConfirms.pendingRemove,
      onConfirmRemove: savedProjectConfirms.onConfirmRemove,
      onCancelRemove: savedProjectConfirms.onCancelRemove,
      pendingSwitch: savedProjectConfirms.pendingSwitch,
      switchSaveRefused: savedProjectConfirms.switchSaveRefused,
      onConfirmSwitch: savedProjectConfirms.onConfirmSwitch,
      onCancelSwitch: savedProjectConfirms.onCancelSwitch,
      onSaveBeforeSwitch: savedProjectConfirms.onSaveBeforeSwitch,
      onConfirmStorageNote: storageAsk.onConfirmStorageNote,
      onCancelStorageNote: storageAsk.onCancelStorageNote,
      onCloseShortcutsHelp,
      feedbackRequest: feedback.feedbackRequest,
      onCloseFeedback: feedback.onCloseFeedback,
      sendReport: feedback.sendReport,
      verifyFeedback: feedback.verifyFeedback,
      copyReport: feedback.copyReport,
      duplicating: manageProject.duplicating,
      onConfirmDuplicate: manageProject.onConfirmDuplicate,
      onCancelDuplicate: manageProject.onCancelDuplicate,
      onConfirmDelete: manageProject.onConfirmDelete,
      onCancelDelete: manageProject.onCancelDelete,
      onConfirmDeleteAllProjects: manageProject.onConfirmDeleteAllProjects,
      onCancelDeleteAllProjects: manageProject.onCancelDeleteAllProjects,
      naming: namePiece.naming,
      onSavePieceName: namePiece.onSavePieceName,
      onCancelPieceName: namePiece.onCancelPieceName,
      convertImageStart: convertImage.start,
      decodeImage: services.decodeImage,
      readClipboardImage: services.readClipboardImage,
      loadColorCatalog,
      onConvertImageCreate: convertImage.onCreate,
      onConvertImageCancel: convertImage.onCancel,
    },
    /** The registry itself, for a test that opens a dialog the way its flow would. */
    dialogRegistry: dialogs,
  }
}

type Wired = ReturnType<typeof wireAppShell>
/** What AppShell draws on. */
export type ShellFrameContext = Wired['shell']
/** What CanvasPanel draws on. */
export type CanvasContext = Wired['canvas']
/** What AppPanels draws on. */
export type PanelsContext = Wired['panels']
/** What AppDialogs draws on. */
export type DialogsContext = Wired['dialogs']

// Each part of the shell injects only its own context (ticket 0618), so no component can reach a handler it doesn't
// draw, and a part can be mounted on its own under the real wiring (testUtils/shellHost).
const shellKey: InjectionKey<ShellFrameContext> = Symbol('shellFrame')
const canvasKey: InjectionKey<CanvasContext> = Symbol('canvasContext')
const panelsKey: InjectionKey<PanelsContext> = Symbol('panelsContext')
const dialogsKey: InjectionKey<DialogsContext> = Symbol('dialogsContext')

/** Wires the app and shares each part's context with the components below the caller; call once, from the root
 * component's setup. */
export function provideAppShell(services: Services = browserServices): Wired {
  const wired = wireAppShell(services)
  provide(shellKey, wired.shell)
  provide(canvasKey, wired.canvas)
  provide(panelsKey, wired.panels)
  provide(dialogsKey, wired.dialogs)
  provide(devicePreferencesKey, services.devicePreferences)
  return wired
}

function injected<T>(key: InjectionKey<T>, name: string): T {
  const context = inject(key)
  if (!context) throw new Error(`${name}() needs provideAppShell() called by an ancestor`)
  return context
}

/** AppShell's context: destructure what it draws on; refs unwrap in its template. */
export const useShellFrame = () => injected(shellKey, 'useShellFrame')
/** CanvasPanel's context. */
export const useCanvasContext = () => injected(canvasKey, 'useCanvasContext')
/** AppPanels' context. */
export const usePanelsContext = () => injected(panelsKey, 'usePanelsContext')
/** AppDialogs' context. */
export const useDialogsContext = () => injected(dialogsKey, 'useDialogsContext')
