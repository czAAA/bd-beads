import { type Chord } from '../../domain/chord'
import { MIRROR_ENABLED } from '../../features'
import type { IconName } from '../../components/ui/icons'
import { MAX_ADDED_COLORS, PALETTE, PALETTE_SHORTCUTS } from '../../domain/palette'
import type { Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import type { Translations } from '../../i18n/translations'

/** What a control's action needs from the app shell: state read lazily, and the handlers the actions call. */
export interface ControlDeps {
  activeProject: () => Project | undefined
  activeTool: () => Tool
  hasSelection: () => boolean
  /** What the enabled states read (ticket 334): history, the clipboard and the Palette's added colors. */
  canUndo: () => boolean
  canRedo: () => boolean
  hasClipboard: () => boolean
  addedColorCount: () => number
  /** A menu or popover layer is open (useEscapeLayer). */
  hasOpenLayer: () => boolean
  /** A confirmation modal, the QR panel or the shortcuts help overlay is open. */
  anyDialogOpen: () => boolean
  /** Collapses an expanded Tool group; true if one was open. */
  collapseExpandedToolGroup: () => boolean
  /** Dismisses the paste preview, else clears the Selection; true if either was there. */
  backOutOfSelect: () => boolean
  onUndo: () => void
  onRedo: () => void
  onSelectTool: (tool: Tool) => void
  onSelectColor: (colorId: string) => void
  onDeleteSelection: () => void
  onToggleRulers: () => void
  /** 6: starts Set Frame, or finishes it. */
  onToggleFrame: () => void
  /** Whether the Frame is being set, and the way out of it. */
  settingFrame: () => boolean
  finishFrame: () => void
  onCopy: () => void
  pasteAtPointer: (event: KeyboardEvent) => void
  onSave: () => void
  onRotate: () => void
  /** Whether Remove row/column applies right now: a whole row or column is selected and Row progress is off. */
  canRemoveSelectedLine: () => boolean
  onRemoveSelectedLine: () => void
  onToggleRowProgress: (enabled: boolean) => void
  onToggleRowDirection: () => void
  onMoveRow: (delta: number) => void
  openShortcutsHelp: () => void
  /** Ctrl/⌘ + plus, minus and 0: Canvas zoom in, out and Fit (ticket 316). */
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  /** Mirror (switched off, ticket 365): steps the left–right or top–bottom axis count, as seen on screen. */
  onStepMirrorAxis: (direction: 'leftRight' | 'topBottom', delta: number) => void
  onToggleMirrorCopyMode: () => void
  onMirrorCurrent: (axis: 'horizontal' | 'vertical') => void
}

/** Every group of the Keyboard shortcuts dialog; the Toolbox's own names are tools, colors, edit, mirror and rowProgress. */
export type ControlGroup = 'tools' | 'canvas' | 'colors' | 'edit' | 'mirror' | 'rowProgress'

/** The groups the dialog lists, in order; Mirror's is there only while Mirror is on (MIRROR_ENABLED). */
export const CONTROL_GROUPS: readonly ControlGroup[] = ['tools', 'canvas', 'colors', 'edit', ...(MIRROR_ENABLED ? (['mirror'] as const) : []), 'rowProgress']

/** Whether the action's key runs while a menu or dialog is open: not at all, regardless, or claimed from the browser but not run. */
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
  /** The Keyboard shortcuts dialog's wording when it differs from `name` and `chords` (one row for the whole Palette). */
  help?: { name: (t: Translations) => string; keys: readonly (readonly string[])[] }
  /** Runs from a key press: the key is claimed from the browser first when `preventDefault`. Absent where there is no key: the control's own surface runs it. */
  run?: (deps: ControlDeps, event: KeyboardEvent) => void
  preventDefault?: boolean
  allowWhileTyping?: boolean
  modals?: ModalRule
  /** Only with a Project open (the key is left to the browser otherwise). */
  needsProject?: boolean
  /** The key chip lists every key, not just the first (Row done: Enter, Space). */
  chipAllKeys?: boolean
  /** Enter and Space give way to a focused Toolbox or Progress bar button, which they press natively. */
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


const frameLocked = (deps: ControlDeps) => deps.activeProject()?.rowProgress.enabled === true
const hasFrame = (deps: ControlDeps) => deps.activeProject()?.frame !== undefined
const maxAdded = (text: string) => text.replace('{max}', String(MAX_ADDED_COLORS))

/** A control with no key, so it only lists its Tooltip copy (ticket 334); its surface runs it. */
const unkeyed = (id: string, name: ControlAction['name'], group: ControlGroup, rest: Partial<Disableable> & { body?: ControlAction['body']; icon?: IconName; shownKey?: string } = {}): ControlAction =>
  ({ id, name, group, chords: [], ...rest }) as ControlAction

/** Mirror's actions (ADR 0006): -/= step Left–right, [/] step Top–bottom, M toggles copy mode, H/V are Mirror current. */
const MIRROR_CONTROLS: readonly ControlAction[] = [
  {
    id: 'mirror-left-right-decrease',
    icon: 'mirror-horizontal',
    name: (t) => t.mirror.decreaseLeftRightButton,
    group: 'mirror',
    chords: [{ key: '-', label: '−' }],
    needsProject: true,
    run: (deps) => deps.onStepMirrorAxis('leftRight', -1),
  },
  {
    id: 'mirror-left-right-increase',
    icon: 'mirror-horizontal',
    name: (t) => t.mirror.increaseLeftRightButton,
    group: 'mirror',
    chords: [{ key: '=', label: '=' }],
    needsProject: true,
    run: (deps) => deps.onStepMirrorAxis('leftRight', 1),
  },
  {
    id: 'mirror-top-bottom-decrease',
    icon: 'mirror-vertical',
    name: (t) => t.mirror.decreaseTopBottomButton,
    group: 'mirror',
    chords: [{ key: '[', label: '[' }],
    needsProject: true,
    run: (deps) => deps.onStepMirrorAxis('topBottom', -1),
  },
  {
    id: 'mirror-top-bottom-increase',
    icon: 'mirror-vertical',
    name: (t) => t.mirror.increaseTopBottomButton,
    group: 'mirror',
    chords: [{ key: ']', label: ']' }],
    needsProject: true,
    run: (deps) => deps.onStepMirrorAxis('topBottom', 1),
  },
  {
    id: 'mirror-copy-mode',
    icon: 'mirror-copy-mode',
    name: (t) => t.mirror.copyModeLabel,
    group: 'mirror',
    chords: [{ key: 'm', label: 'M' }],
    needsProject: true,
    run: (deps) => deps.onToggleMirrorCopyMode(),
  },
  {
    id: 'mirror-current-horizontal',
    icon: 'mirror-horizontal',
    name: (t) => t.mirror.mirrorCurrentHorizontalButton,
    group: 'mirror',
    chords: [{ key: 'h', label: 'H' }],
    needsProject: true,
    run: (deps) => deps.onMirrorCurrent('horizontal'),
  },
  {
    id: 'mirror-current-vertical',
    icon: 'mirror-vertical',
    name: (t) => t.mirror.mirrorCurrentVerticalButton,
    group: 'mirror',
    chords: [{ key: 'v', label: 'V' }],
    needsProject: true,
    run: (deps) => deps.onMirrorCurrent('vertical'),
  },
  unkeyed('dock-mirror', (t) => t.toolbox.groups.mirror, 'mirror', { icon: 'mirror-horizontal' }),
]

/**
 * The control registry (ADR 0035, ticket 329): every action with a key, defined once. The keyboard shortcut table is
 * built from it (useAppShortcutTable) so a key always runs what the button runs, and the Keyboard shortcuts dialog
 * lists it. Order is the dialog's order within each group. A test fails if two actions share a key or combination.
 */
export const CONTROLS: readonly ControlAction[] = [
  selectTool('paint', '1', 'paint', (t) => t.tools.paintLabel, 'tools', (t) => t.tooltips.paint),
  selectTool('fill', '2', 'fill', (t) => t.tools.fillLabel, 'tools', (t) => t.tooltips.fill),
  selectTool('select', '3', 'select', (t) => t.tools.selectLabel, 'tools', (t) => t.tooltips.select),
  selectTool('erase', '4', 'erase', (t) => t.tools.eraseLabel, 'tools', (t) => t.tooltips.erase),
  {
    id: 'empty-selection',
    icon: 'delete',
    name: (t) => t.shortcutsHelp.emptySelection,
    group: 'tools',
    chords: [{ key: 'Delete', label: 'Del' }],
    run: (deps) => {
      if (deps.hasSelection()) deps.onDeleteSelection()
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
      // An expanded Tool group takes the first Escape (ticket 41), then Set Frame, the paste preview, the Selection.
      if (deps.collapseExpandedToolGroup()) return
      if (deps.settingFrame()) {
        deps.finishFrame()
        return
      }
      if (deps.backOutOfSelect()) return
      // Ticket 214: with nothing left to dismiss, Escape falls through to Paint.
      if (deps.activeTool() !== 'paint') deps.onSelectTool('paint')
    },
  },
  selectTool('hand', '5', 'hand', (t) => t.tools.handLabel, 'canvas', (t) => t.tooltips.hand),
  {
    id: 'set-frame',
    icon: 'frame',
    name: (t) => t.frame.setFrame,
    body: (t) => t.tooltips.setFrame,
    group: 'canvas',
    chords: [{ key: '6', label: '6' }],
    needsProject: true,
    run: (deps) => deps.onToggleFrame(),
  },
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
    help: { name: (t) => t.shortcutsHelp.paletteColors, keys: [['Shift', '1…9'], ['Shift', '0'], ['Q'], ['W']] },
    run: (deps, event) => {
      const color = PALETTE[PALETTE_SHORTCUTS.findIndex((s) => s.code === event.code)]
      if (color) deps.onSelectColor(color.id)
    },
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
    enabled: (deps) => deps.hasSelection(),
    disabledBody: (t) => t.tooltips.copyDisabled,
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
    id: 'save',
    icon: 'save',
    name: (t) => t.tools.saveButton,
    body: (t) => t.tooltips.saveProject,
    group: 'edit',
    chords: [{ key: 's', mod: true, label: 'S' }],
    preventDefault: true,
    allowWhileTyping: true,
    needsProject: true,
    run: (deps) => deps.onSave(),
  },
  {
    id: 'rotate',
    icon: 'rotate',
    name: (t) => t.palette.rotateButton,
    body: (t) => t.tooltips.rotate,
    enabled: (deps) => hasFrame(deps) && !frameLocked(deps),
    disabledBody: (t, deps) => (hasFrame(deps) ? t.tooltips.rowProgressLockedRotate : t.tooltips.setFrameFirst),
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
    disabledBody: (t, deps) => (frameLocked(deps) ? t.tooltips.rowProgressLockedRemoveLine : t.tooltips.removeLineDisabled),
    group: 'edit',
    chords: [{ key: 'Delete', shift: true, label: 'Del' }],
    run: (deps) => {
      if (deps.canRemoveSelectedLine()) deps.onRemoveSelectedLine()
    },
  },
  ...(MIRROR_ENABLED ? MIRROR_CONTROLS : []),
  {
    id: 'row-progress',
    icon: 'check',
    name: (t) => t.rowProgress.enabledLabel,
    enabled: hasFrame,
    disabledBody: (t) => t.tooltips.setFrameFirst,
    group: 'rowProgress',
    chords: [{ key: 'p', label: 'P' }],
    run: (deps) => {
      const project = deps.activeProject()
      if (project) deps.onToggleRowProgress(!project.rowProgress.enabled)
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
    id: 'row-done',
    icon: 'check',
    name: (t) => t.rowProgress.nextButton,
    group: 'rowProgress',
    chords: [
      { key: 'Enter', label: 'Enter' },
      { key: ' ', label: 'Space' },
    ],
    chipAllKeys: true,
    givesWayToFocusedButton: true,
    run: (deps) => {
      if (deps.activeProject()?.rowProgress.enabled) deps.onMoveRow(1)
    },
  },
  {
    id: 'row-not-done',
    icon: 'chevron-left',
    name: (t) => t.rowProgress.previousButton,
    group: 'rowProgress',
    chords: [
      { key: 'Enter', shift: true, label: 'Enter' },
      { key: ' ', shift: true, label: 'Space' },
    ],
    chipAllKeys: true,
    givesWayToFocusedButton: true,
    run: (deps) => {
      if (deps.activeProject()?.rowProgress.enabled) deps.onMoveRow(-1)
    },
  },
  unkeyed('remove-frame', (t) => t.frame.removeFrame, 'canvas', {
    icon: 'close',
    body: (t) => t.tooltips.removeFrame,
    enabled: (deps: ControlDeps) => hasFrame(deps) && !frameLocked(deps),
    disabledBody: (t: Translations, deps: ControlDeps) => (hasFrame(deps) ? t.tooltips.rowProgressLockedFrame : t.tooltips.noFrameToRemove),
  }),
  unkeyed('change-technique', (t) => t.form.techniqueLabel, 'canvas', {
    body: (t) => t.tooltips.changeTechnique,
    enabled: (deps: ControlDeps) => !frameLocked(deps),
    disabledBody: (t: Translations) => t.tooltips.rowProgressLockedTechnique,
  }),
  unkeyed('fit-to-drawing', (t) => t.frame.fitToDrawing, 'canvas', {
    body: (t) => t.tooltips.fitToDrawing,
    enabled: (deps: ControlDeps) => !frameLocked(deps) && Object.keys(deps.activeProject()?.beads ?? {}).length > 0,
    disabledBody: (t: Translations, deps: ControlDeps) => (frameLocked(deps) ? t.tooltips.rowProgressLockedFrame : t.tooltips.noBeadsToFit),
  }),
  unkeyed('done-frame', (t) => t.frame.done, 'canvas', { icon: 'check', shownKey: 'Esc' }),
  unkeyed('clear-selection', (t) => t.contextBar.clearButton, 'tools', { icon: 'close', shownKey: 'Esc' }),
  unkeyed('cancel-paste', (t) => t.contextBar.cancelButton, 'tools', { shownKey: 'Esc' }),
  unkeyed('position-marks-dots', (t) => t.canvas.canvasColor.positionMarks.dots, 'canvas', { icon: 'position-dots', body: (t) => t.canvas.canvasColor.positionMarks.dotsBody }),
  unkeyed('position-marks-squares', (t) => t.canvas.canvasColor.positionMarks.squares, 'canvas', { icon: 'position-squares', body: (t) => t.canvas.canvasColor.positionMarks.squaresBody }),
  unkeyed('canvas-color', (t) => t.canvas.canvasColor.label, 'canvas', { body: (t) => t.tooltips.canvasColor }),
  unkeyed('clear', (t) => t.deleteAll.button, 'edit', { icon: 'delete', body: (t) => t.tooltips.clear }),
  unkeyed('custom-color', (t) => t.palette.customColorLabel, 'colors', {
    body: (t) => maxAdded(t.tooltips.customColor),
    enabled: (deps: ControlDeps) => deps.addedColorCount() < MAX_ADDED_COLORS,
    disabledBody: (t: Translations) => maxAdded(t.tooltips.customColorFull),
  }),
  unkeyed('image-colors', (t) => t.convertImage.imageColorsLabel, 'colors', {
    enabled: (deps: ControlDeps) => (deps.activeProject()?.imageColors?.length ?? 0) > 0,
    disabledBody: (t: Translations) => t.tooltips.imageColorsDisabled,
  }),
  unkeyed('dock-tool', (t) => t.toolbox.groups.tools, 'tools', {
    body: (t) => t.tooltips.list([t.tools.paintLabel, t.tools.fillLabel, t.tools.selectLabel, t.tools.eraseLabel, t.tools.handLabel]),
  }),
  unkeyed('dock-frame', (t) => t.frame.title, 'canvas', {
    body: (t) => t.tooltips.list([t.frame.setFrame, t.palette.rotateButton, t.tools.copyButton, t.tools.pasteLabel]),
  }),
  unkeyed('dock-project', (t) => t.header.projectSheetLabel, 'edit', {
    body: (t) => t.tooltips.list([t.projects.newProjectButton, t.transfer.importLabel, t.transfer.importQrLabel, t.projects.heading]),
  }),
  unkeyed('dock-menu', (t) => t.header.menuButton, 'edit', {
    body: (t) => t.tooltips.list([t.languageSwitcher.ariaLabel, t.theme.groupLabel, t.saveBox.nameOnExports, t.shortcutsHelp.title, t.header.overviewItem, t.header.sourceItem]),
  }),
  unkeyed('pen-mode', (t) => t.inputMode.penLabel, 'canvas', { icon: 'pen-mode', body: (t) => t.inputMode.penHint }),
  unkeyed('mouse-mode', (t) => t.inputMode.mouseLabel, 'canvas', { icon: 'pen-mode-off', body: (t) => t.inputMode.mouseHint }),
  unkeyed('saved-projects', (t) => t.projects.heading, 'edit', { icon: 'library' }),
  unkeyed('close', (t) => t.a11y.closeMessage, 'edit', { icon: 'close' }),
  unkeyed('dock-colors', (t) => t.toolbox.groups.colors, 'colors', { body: (t) => t.tooltips.colors }),
  unkeyed('new-project', (t) => t.projects.newProjectButton, 'edit', { body: (t) => t.tooltips.newProject }),
  unkeyed('import-file', (t) => t.transfer.importLabel, 'edit', { body: (t) => t.tooltips.importFile }),
  unkeyed('import-qr', (t) => t.transfer.importQrLabel, 'edit', { body: (t) => t.tooltips.importQr }),
  unkeyed('change-maker-name', (t) => t.saveBox.changeName, 'edit', { body: (t) => t.tooltips.changeName }),
  unkeyed('convert-image', (t) => t.convertImage.fileLabel, 'edit', { body: (t) => t.tooltips.convertImage }),
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

/** Every distinct (modifier, Shift, key) a chord answers to: two actions must share none of them. */
export function chordSlots(chord: Chord): string[] {
  const modifiers = chord.mod ? ['ctrl', 'meta'] : chord.ctrl ? ['ctrl'] : ['']
  const shifts = chord.shift === 'any' ? ['', 'shift'] : [chord.shift ? 'shift' : '']
  const keys = chord.code !== undefined ? [`code:${chord.code}`] : (typeof chord.key === 'string' ? [chord.key] : (chord.key ?? [])).map((key) => key.toLowerCase())
  return modifiers.flatMap((modifier) => shifts.flatMap((shift) => keys.map((key) => `${modifier}+${shift}+${key}`)))
}

/** What a control reads to know if its action is enabled and why not (ADR 0035); a surface that only shows controls passes this, not the handlers. */
export type ControlState = Partial<Pick<ControlDeps, 'canUndo' | 'canRedo' | 'hasClipboard' | 'addedColorCount' | 'hasSelection' | 'canRemoveSelectedLine'>> & Pick<ControlDeps, 'activeProject'>

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
