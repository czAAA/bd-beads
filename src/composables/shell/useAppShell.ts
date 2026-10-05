import { computed, inject, provide, ref, watch, type InjectionKey } from 'vue'
import { frameContains } from '../../domain/canvas'
import { pieceAreasOf } from '../../domain/pieces'
import type { CreateProjectInput } from '../../domain/project'
import { provideI18n } from '../../i18n/useI18n'
import { useThemePick } from '../../theme/useThemePick'
import { browserServices, type Services } from '../../services/index'
import { useAppShortcutTable } from './useAppShortcutTable'
import { useA11yAnnouncer } from '../ui/useA11yAnnouncer'
import { useCanvasFraming } from '../canvas/useCanvasFraming'
import { useCanvasPointer } from '../canvas/useCanvasPointer'
import { useConvertImage } from '../import/useConvertImage'
import { useDeleteAllFlow } from '../project/useDeleteAllFlow'
import { useFrameFlow } from '../project/useFrameFlow'
import { useRemoveLineFlow } from '../project/useRemoveLineFlow'
import { useRotateFlow } from '../project/useRotateFlow'
import { hasOpenLayer } from '../ui/useEscapeLayer'
import { useExportFlow } from '../export/useExportFlow'
import { useImportSwitchFlow } from '../import/useImportSwitchFlow'
import { useKeyboardCursor } from '../canvas/useKeyboardCursor'
import { useRulers } from '../canvas/useRulers'
import { useMirrorState } from '../tools/useMirrorState'
import { useNewProjectFlow } from '../project/useNewProjectFlow'
import { useOverlayVisibility } from './useOverlayVisibility'
import { usePaintStroke } from '../tools/usePaintStroke'
import { usePinchPan } from '../canvas/usePinchPan'
import { useProjectLabels } from '../project/useProjectLabels'
import { useProjectLibrary } from '../project/useProjectLibrary'
import { useSavedProjectConfirms } from '../project/useSavedProjectConfirms'
import { useReplaceBeadFlow } from '../palette/useReplaceBeadFlow'
import { useRowOps } from '../project/useRowOps'
import { useSaveFlow } from '../export/useSaveFlow'
import { useSelectionGesture } from '../tools/useSelectionGesture'
import { useSettledProject } from '../project/useSettledProject'
import { useSharedProjectLink } from '../project/useSharedProjectLink'
import { useSpaceDragPan } from '../canvas/useSpaceDragPan'
import { useToasts } from '../ui/useToasts'
import { provideRemoveAddedColor, useAddedColors } from '../tools/usePalette'
import { DEFAULT_PALETTE_COLOR_ID, useToolAndColor } from '../tools/useToolAndColor'
import { useToolAtCursor } from '../tools/useToolAtCursor'
import { provideTourFormReset, useTour } from '../tour/useTour'
import { useUndoHistory } from '../project/useUndoHistory'

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
   * The Project library, which one is open, and persistence (ticket 55, ADR 0012) — every Project change goes through
   * one of these mutators, and nothing here touches storage directly. replaceProject is the single commit point for a
   * change to the open Project, and saves it as it lands; a dragged stroke is the one edit that doesn't, asking for its
   * save to be deferred per cell and writing once when the stroke ends (see usePaintStroke).
   */
  const {
    projects,
    activeProjectId,
    activeProject,
    saveFailed,
    addProject,
    addProjects,
    replaceProject,
    removeProject,
    flushPendingSave,
    saveNow,
  } = useProjectLibrary(services.libraryStore)

  const currentProject = () => activeProject.value
  const messages = () => t.value
  const currentLocale = () => locale.value

  const { activeBeadLabel, projectLabel } = useProjectLabels({ currentProject, messages, locale: currentLocale })

  /** Short-lived results, shown as toasts in the canvas box (ticket 76). */
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts()

  /** Save and its "Saved" confirmation (tickets 115, 119, 195). */
  const { onSave, clearSavedConfirmation } = useSaveFlow({
    currentProject,
    saveNow,
    messages,
    showToast,
    dismissToast,
    downloadFile: services.downloadFile,
  })

  /**
   * Convert image's framing step (ticket 58, ADR 0010): the picture being framed and how it sits under the frame. Its
   * own state, deliberately independent of which Project is open — conversion creates a Project rather than converting
   * into one, so nothing here goes through replaceProject, the undo stack, Mirror or the Row progress lock, and entering
   * framing with a Project already open simply takes the canvas panel over until Cancel gives it back.
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

  /** New-Project creation, blank or from Convert image, and the framing step's gate (tickets 58, 196). */
  const { framing, newProjectDraft, onNewProjectDraft, onCreateProject, onConvertImageCreate } = useNewProjectFlow({
    addProject,
    convertImage: () => convertImageSource.value,
    cancelConvertImage,
  })

  /** The Rulers toggle (R, the canvas strip's button): on by default and kept on the device. */
  const { showRulers, toggleRulers } = useRulers(services.rulersStore)

  /** Canvas sizing, zoom and the strip's size/zoom meta (tickets 27, 57, 197). */
  const { bindCanvasArea, canvasAreaWidth, zoom, scroll, zoomIn, zoomOut, setZoom, resetZoom, panBy, scrollBy, reveal, centreOn, zoomPercent, stripSize, stripZoomPercent } =
    useCanvasFraming({
      currentProject,
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
    currentProject,
    replaceProject,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    restoreMirrorAxisCounts: (counts) => restoreMirrorAxisCounts(counts),
    clearSelectionAndHover,
  })

  /**
   * Mirror's own session state (ticket 62): axis counts, copy mode, and both preview computations. Ticket 174 hid
   * Mirror's UI pending its own redesign, so only the bookkeeping a Frame change and a Project switch still need is pulled
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
  } = useMirrorState(currentProject, commitGridChange)

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
  } = useSelectionGesture(currentProject, commitGridChange, () => mirrorAxisCounts.value, () => mirrorCopyMode.value)

  /** A Selection (or hover) that no longer fits after a step or a size change changed the grid. */
  function clearSelectionAndHover() {
    resetSelection()
    hoveredCell.value = undefined
  }

  /** The Palette: the built-in colors and the Custom colors that joined it, kept on the device (ticket 227). */
  const { palette, addUsed, removeAdded } = useAddedColors(services.addedColorsStore)

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
    onCustomColorAdded,
    onSelectImageColor,
    resetImageColor,
  } = useToolAndColor({ leaveSelectTool, palette: () => palette.value, onToolChosen: () => frameFlow.done() })

  /**
   * An added swatch is removed (ticket 228): painted cells keep their hex, so only the swatch goes. Removing the active
   * one steps back to the Palette's default color, and a toast offers Undo, which puts the swatch back (selected again if it was).
   */
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
  provideRemoveAddedColor(onRemoveAddedColor)

  /** A Custom color that has just painted a cell joins the Palette on its first use (ticket 227); at the limit it still paints, and the user is told once per color. */
  let limitToldFor: string | undefined
  function onPaintColorUsed(hex: string) {
    if (selectedColorId.value || selectedImageColor.value) return
    const { outcome, colorId } = addUsed(hex)
    if (outcome === 'added' && colorId) {
      onCustomColorAdded(colorId)
    } else if (outcome === 'full' && limitToldFor !== hex) {
      limitToldFor = hex
      showToast('palette-full', t.value.palette.limitReached, 'info')
    }
  }

  /** A Paint-tool drag (ticket 24): the stroke lifecycle and its one undo step and one save (ticket 190). strokeMode is 'paint'/'erase' while a stroke is in progress, else null. */
  const { strokeMode, endStroke, paintStrokeCell, beginOrCommitPress } = usePaintStroke({
    currentProject,
    replaceProject,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    mirrorCopyMode: () => mirrorCopyMode.value,
    activeTool: () => activeTool.value,
    commitGridChange,
    recordHistory,
    endSelectPress,
    flushPendingSave,
  })

  /** The Piece area holding the Piece being drawn right now (its rectangle is drawn `muted`, ADR 0026): the one under the pointer while a stroke is going, with no Frame to take the rulers over. */
  const activePiece = computed(() => {
    const project = currentProject()
    const hovered = hoveredCell.value
    if (!project || project.frame || strokeMode.value === null || !hovered) {
      return undefined
    }
    return pieceAreasOf(project.beads, project.technique).find((area) => frameContains(area, hovered))
  })

  /** The open Project for what only summarises it: it follows a stroke a few times a second, and is exact when the stroke ends. */
  const settledProject = useSettledProject(currentProject, () => strokeMode.value !== null)

  /** The open Project for the code that shares it, which nobody watches change: it waits for the stroke to end. */
  const shareableProject = useSettledProject(currentProject, () => strokeMode.value !== null, Number.POSITIVE_INFINITY)

  /**
   * The canvas panel's own horizontal scroller (ticket 95) -- what Space+drag panning scrolls sideways; vertical
   * panning scrolls the window instead, since nothing in the shell traps vertical overflow of its own.
   */
  const canvasScrollEl = ref<HTMLElement | null>(null)
  const { spaceHeld, panning: spacePanning } = useSpaceDragPan(panBy)

  /** A template function ref for the canvas panel's scroller, so the element stays the wiring's own rather than a name the panel has to declare. */
  function bindCanvasScroll(el: unknown) {
    canvasScrollEl.value = el instanceof HTMLElement ? el : null
  }

  /** Two fingers on the Project pinch to zoom and pan it (ticket 79); the one-finger paint stroke in progress ends when the second lands. */
  usePinchPan(canvasScrollEl, { zoom: () => zoom.value, setZoom, panBy, endStroke: () => endStroke() })

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
    beginOrCommitPress: (mode, color, row, column) => {
      beginOrCommitPress(mode, color, row, column)
      if (mode === 'paint' && color) onPaintColorUsed(color)
    },
    paintStrokeCell,
    pasteAt: pasteAtCell,
  })

  /** Painting with the keyboard (tickets 159, 194): the announcer needs the cursor and the cursor the announcer, so the announcer reads the cursor lazily. */
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
    extendSelection,
    announce,
    colorWords,
  })

  const { beadCursor, keyboardOnProject, cursorShown, onProjectKeyboardFocus, onProjectKey, onProjectKeyUp } = useKeyboardCursor({
    currentProject,
    reveal,
    hasSelection: () => !!selection.value,
    onCellHover,
    onHoverEnd,
    announceCursor,
    invokeToolAt,
    extendSelectionTo,
    finishExtending,
    onFrameKey: (event) => frameFlow.onKey(event),
    settingFrame: () => frameFlow.settingFrame.value,
  })

  /** Delete all and its confirmation (tickets 42, 198). */
  const deleteAll = useDeleteAllFlow({ currentProject, replaceProject, recordHistory })

  /** Set Frame and the Toolbox's Frame row: drawing, moving and resizing the Frame, Fit to drawing and Remove Frame (ticket 233). */
  const frameFlow = useFrameFlow({
    currentProject,
    replaceProject,
    recordHistory,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    clearMirrorAxisCounts,
    clearSelectionAndHover,
    announce,
    showToast,
    onUndo,
    messages,
    locale: currentLocale,
    centreOn,
  })

  /** Rotate: the Frame and its beads a quarter turn, with a Message when a Piece had to move (ticket 233). */
  const rotateFlow = useRotateFlow({
    currentProject,
    replaceProject,
    recordHistory,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    clearMirrorAxisCounts,
    clearSelectionAndHover,
    announce,
    showToast,
    onUndo,
    messages,
    locale: currentLocale,
  })

  /** Remove line: the selected whole row or column of the Frame, as one undo step (tickets 123, 199, 233). */
  const removeLine = useRemoveLineFlow({
    currentProject,
    replaceProject,
    recordHistory,
    mirrorAxisCounts: () => mirrorAxisCounts.value,
    clearMirrorAxisCounts,
    selection: () => selection.value,
    clearSelectionAndHover,
  })

  /** Replace Bead, its select and its confirmation (tickets 48, 113, 205). */
  const replaceBead = useReplaceBeadFlow({ currentProject, replaceProject, recordHistory, messages, locale: currentLocale })

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

  /** Exporting as a file, PNG, PDF or QR code, and the maker's name they print (tickets 68, 73, 74, 158, 161, 202). */
  const exportFlow = useExportFlow({
    currentProject,
    projects: () => projects.value,
    shareableProject: () => shareableProject.value,
    messages,
    locale: currentLocale,
    downloadFile: services.downloadFile,
    makerNameStore: services.makerNameStore,
  })

  /** Rotate and the Row progress controls; none is an undo step (tickets 32, 171, 201). */
  const rowOps = useRowOps({ currentProject, replaceProject })

  /** Opening a scanned QR export's link, and the page-hide and unmount saves (tickets 55, 68, 203). */
  useSharedProjectLink({ projects: () => projects.value, addProject, flushPendingSave })

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

  /** The Drawer and the phone tier's sheets (tickets 79, 168, 188, 204). */
  const overlays = useOverlayVisibility({ selectProject: savedProjectConfirms.onRequestSwitch })

  /** Whether the `?` shortcuts help overlay (ticket 96) is open: a single boolean with no logic, so it stays here. */
  const shortcutsHelpOpen = ref(false)

  /** For the Escape precedence: asks every Tool group to collapse before backing out of Select (ticket 41). */
  const toolbox = ref<{ collapseExpandedGroup: () => boolean } | null>(null)

  /** A template function ref for the Toolbox, for the same reason as bindCanvasScroll. */
  function bindToolbox(el: unknown) {
    toolbox.value = (el as typeof toolbox.value) ?? null
  }

  /**
   * The Tour (ticket 80): a walk through this same editor, reading the state above and making its edits through the same
   * commit paths. Its dim layer is drawn by TourLayer; what it needs from the wiring is whether the Project is open to
   * drawing right now, and Create's hand-off in its first step.
   */
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
    commitGridChange,
    replaceProject,
    undo: onUndo,
    clearSelection: clearSelectionAndHover,
    draftName: () => newProjectDraft.value?.name,
    createProject: onCreateProject,
    showToast,
    messages,
  })
  provideTourFormReset(tour.formResetTick)

  /** While the Tour points somewhere other than the Project, the Project only scrolls and zooms: nothing on it draws. */
  function unlessTourLocks<Args extends unknown[]>(handler: (...args: Args) => void) {
    return (...args: Args) => {
      if (!tour.canvasLocked.value) {
        handler(...args)
      }
    }
  }

  useAppShortcutTable({
    activeProject: currentProject,
    activeTool: () => activeTool.value,
    hasSelection: () => !!selection.value,
    hasOpenLayer,
    anyDialogOpen: () =>
      deleteAll.deleteAllConfirmOpen.value ||
      !!replaceBead.replaceBeadPendingBead.value ||
      !!importSwitch.pendingImport.value ||
      !!savedProjectConfirms.pendingRemove.value ||
      !!savedProjectConfirms.pendingSwitch.value ||
      exportFlow.qrExport.panelOpen.value ||
      shortcutsHelpOpen.value,
    collapseExpandedToolGroup: () => toolbox.value?.collapseExpandedGroup() ?? false,
    backOutOfSelect,
    onUndo,
    onRedo,
    onSelectTool,
    onSelectColor,
    onDeleteSelection,
    onToggleRulers: toggleRulers,
    onToggleFrame: () => {
      frameFlow.toggle()
      // The keyboard's Set Frame works from the Project, so focus goes there.
      if (frameFlow.settingFrame.value) focusProject()
    },
    settingFrame: () => frameFlow.settingFrame.value,
    finishFrame: frameFlow.done,
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
    replaceBead.onCancelReplaceBead()
    exportFlow.qrExport.close()
    clearSavedConfirmation()
    resetImageColor()
  })

  return {
    t,
    locale,
    // The library
    projects,
    activeProjectId,
    activeProject,
    saveFailed,
    ...savedProjectConfirms,
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
    panBy,
    scrollBy,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomPercent,
    stripSize,
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
    onCellPrimaryDown: unlessTourLocks(onCellPrimaryDown),
    onCellPrimaryMove: unlessTourLocks(onCellPrimaryMove),
    onCellSecondaryDown: unlessTourLocks(onCellSecondaryDown),
    onCellSecondaryMove: unlessTourLocks(onCellSecondaryMove),
    onCellHover,
    onHoverEnd,
    beadCursor,
    keyboardOnProject,
    cursorShown,
    onProjectKeyboardFocus,
    onProjectKey: unlessTourLocks(onProjectKey),
    onProjectKeyUp,
    bindToolbox,
    tour,
    ...rowOps,
    onRotate: rotateFlow.onRotate,
    ...deleteAll,
    ...removeLine,
    settingFrame: frameFlow.settingFrame,
    frameDraft: frameFlow.draft,
    frameLocked: frameFlow.frameLocked,
    onStartSetFrame: frameFlow.start,
    onDoneSetFrame: frameFlow.done,
    activePiece,
    onFramePress: frameFlow.press,
    onFrameDrag: frameFlow.drag,
    onFrameRelease: frameFlow.release,
    onFrameCancel: frameFlow.cancel,
    onSetFrameSize: frameFlow.setSize,
    onFitFrame: frameFlow.fit,
    onRemoveFrame: frameFlow.remove,
    onBringFrameIntoView: frameFlow.bringIntoView,
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
