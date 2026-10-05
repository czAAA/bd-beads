import { PALETTE, PALETTE_SHORTCUTS } from '../../domain/palette'
import type { Project } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'

/** What the shortcut table needs from the app shell: state read lazily, and the handlers each shortcut calls. */
export interface AppShortcutTableDeps {
  activeProject: () => Project | undefined
  activeTool: () => Tool
  hasSelection: () => boolean
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
  onToggleRowProgress: (enabled: boolean) => void
  onToggleRowDirection: () => void
  onMoveRow: (delta: number) => void
  openShortcutsHelp: () => void
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

/** `event.key` is exactly `key` (case-insensitively), with no modifier held at all -- the shape every plain-letter/digit shortcut below (1/2/3, R, P, D) shares, so each just names its own key instead of repeating the guard. */
function isPlainLetterKey(event: KeyboardEvent, key: string): boolean {
  return event.key.toLowerCase() === key.toLowerCase() && isPlainKey(event) && !event.shiftKey
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
 * The app's keyboard shortcuts (tickets 86-96, 115, 178; ADR 0023): the guard predicates and the table handed to the
 * generic useKeyboardShortcuts, the only place that composable is called. Deps are read lazily.
 */
export function useAppShortcutTable(deps: AppShortcutTableDeps) {
  /** Withholds a shortcut while a menu or a dialog (anyDialogOpen) is open — same precedence Escape already gives those modals (see the Escape entry below). */
  function noModalOpen(): boolean {
    return !deps.hasOpenLayer() && !deps.anyDialogOpen()
  }

  /**
   * The table (ticket 86) driving useKeyboardShortcuts below: Undo, Redo and Escape from ticket 86 itself, plus every
   * Toolbox shortcut tickets 87-96 added, grouped the same way the Toolbox's own Tool groups are, without touching
   * the dispatcher itself.
   */
  const shortcuts: KeyboardShortcut[] = [
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
        if (deps.collapseExpandedToolGroup()) {
          return
        }
        // Set Frame is a mode: Escape is its way out, before Select or the default tool take it.
        if (deps.settingFrame()) {
          deps.finishFrame()
          return
        }
        if (deps.backOutOfSelect()) {
          return
        }
        // ticket 214: an Escape with nothing left to dismiss falls through to the default tool.
        if (deps.activeTool() !== 'paint') {
          deps.onSelectTool('paint')
        }
      },
    },
    {
      matches: isRedoShortcut,
      action: (event) => {
        event.preventDefault()
        deps.onRedo()
      },
    },
    {
      matches: isUndoShortcut,
      action: (event) => {
        event.preventDefault()
        deps.onUndo()
      },
    },
    // Tools group (ticket 87): 1/2/3 select Paint/Fill/Select (4/5/6: Erase/Hand/Frame below), the same as clicking that button.
    {
      matches: (event) => isPlainLetterKey(event, '1'),
      guard: noModalOpen,
      action: () => deps.onSelectTool('paint'),
    },
    {
      matches: (event) => isPlainLetterKey(event, '2'),
      guard: noModalOpen,
      action: () => deps.onSelectTool('fill'),
    },
    {
      matches: (event) => isPlainLetterKey(event, '3'),
      guard: noModalOpen,
      action: () => deps.onSelectTool('select'),
    },
    // Canvas group (v16): 5 picks the Hand tool (ticket 292), which moves the canvas and never changes a bead.
    {
      matches: (event) => isPlainLetterKey(event, '5'),
      guard: noModalOpen,
      action: () => deps.onSelectTool('hand'),
    },
    // ticket 250/292: 4 picks Eraser.
    {
      matches: (event) => isPlainLetterKey(event, '4'),
      guard: noModalOpen,
      action: () => deps.onSelectTool('erase'),
    },
    // ticket 90: Del clears just the selected cells under Select with a Selection present, else activates Eraser.
    {
      matches: (event) => event.key === 'Delete',
      guard: noModalOpen,
      action: () => {
        if (deps.activeTool() === 'select' && deps.hasSelection()) {
          deps.onDeleteSelection()
        } else {
          deps.onSelectTool('erase')
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
          deps.onSelectColor(color.id)
        }
      },
    },
    // Canvas group (v16): 6 starts Set Frame (ticket 292) (and finishes it).
    {
      matches: (event) => isPlainLetterKey(event, '6'),
      guard: () => noModalOpen() && !!deps.activeProject(),
      action: () => deps.onToggleFrame(),
    },
    // Canvas group (v16): R shows and hides the rulers. Rotate lost the key to it; the Edit group's button remains.
    {
      matches: (event) => isPlainLetterKey(event, 'r'),
      guard: noModalOpen,
      action: () => deps.onToggleRulers(),
    },
    // Edit group (ticket 91): Ctrl/Cmd+C copies the active Selection.
    {
      matches: (event) => (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'c',
      guard: noModalOpen,
      action: (event) => {
        event.preventDefault()
        deps.onCopy()
      },
    },
    // ticket 92: Ctrl/Cmd+V pastes at the cell under the pointer, regardless of the active tool.
    {
      matches: (event) => (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'v',
      guard: noModalOpen,
      action: deps.pasteAtPointer,
    },
    // ticket 115: Ctrl/Cmd+S saves. Claimed from the browser only while a Project is open to save — with none, the browser's own dialog is left alone rather than swallowed for nothing.
    {
      matches: (event) => (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's',
      guard: () => noModalOpen() && !!deps.activeProject(),
      allowWhileTyping: true,
      action: (event) => {
        event.preventDefault()
        deps.onSave()
      },
    },
    // Row progress group (ticket 94): P toggles it on/off, D toggles direction, Enter/Shift+Enter (and Space/
    // Shift+Space, ticket 178) move the pointer.
    {
      matches: (event) => isPlainLetterKey(event, 'p'),
      guard: noModalOpen,
      action: () => {
        const project = deps.activeProject()
        if (project) {
          deps.onToggleRowProgress(!project.rowProgress.enabled)
        }
      },
    },
    {
      matches: (event) => isPlainLetterKey(event, 'd'),
      guard: noModalOpen,
      action: () => deps.onToggleRowDirection(),
    },
    {
      matches: (event) => event.key === 'Enter' && !event.shiftKey && !isFocusedOnToolboxButton(event),
      guard: noModalOpen,
      action: () => {
        if (deps.activeProject()?.rowProgress.enabled) {
          deps.onMoveRow(1)
        }
      },
    },
    {
      matches: (event) => event.key === 'Enter' && event.shiftKey && !isFocusedOnToolboxButton(event),
      guard: noModalOpen,
      action: () => {
        if (deps.activeProject()?.rowProgress.enabled) {
          deps.onMoveRow(-1)
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
        if (deps.activeProject()?.rowProgress.enabled) {
          deps.onMoveRow(1)
        }
      },
    },
    {
      matches: (event) => event.key === ' ' && event.shiftKey && !isFocusedOnToolboxButton(event),
      guard: noModalOpen,
      action: () => {
        if (deps.activeProject()?.rowProgress.enabled) {
          deps.onMoveRow(-1)
        }
      },
    },
    // ticket 96: ? opens the shortcuts help overlay.
    {
      matches: (event) => event.key === '?',
      guard: noModalOpen,
      action: () => {
        deps.openShortcutsHelp()
      },
    },
  ]

  useKeyboardShortcuts(shortcuts)
}
