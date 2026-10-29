import { type Chord } from '../../domain/chord'
import type { IconName } from '../../components/ui/icons'
import { CONVERT_STEPS, CROP_HANDLES, RATIO_PRESETS, ratioId } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { FRAME_EDGES, frameWithEdgeStep, type FrameEdge } from '../../domain/frame'
import { PALETTE_SHORTCUTS } from '../../domain/palette'
import { hasProjectBeads } from '../../domain/layerBeads'
import { rowProgressOn, rowProgressStarted } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import { ratioSentence, ratioText } from '../../i18n/ratioWords'
import type { Translations } from '../../i18n/translations'

/** What a control's action needs from the app shell: state read lazily, and the handlers the actions call. */
export interface ControlDeps {
  activeProject: () => Project | undefined
  activeTool: () => Tool
  hasSelection: () => boolean
  /** The Selection holds at least one drawn bead: what Copy and Cut need. */
  selectionHasBeads: () => boolean
  /** What the enabled states read (ticket 334): history, the clipboard and the Palette's added colors. */
  canUndo: () => boolean
  canRedo: () => boolean
  hasClipboard: () => boolean
  /** The Palette color standing in a slot (ticket 398): Shift+1 is slot 1, wherever its color was moved to. */
  /** Shift+1…9, Shift+0: the key's index, 0 to 9 (ticket 529). */
  onPickColorKey: (key: number) => void
  /** A menu or popover layer is open (useOverlayLayer). */
  hasOpenLayer: () => boolean
  /** A confirmation modal or the shortcuts help overlay is open. */
  anyDialogOpen: () => boolean
  /** Ends Pick color from canvas; true if it was on. */
  cancelColorPick: () => boolean
  /** Collapses an expanded Tool group; true if one was open. */
  /** Dismisses the paste preview, else clears the Selection; true if either was there. */
  backOutOfSelect: () => boolean
  onUndo: () => void
  onRedo: () => void
  onSelectTool: (tool: Tool) => void
  onSelectColor: (colorId: string) => void
  /** Clear selection (Del): empties the Selection, or opens Delete all when it holds every bead (ticket 415). */
  onClearSelection: () => void
  /** Cut (Ctrl+X), Fill and Frame from the Selection (ticket 415). */
  onCut: () => void
  /** The Paste tool and the Selection bar's Paste button (ticket 447): enter paste mode under Select, stamping
   * nothing. */
  onPasteMode: () => void
  onFillSelection: () => void
  onFrameFromSelection: () => void
  onToggleRulers: () => void
  /** The edit pencil: shows or hides the Frame's handles (tickets 417, 510). */
  onEditFrame: () => void
  /** The strip's Frame button: opens or closes the Frame panel (ticket 510). */
  onToggleFramePanel: () => void
  /** 7 and Ctrl/⌘+A: selects the rectangle round every bead and switches to Select (ticket 414). */
  onSelectAll: () => void
  onCopy: () => void
  pasteAtPointer: (event: KeyboardEvent) => void
  onRotate: () => void
  /** The Selection reaches into finished rows, so Rotate is held back (ticket 0647). */
  selectionInFinishedRows: () => boolean
  /** Whether Remove row/column applies right now: a whole row or column of the Frame or a Piece area is selected. */
  canRemoveSelectedLine: () => boolean
  onRemoveSelectedLine: () => void
  /** Whether Name Piece applies right now: the Selection holds beads of exactly one Piece (ticket 406). */
  canNamePiece: () => boolean
  /** Whether a color is chosen to paint with: Fill needs one. */
  hasPaintColor: () => boolean
  onNamePiece: () => void
  onToggleRowDirection: () => void
  /** Shows or hides the Row progress look on the Canvas (ticket 474). */
  onToggleRowHighlight: () => void
  onMoveRow: (delta: number) => void
  /** Asks, then takes Row progress back to the first row (ticket 455). */
  onResetProgress: () => void
  openShortcutsHelp: () => void
  /** Ctrl/⌘ + plus, minus and 0: Canvas zoom in, out and Fit (ticket 316). */
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

/** Every group of the Keyboard shortcuts dialog. */
export type ControlGroup = 'tools' | 'canvas' | 'colors' | 'edit' | 'rowProgress'

/** The groups the dialog lists, in order. */
export const CONTROL_GROUPS: readonly ControlGroup[] = ['tools', 'canvas', 'colors', 'edit', 'rowProgress']

/** Whether the action's key runs while a menu or dialog is open: not at all, regardless, or claimed from the browser
 * but not run. */
type ModalRule = 'block' | 'ignore' | 'claim'

/** An action that can be disabled says why (ADR 0035): both are given, or neither. */
type Disableable =
  | { enabled?: undefined; disabledBody?: undefined }
  | { enabled: (deps: ControlDeps) => boolean; disabledBody: (t: Translations, deps: ControlDeps) => string }

export type ControlAction = Disableable & {
  id: string
  icon?: IconName
  name: (t: Translations) => string
  body?: (t: Translations) => string
  group: ControlGroup
  chords: readonly Chord[]
  /** A key the action shows without owning it (Done, Cancel and Clear selection show Back out's `Esc`). */
  shownKey?: string
  /** The Keyboard shortcuts dialog's wording when it differs from `name` and `chords` (one row for the whole
   * Palette). */
  help?: { name: (t: Translations) => string; keys: readonly (readonly string[])[] }
  /** Runs from a key press: the key is claimed from the browser first when `preventDefault`. Absent where there is
   * no key: the control's own surface runs it. */
  run?: (deps: ControlDeps, event: KeyboardEvent) => void
  preventDefault?: boolean
  allowWhileTyping?: boolean
  modals?: ModalRule
  /** Only with a Project open (the key is left to the browser otherwise). */
  needsProject?: boolean
  /** The key chip lists every key, not just the first (Row done: Enter, Space). */
  chipAllKeys?: boolean
  /** Enter and Space give way to a focused Progress bar button, which they press natively. */
  givesWayToFocusedButton?: boolean
}

const selectTool = (id: Tool, key: string, icon: IconName, name: (t: Translations) => string, group: ControlGroup = 'tools', body?: ControlAction['body']): ControlAction => ({
  id: `tool-${id}`,
  icon,
  name,
  body,
  group,
  chords: [{ key, label: key }],
  run: (deps) => deps.onSelectTool(id),
})


const frameLocked = (deps: ControlDeps) => {
  const project = deps.activeProject()
  return project !== undefined && rowProgressStarted(project)
}
/** Whether the open Project has Row progress on (it has a Frame), so Enter and Space move the row (ticket 434). */
const rowProgressIsOn = (deps: ControlDeps) => {
  const project = deps.activeProject()
  return project !== undefined && rowProgressOn(project)
}
const hasFrame = (deps: ControlDeps) => deps.activeProject()?.frame !== undefined
const hasBeads = (deps: ControlDeps) => {
  const project = deps.activeProject()
  return project !== undefined && hasProjectBeads(project)
}

/** One of the Frame panel's steppers (tickets 417, 473): an edge a bead out or in, named for its edge. Moving in stops
 * at four beads. */
const frameEdgeAction = (edge: FrameEdge, direction: 'out' | 'in'): ControlAction => ({
  id: `frame-edge-${edge}-${direction}`,
  name: (t) => t.frame[direction === 'out' ? 'edgeOut' : 'edgeIn'][edge],
  body: (t) => (direction === 'out' ? t.tooltips.frameEdgeOut : t.tooltips.frameEdgeIn),
  enabled: (deps) => {
    const project = deps.activeProject()
    if (!project?.frame || frameLocked(deps)) return false
    return direction === 'out' || frameWithEdgeStep(project, project.frame, edge, -1) !== project.frame
  },
  disabledBody: (t, deps) => (frameLocked(deps) ? t.tooltips.frameSizeLocked : t.tooltips.frameEdgeInDisabled),
  group: 'canvas',
  chords: [],
})

/** A control with no key, so it only lists its Tooltip copy (ticket 334); its surface runs it. */
const unkeyed = (id: string, name: ControlAction['name'], group: ControlGroup, rest: Partial<Disableable> & { body?: ControlAction['body']; icon?: IconName; shownKey?: string } = {}): ControlAction =>
  ({ id, name, group, chords: [], ...rest }) as ControlAction

// The control registry (ADR 0035, ticket 329): every action with a key, defined once; the shortcut table and the
// shortcuts dialog (in this order) are built from it. A test fails if two actions share a key.
export const CONTROLS: readonly ControlAction[] = [
  selectTool('paint', '1', 'paint', (t) => t.tools.paintLabel, 'tools'),
  selectTool('fill', '2', 'fill', (t) => t.tools.fillLabel, 'tools'),
  selectTool('select', '3', 'select', (t) => t.tools.selectLabel, 'tools', (t) => t.tooltips.select),
  selectTool('piece', '6', 'piece', (t) => t.tools.pieceLabel, 'tools', (t) => t.tooltips.piece),
  {
    id: 'select-all',
    icon: 'select-all',
    name: (t) => t.tools.selectAllLabel,
    body: (t) => t.tooltips.selectAll,
    group: 'tools',
    chords: [{ key: 'a', mod: true, label: 'A' }],
    preventDefault: true,
    needsProject: true,
    run: (deps) => deps.onSelectAll(),
  },
  selectTool('erase', '4', 'erase', (t) => t.tools.eraseLabel, 'tools', (t) => t.tooltips.erase),
  {
    id: 'empty-selection',
    icon: 'delete',
    name: (t) => t.contextBar.clearButton,
    group: 'tools',
    chords: [{ key: 'Delete', label: 'Del' }],
    run: (deps) => {
      if (deps.hasSelection()) deps.onClearSelection()
    },
  },
  {
    id: 'back-out',
    icon: 'close',
    name: (t) => t.shortcutsHelp.backOut,
    group: 'tools',
    chords: [{ key: 'Escape', shift: 'any', label: 'Esc' }],
    allowWhileTyping: true,
    run: (deps) => {
      // Picking a color from the canvas (ticket 398) is the first thing Escape ends.
      if (deps.cancelColorPick()) return
      // Then the paste preview, the Selection.
      if (deps.backOutOfSelect()) return
      // Ticket 214: with nothing left to dismiss, Escape falls through to Paint.
      if (deps.activeTool() !== 'paint') deps.onSelectTool('paint')
    },
  },
  selectTool('hand', '5', 'hand', (t) => t.tools.handLabel, 'canvas', (t) => t.tooltips.hand),
  {
    id: 'tool-paste',
    icon: 'paste',
    name: (t) => t.tools.pasteLabel,
    body: (t) => t.tooltips.pasteTool,
    group: 'canvas',
    chords: [{ key: '7', label: '7' }],
    run: (deps) => deps.onPasteMode(),
  },
  {
    id: 'edit-frame',
    icon: 'pencil',
    name: (t) => t.frame.editFrame,
    body: (t) => t.tooltips.editFrame,
    enabled: hasFrame,
    disabledBody: (t) => t.tooltips.setFrameFirst,
    group: 'canvas',
    chords: [],
    needsProject: true,
    run: (deps) => deps.onEditFrame(),
  },
  {
    id: 'strip-frame',
    icon: 'frame',
    name: (t) => t.frame.title,
    body: (t) => t.tooltips.framePanel,
    // Always there, with or without a Frame, and once a pass is done too (tickets 475, 555).
    group: 'canvas',
    chords: [],
    needsProject: true,
    run: (deps) => deps.onToggleFramePanel(),
  },
  ...FRAME_EDGES.flatMap((edge) => [frameEdgeAction(edge, 'out'), frameEdgeAction(edge, 'in')]),
  {
    id: 'rulers',
    icon: 'ruler',
    name: (t) => t.canvas.rulersLabel,
    group: 'canvas',
    chords: [{ key: 'r', label: 'R' }],
    run: (deps) => deps.onToggleRulers(),
  },
  {
    id: 'zoom-in',
    icon: 'zoom-in',
    name: (t) => t.canvas.zoomInLabel,
    group: 'canvas',
    chords: [{ key: ['+', '='], mod: true, shift: 'any', label: '+' }],
    preventDefault: true,
    allowWhileTyping: true,
    modals: 'claim',
    run: (deps) => deps.onZoomIn(),
  },
  {
    id: 'zoom-out',
    icon: 'zoom-out',
    name: (t) => t.canvas.zoomOutLabel,
    group: 'canvas',
    chords: [{ key: ['-', '_'], mod: true, shift: 'any', label: '−' }],
    preventDefault: true,
    allowWhileTyping: true,
    modals: 'claim',
    run: (deps) => deps.onZoomOut(),
  },
  {
    id: 'zoom-fit',
    icon: 'fit',
    name: (t) => t.canvas.zoomResetLabel,
    body: (t) => t.tooltips.zoomFit,
    group: 'canvas',
    chords: [{ key: '0', mod: true, shift: 'any', label: '0' }],
    preventDefault: true,
    allowWhileTyping: true,
    modals: 'claim',
    run: (deps) => deps.onFit(),
  },
  {
    id: 'shortcuts-help',
    icon: 'keyboard',
    name: (t) => t.shortcutsHelp.title,
    group: 'canvas',
    chords: [{ key: '?', shift: 'any', label: '?' }],
    run: (deps) => deps.openShortcutsHelp(),
  },
  {
    id: 'palette-color',
    name: (t) => t.palette.colorLabel,
    group: 'colors',
    chords: PALETTE_SHORTCUTS.map(({ code, keyLabel }) => ({ code, shift: true, label: keyLabel })),
    help: { name: (t) => t.shortcutsHelp.paletteColors, keys: [['Shift', '1…9'], ['Shift', '0']] },
    run: (deps, event) => deps.onPickColorKey(PALETTE_SHORTCUTS.findIndex((s) => s.code === event.code)),
  },
  {
    id: 'undo',
    icon: 'undo',
    name: (t) => t.palette.undoButton,
    enabled: (deps) => deps.canUndo(),
    disabledBody: (t) => t.tooltips.nothingToUndo,
    group: 'edit',
    chords: [{ key: 'z', mod: true, label: 'Z' }],
    preventDefault: true,
    modals: 'ignore',
    run: (deps) => deps.onUndo(),
  },
  {
    id: 'redo',
    icon: 'redo',
    name: (t) => t.palette.redoButton,
    enabled: (deps) => deps.canRedo(),
    disabledBody: (t) => t.tooltips.nothingToRedo,
    group: 'edit',
    // Ctrl+Y is the older Windows convention.
    chords: [
      { key: 'z', mod: true, shift: true, label: 'Z' },
      { key: 'y', ctrl: true, label: 'Y' },
    ],
    preventDefault: true,
    modals: 'ignore',
    run: (deps) => deps.onRedo(),
  },
  {
    id: 'copy',
    icon: 'copy',
    name: (t) => t.tools.copyButton,
    enabled: (deps) => deps.hasSelection() && deps.selectionHasBeads(),
    disabledBody: (t, deps) => (deps.hasSelection() ? t.tooltips.copyNoBeads : t.tooltips.copyDisabled),
    group: 'edit',
    chords: [{ key: 'c', mod: true, label: 'C' }],
    preventDefault: true,
    run: (deps) => deps.onCopy(),
  },
  {
    id: 'paste',
    icon: 'paste',
    name: (t) => t.tools.pasteLabel,
    enabled: (deps) => deps.hasClipboard(),
    disabledBody: (t) => t.tooltips.pasteDisabled,
    group: 'edit',
    chords: [{ key: 'v', mod: true, label: 'V' }],
    run: (deps, event) => deps.pasteAtPointer(event),
  },
  {
    id: 'cut',
    icon: 'cut',
    name: (t) => t.tools.cutButton,
    enabled: (deps) => deps.hasSelection() && deps.selectionHasBeads(),
    disabledBody: (t, deps) => (deps.hasSelection() ? t.tooltips.cutNoBeads : t.tooltips.copyDisabled),
    group: 'edit',
    chords: [{ key: 'x', mod: true, label: 'X' }],
    preventDefault: true,
    run: (deps) => deps.onCut(),
  },
  unkeyed('fill-selection', (t) => t.tools.fillLabel, 'edit', {
    icon: 'fill-selection',
    body: (t) => t.tooltips.fillSelection,
    enabled: (deps: ControlDeps) => deps.hasPaintColor(),
    disabledBody: (t: Translations) => t.tooltips.fillNeedsColor,
  }),
  unkeyed('frame-from-selection', (t) => t.frame.title, 'canvas', {
    icon: 'frame',
    body: (t) => t.tooltips.frameFromSelection,
    enabled: (deps: ControlDeps) => !frameLocked(deps),
    disabledBody: (t: Translations) => t.tooltips.rowProgressLockedFrame,
  }),
  {
    id: 'rotate',
    icon: 'rotate',
    name: (t) => t.palette.rotateButton,
    body: (t) => t.tooltips.rotate,
    enabled: (deps) => deps.hasSelection() && !deps.selectionInFinishedRows(),
    disabledBody: (t, deps) => (deps.hasSelection() ? t.tooltips.rotateInFinishedRows : t.tooltips.copyDisabled),
    group: 'edit',
    chords: [{ key: 'r', shift: true, label: 'R' }],
    run: (deps) => deps.onRotate(),
  },
  {
    id: 'remove-line',
    icon: 'remove-line',
    name: (t) => t.tools.removeLineButton,
    body: (t) => t.tooltips.removeLine,
    enabled: (deps) => deps.canRemoveSelectedLine(),
    disabledBody: (t) => t.tooltips.removeLineDisabled,
    group: 'edit',
    chords: [{ key: 'Delete', shift: true, label: 'Del' }],
    run: (deps) => {
      if (deps.canRemoveSelectedLine()) deps.onRemoveSelectedLine()
    },
  },
  {
    id: 'name-piece',
    icon: 'name-piece',
    name: (t) => t.tools.namePieceButton,
    body: (t) => t.tooltips.namePiece,
    enabled: (deps) => deps.canNamePiece(),
    disabledBody: (t) => t.tooltips.namePieceDisabled,
    group: 'edit',
    chords: [],
    run: (deps) => {
      if (deps.canNamePiece()) deps.onNamePiece()
    },
  },
  {
    id: 'row-direction',
    icon: 'turn-row-direction',
    name: (t) => t.rowProgress.directionButton,
    group: 'rowProgress',
    chords: [{ key: 'd', label: 'D' }],
    run: (deps) => deps.onToggleRowDirection(),
  },
  {
    id: 'row-highlight',
    icon: 'row-highlight',
    name: (t) => t.rowProgress.highlightButton,
    group: 'rowProgress',
    chords: [],
    run: (deps) => deps.onToggleRowHighlight(),
  },
  {
    id: 'row-done',
    name: (t) => t.rowProgress.nextButton,
    group: 'rowProgress',
    chords: [
      { key: 'Enter', label: 'Enter' },
      { key: ' ', label: 'Space' },
    ],
    chipAllKeys: true,
    givesWayToFocusedButton: true,
    run: (deps) => {
      if (rowProgressIsOn(deps)) deps.onMoveRow(1)
    },
  },
  {
    id: 'row-not-done',
    name: (t) => t.rowProgress.previousButton,
    group: 'rowProgress',
    chords: [
      { key: 'Enter', shift: true, label: 'Enter' },
      { key: ' ', shift: true, label: 'Space' },
    ],
    chipAllKeys: true,
    givesWayToFocusedButton: true,
    run: (deps) => {
      if (rowProgressIsOn(deps)) deps.onMoveRow(-1)
    },
  },
  unkeyed('remove-frame', (t) => t.frame.removeFrame, 'canvas', {
    icon: 'delete',
    body: (t) => t.tooltips.removeFrame,
    // Allowed once a pass is done too: it asks first, and clears the passes with the Frame (ticket 426).
    enabled: hasFrame,
    disabledBody: (t: Translations) => t.tooltips.noFrameToRemove,
  }),
  // Both are held still once a pass is done: the passes belong to the Frame (ticket 495).
  unkeyed('add-frame-from-starter', (t) => t.frame.addFromStarter, 'canvas', {
    icon: 'plus',
    body: (t) => t.tooltips.frameFromStarter,
    enabled: (deps: ControlDeps) => !frameLocked(deps),
    disabledBody: (t: Translations) => t.tooltips.rowProgressLockedFrameFromStarter,
  }),
  unkeyed('replace-frame', (t) => t.frame.replaceFrame, 'canvas', {
    icon: 'plus',
    body: (t) => t.tooltips.replaceFrame,
    enabled: (deps: ControlDeps) => !frameLocked(deps),
    disabledBody: (t: Translations) => t.tooltips.rowProgressLockedFrameFromStarter,
  }),
  unkeyed('rotate-frame', (t) => t.frame.rotateFrameLabel, 'canvas', {
    icon: 'rotate',
    body: (t) => t.tooltips.rotateFrame,
    enabled: hasFrame,
    disabledBody: (t: Translations) => t.tooltips.setFrameFirst,
  }),
  // A view setting like Row direction: allowed after a Row progress pass is done, so only an empty Canvas disables it (ticket 471).
  unkeyed('rotate-canvas', (t) => t.canvas.rotateCanvasLabel, 'canvas', {
    icon: 'rotate-canvas',
    body: (t) => t.tooltips.rotateCanvas,
    enabled: hasBeads,
    disabledBody: (t: Translations) => t.tooltips.noBeadsToRotate,
  }),
  unkeyed('move-frame', (t) => t.frame.moveHandle, 'canvas', { body: (t) => t.tooltips.moveFrame }),
  unkeyed('reset-progress', (t) => t.rowProgress.resetButton, 'rowProgress', {
    icon: 'reset',
    body: (t) => t.tooltips.resetProgress,
    enabled: (deps: ControlDeps) => {
      const project = deps.activeProject()
      return !!project && rowProgressStarted(project)
    },
    disabledBody: (t: Translations) => t.tooltips.noProgressToReset,
  }),
  unkeyed('change-technique', (t) => t.form.techniqueLabel, 'canvas', {
    body: (t) => t.tooltips.changeTechnique,
    enabled: (deps: ControlDeps) => !frameLocked(deps),
    disabledBody: (t: Translations) => t.tooltips.rowProgressLockedTechnique,
  }),
  unkeyed('fit-to-drawing', (t) => t.frame.fitToDrawing, 'canvas', {
    body: (t) => t.tooltips.fitToDrawing,
    enabled: (deps: ControlDeps) => !frameLocked(deps) && hasBeads(deps),
    disabledBody: (t: Translations, deps: ControlDeps) => (frameLocked(deps) ? t.tooltips.rowProgressLockedFrame : t.tooltips.noBeadsToFit),
  }),
  unkeyed('clear', (t) => t.deleteAll.button, 'edit', { icon: 'delete', body: (t) => t.tooltips.clear }),
  unkeyed('custom-color', (t) => t.palette.customColorLabel, 'colors', { body: (t) => t.tooltips.customColor }),
  unkeyed('pick-color', (t) => t.palette.pickFromCanvasLabel, 'colors', {
    icon: 'eyedropper',
    body: (t) => t.tooltips.pickFromCanvas,
    shownKey: 'Esc',
  }),
  unkeyed('strip-project', (t) => t.header.projectPanelLabel, 'edit', {
    icon: 'pattern',
    body: (t) => t.tooltips.list([t.form.techniqueLabel, t.panels.project.exportHeading, t.panels.project.duplicate]),
  }),
  unkeyed('strip-menu', (t) => t.header.menuButton, 'edit', {
    icon: 'menu',
    body: (t) => t.tooltips.list([t.projects.newProjectButton, t.transfer.importLabel, t.projects.heading, t.languageSwitcher.ariaLabel, t.theme.groupLabel]),
  }),
  unkeyed('strip-coffee', (t) => t.panels.menu.coffee, 'edit', { icon: 'coffee' }),
  unkeyed('pen-mode', (t) => t.inputMode.penLabel, 'canvas', { icon: 'pen-mode', body: (t) => t.inputMode.penHint }),
  unkeyed('mouse-mode', (t) => t.inputMode.mouseLabel, 'canvas', { icon: 'pen-mode-off', body: (t) => t.inputMode.mouseHint }),
  unkeyed('saved-projects', (t) => t.projects.heading, 'edit', { icon: 'library' }),
  unkeyed('close', (t) => t.a11y.closeMessage, 'edit', { icon: 'close' }),
  unkeyed('edit-palette', (t) => t.palette.editPalette, 'colors', { icon: 'pencil' }),
  unkeyed('remove-all-colors', (t) => t.palette.removeAllColors, 'colors', { icon: 'delete' }),
  unkeyed('pill-colors', (t) => t.toolbox.groups.colors, 'colors', { body: (t) => t.tooltips.colors }),
  unkeyed('new-project', (t) => t.projects.newProjectButton, 'edit', { body: (t) => t.tooltips.newProject }),
  unkeyed('import-file', (t) => t.transfer.importLabel, 'edit', { body: (t) => t.tooltips.importFile }),
  unkeyed('change-maker-name', (t) => t.saveBox.changeName, 'edit', { body: (t) => t.tooltips.changeName }),
  unkeyed('rename-project', (t) => t.panels.project.renameAction, 'edit', { icon: 'pencil', body: (t) => t.panels.project.tooltipRename }),
  unkeyed('duplicate-project', (t) => t.panels.project.duplicate, 'edit', { icon: 'copy', body: (t) => t.panels.project.tooltipDuplicate }),
  unkeyed('delete-project', (t) => t.panels.project.deleteThis, 'edit', { icon: 'delete', body: (t) => t.panels.project.tooltipDelete }),
  unkeyed('delete-all-projects', (t) => t.panels.menu.deleteAll, 'edit', { icon: 'delete', body: (t) => t.panels.menu.tooltipDeleteAll }),
  unkeyed('clear-project', (t) => t.panels.project.clear, 'edit', { icon: 'erase', body: (t) => t.panels.project.tooltipClear }),
  unkeyed('export-all', (t) => t.transfer.exportLibraryButton, 'edit', { icon: 'export' }),
  unkeyed('export-png', (t) => t.panels.project.exportPng, 'edit', { icon: 'image' }),
  unkeyed('export-pdf', (t) => t.panels.project.exportPdf, 'edit', { icon: 'pdf' }),
  unkeyed('export-project-file', (t) => t.panels.project.exportFile, 'edit', { icon: 'export' }),
  unkeyed('tools-position', (t) => t.toolPill.position, 'canvas'),
  unkeyed('input-mode', (t) => t.panels.menu.input, 'canvas', { icon: 'pen-mode' }),
  unkeyed('convert-image', (t) => t.convertImage.fileLabel, 'edit', { body: (t) => t.tooltips.convertImage }),
  // The Convert image wizard's own controls (ticket 0650): its zoom is the Canvas's, its Close the shared one.
  unkeyed('treat-as-empty', (t) => t.convertImage.wizard.treatAsEmpty, 'edit', { icon: 'eyedropper', body: (t) => t.tooltips.treatAsEmpty }),
  unkeyed('remap-color', (t) => t.convertImage.wizard.remap, 'colors', { icon: 'paint', body: (t) => t.tooltips.remapColor }),
  unkeyed('empty-color', (t) => t.convertImage.wizard.empty, 'colors', { icon: 'erase', body: (t) => t.tooltips.emptyColor }),
  ...RATIO_PRESETS.map((ratio) =>
    unkeyed(`pixel-ratio-${ratioId(ratio)}`, (t) => fillBlanks(t.convertImage.wizard.ratioChip, { ratio: ratioText(ratio) }), 'edit', {
      body: (t) => ratioSentence(t, ratio),
    }),
  ),
  unkeyed('pixel-ratio-custom', (t) => t.convertImage.wizard.customRatio, 'edit', { body: (t) => t.tooltips.customRatio }),
  ...CONVERT_STEPS.map((step) => unkeyed(`convert-step-${step}`, (t) => t.convertImage.wizard.rail[step], 'edit')),
  ...CROP_HANDLES.map((handle) => unkeyed(`crop-${handle}`, (t) => t.convertImage.wizard.crop[handle], 'edit')),
]

/** The gestures with no key the dialog still lists beside the keys (ticket 95): not actions, so not in CONTROLS. */
export const POINTER_HELP: readonly { group: ControlGroup; name: (t: Translations) => string; keys: readonly (readonly string[])[] }[] = [
  { group: 'canvas', name: (t) => t.shortcutsHelp.panCanvas, keys: [['Space', 'drag']] },
  { group: 'canvas', name: (t) => t.shortcutsHelp.zoomCanvas, keys: [['Ctrl/Cmd', 'wheel']] },
]

/** Whether a key press is this chord. */
export function chordMatches(chord: Chord, event: KeyboardEvent): boolean {
  const modifier = chord.mod ? event.ctrlKey || event.metaKey : chord.ctrl ? event.ctrlKey && !event.metaKey : !event.ctrlKey && !event.metaKey
  if (!modifier || event.altKey) return false
  if (chord.shift !== 'any' && event.shiftKey !== !!chord.shift) return false
  if (chord.code !== undefined) return event.code === chord.code
  const keys = typeof chord.key === 'string' ? [chord.key] : (chord.key ?? [])
  return keys.some((key) => key.toLowerCase() === event.key.toLowerCase())
}

/** What a control reads to know if its action is enabled and why not (ADR 0035); a surface that only shows controls
 * passes this, not the handlers. */
export type ControlState = Partial<Pick<ControlDeps, 'canUndo' | 'canRedo' | 'hasClipboard' | 'hasSelection' | 'selectionHasBeads' | 'selectionInFinishedRows' | 'canRemoveSelectedLine' | 'canNamePiece' | 'hasPaintColor'>> & Pick<ControlDeps, 'activeProject'>

/** The state a surface knows, as the `deps` a shared control hands its action's `enabled` and `disabledBody`. */
export function controlDeps(state: ControlState): ControlDeps {
  return state as ControlDeps
}

/** One action by id, for a control that shows it. */
export function controlAction(id: string): ControlAction {
  const action = CONTROLS.find((control) => control.id === id)
  if (!action) throw new Error(`No control "${id}" in the registry`)
  return action
}
