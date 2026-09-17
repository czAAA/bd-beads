<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BeadQuantities from './components/BeadQuantities.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import NewPatternForm from './components/NewPatternForm.vue'
import PatternCanvas from './components/PatternCanvas.vue'
import PatternList from './components/PatternList.vue'
import PatternTransfer from './components/PatternTransfer.vue'
import Toolbox from './components/Toolbox.vue'
import { useElementSize } from './composables/useElementSize'
import { usePatternZoom } from './composables/usePatternZoom'
import { beadLabel } from './domain/beads'
import type { GridPosition, PreviewCell } from './domain/grid'
import { canRedo, canUndo, emptyHistory, pushHistory, redoStep, undoStep, type History } from './domain/history'
import { clampAxisCount, NO_MIRROR_AXES, type MirrorAxisCounts } from './domain/mirror'
import { findPaletteColor } from './domain/palette'
import {
  copySelection,
  pasteBlock,
  pastedCells,
  selectionBetween,
  type CopiedBlock,
  type Selection,
} from './domain/selection'
import {
  changedCells,
  createPattern,
  deleteAll,
  fillArea,
  isInFinishedRow,
  keepFinishedRows,
  mirrorCurrentForCounts,
  mirrorPattern,
  mirroredCells,
  mirroredCellsForCounts,
  mostRecentlyUpdated,
  moveToRow,
  paintCells,
  paintCellsForCounts,
  resolvePatternBead,
  restoreSnapshot,
  rowProgressPosition,
  setRowProgressEnabled,
  summarizePattern,
  toggleRotated,
  toggleRowDirection,
  type CreatePatternInput,
  type Grid,
  type MirrorAxes,
  type Pattern,
  type UndoEntry,
} from './domain/pattern'
import { loadPatterns, removePattern, savePattern } from './domain/patternStorage'
import type { Tool } from './domain/tool'
import { isRichMirrorEnabled } from './featureFlags'
import { provideI18n } from './i18n/useI18n'

const { t } = provideI18n()

const patterns = ref<Pattern[]>(loadPatterns())
const activePatternId = ref<string | undefined>(mostRecentlyUpdated(patterns.value)?.id)

const activePattern = computed(() =>
  patterns.value.find((pattern) => pattern.id === activePatternId.value),
)

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

/** The canvas area's own element, measured live (ticket 27) so the Pattern's fit zoom tracks the real available space instead of a guessed constant. */
const canvasAreaEl = ref<HTMLElement | null>(null)
const { width: canvasAreaWidth } = useElementSize(canvasAreaEl)

const { zoom, zoomIn, zoomOut, resetZoom } = usePatternZoom(
  () => activePattern.value,
  canvasAreaWidth,
)

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
const activeTool = ref<Tool>('paint')
const mirrorAxes = ref<MirrorAxes>({ horizontal: false, vertical: false })

/**
 * Rich Mirror (ticket 44): on only when VITE_RICH_MIRROR is exactly "true" at build time (see featureFlags.ts) --
 * read once here, the app's one place, and threaded down as a prop rather than re-read per component. With it off,
 * mirrorAxes above is what runs, unchanged from before this ticket.
 */
const richMirror = isRichMirrorEnabled()

/** Per-direction axis counts for rich Mirror (ADR 0006 amendment): grid-space (see domain/mirror.ts), not saved
 * with the Pattern, reset to 0 on a Pattern switch same as mirrorAxes' spirit. Unused, and left at 0, while the flag is off. */
const mirrorAxisCounts = ref<MirrorAxisCounts>({ ...NO_MIRROR_AXES })

/** Rich Mirror's copy-mode switch (ticket 45): strips repeat unflipped (A | A | A) instead of mirror-imaging
 * (A | A' | A) when on. One switch for both directions, editing-session only like mirrorAxisCounts -- reset on a
 * Pattern switch, never saved. Unused while the flag is off. */
const mirrorCopyMode = ref(false)

/** Which "Mirror current" button, if any, the pointer is over right now (ticket 47) -- grid-space ('horizontal'/'vertical'), same as the buttons themselves; null when the pointer is off both. Purely a transient hover UI concern, not persisted. */
const hoveredMirrorCurrentAxis = ref<'horizontal' | 'vertical' | null>(null)

/** Undo/redo stacks of snapshots (see domain/history.ts); reset whenever the open Pattern changes since it's an editing-session aid, not part of the saved Pattern. Each entry carries a grid, plus Row progress for the one command that resets that too (Delete all, ticket 42 — see UndoEntry). */
const history = ref<History<UndoEntry>>(emptyHistory())

/** Whether the Delete all confirmation modal (ticket 42) is open. The global Escape handler (onKeyDown) defers to the modal's own while this is true, rather than also backing out of Select. */
const deleteAllConfirmOpen = ref(false)

/** The rectangle the Select tool has marked out, or none (ticket 31). Only one is ever active: a new drag replaces it. */
const selection = ref<Selection | undefined>()
/** What Copy last snapshotted, ready to stamp. Like the undo stack it's an editing-session aid, never saved with the Pattern. */
const copiedBlock = ref<CopiedBlock | undefined>()

/** The cell the cursor is over, for the hover paint preview (ticket 23); cleared when the cursor leaves the canvas. */
const hoveredCell = ref<GridPosition | undefined>()

/** For onKeyDown's Escape precedence: asks every Tool group to collapse before backing out of Select (ticket 41). */
const toolboxRef = ref<InstanceType<typeof Toolbox> | null>(null)

watch(activePatternId, () => {
  history.value = emptyHistory()
  selection.value = undefined
  copiedBlock.value = undefined
  // Rich Mirror's axis counts and copy mode are an editing-session setting, reset on a Pattern switch (ticket 44/45
  // decision); unused while the flag is off, but harmless to reset regardless.
  mirrorAxisCounts.value = { ...NO_MIRROR_AXES }
  mirrorCopyMode.value = false
  hoveredMirrorCurrentAxis.value = null
  deleteAllConfirmOpen.value = false
})

/**
 * Rich Mirror's axis counts as actually shown on the canvas (ticket 47): while the pointer is over a "Mirror
 * current" button, that direction's axes preview at their *effective* count -- the same count-acts-as-1 fallback
 * mirrorCurrentForCounts itself uses (ticket 46 decision) -- without touching the stored count a click would still
 * leave alone. The other direction, and everything once the pointer leaves, is exactly mirrorAxisCounts.
 */
const previewedMirrorAxisCounts = computed<MirrorAxisCounts>(() => {
  const hovered = hoveredMirrorCurrentAxis.value
  if (!hovered) {
    return mirrorAxisCounts.value
  }

  const axis = hovered === 'horizontal' ? 'columns' : 'rows'
  return { ...mirrorAxisCounts.value, [axis]: mirrorAxisCounts.value[axis] || 1 }
})

/** Cells a hovered "Mirror current" button would overwrite, dimmed on the canvas (ticket 47) -- computed by asking mirrorCurrentForCounts what it *would* do and diffing that against what's there now, through the same Row progress lock a real click would go through, so a locked cell that couldn't actually change is never dimmed. */
const mirrorCurrentDimmedCells = computed<GridPosition[]>(() => {
  const pattern = activePattern.value
  const hovered = hoveredMirrorCurrentAxis.value
  if (!richMirror || !pattern || !hovered) {
    return []
  }

  const axis = hovered === 'horizontal' ? 'columns' : 'rows'
  const result = keepFinishedRows(
    pattern,
    mirrorCurrentForCounts(pattern, axis, mirrorAxisCounts.value[axis], mirrorCopyMode.value),
  )

  return changedCells(pattern.grid, result.grid)
})

function onMirrorCurrentHover(axis: 'horizontal' | 'vertical' | null) {
  hoveredMirrorCurrentAxis.value = axis
}

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
    // With nothing copied there's nothing a click would put down, so Select previews nothing.
    return copiedBlock.value ? pastedCells(pattern, copiedBlock.value, hovered) : []
  }
  if (activeTool.value !== 'paint') {
    // Fill is unaffected by mirror state (ticket 22), so its preview only ever shows the hovered cell itself.
    return [hovered]
  }
  return richMirror
    ? mirroredCellsForCounts(pattern, hovered, mirrorAxisCounts.value, mirrorCopyMode.value)
    : mirroredCells(pattern, hovered, mirrorAxes.value)
}

/** The current paint color's hex: the selected Palette color, or the Custom color when that's active instead; null when neither is. */
function selectedColorHex(): string | null {
  if (selectedColorId.value) {
    return findPaletteColor(selectedColorId.value)?.hex ?? null
  }
  return customColor.value ?? null
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
  const created = createPattern(payload)
  savePattern(created)
  patterns.value.push(created)
  activePatternId.value = created.id
}

function onSelectPattern(id: string) {
  activePatternId.value = id
}

function onRemovePattern(id: string) {
  removePattern(id)
  patterns.value = patterns.value.filter((pattern) => pattern.id !== id)

  if (activePatternId.value === id) {
    activePatternId.value = mostRecentlyUpdated(patterns.value)?.id
  }
}

function onNewPattern() {
  activePatternId.value = undefined
}

/** Choosing a Palette swatch deselects Custom color (CONTEXT.md); its slot keeps showing its last hex, just unselected. */
function onSelectColor(colorId: string) {
  selectedColorId.value = colorId
}

/** Choosing a Custom color makes it the paint color and deselects whichever Palette swatch was active, vice versa. */
function onSelectCustomColor(hex: string) {
  customColor.value = hex
  selectedColorId.value = undefined
}

function onSelectTool(tool: Tool) {
  /*
   * Leaving Select forgets what it was holding. The marquee is noise once you're painting rather than selecting,
   * and a clipboard that outlived its marquee would be invisible state: coming back to Select and clicking would
   * stamp a block out of nowhere. Re-choosing Select while it's already active leaves both alone.
   */
  if (tool !== 'select') {
    selection.value = undefined
    cancelPaste()
  }

  activeTool.value = tool
}

function replaceActivePattern(updated: Pattern) {
  savePattern(updated)
  patterns.value = patterns.value.map((pattern) => (pattern.id === updated.id ? updated : pattern))
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
  replaceActivePattern(kept)
}

/**
 * A Paint-tool drag (ticket 24): 'paint'/'erase' while a stroke is in progress, else null. The grid this started
 * from is captured once, in strokeBaseline, and pushed to the undo stack as a single step when the stroke ends
 * (see endStroke) — every cell touched in between just updates the live Pattern directly.
 */
const strokeMode = ref<'paint' | 'erase' | null>(null)
const strokeBaseline = ref<Grid | null>(null)

function beginStroke(mode: 'paint' | 'erase', pattern: Pattern) {
  strokeMode.value = mode
  strokeBaseline.value = pattern.grid
}

/** Ends an in-progress stroke or Select press, bound to mouseup on the whole app shell (ticket 24): a drag can end with the button released anywhere, not just back over the cell it started on. */
function endStroke() {
  endSelectPress()

  const pattern = activePattern.value
  if (strokeBaseline.value && pattern && pattern.grid !== strokeBaseline.value) {
    history.value = pushHistory(history.value, { grid: strokeBaseline.value })
  }
  strokeMode.value = null
  strokeBaseline.value = null
}

/** Paints (or, with a null color, erases) one cell of an in-progress stroke, live-mirrored per mirrorAxes (or, behind the rich-mirror flag, mirrorAxisCounts), leaving rows already woven alone (ticket 33). */
function paintStrokeCell(row: number, column: number, color: string | null) {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  const painted = richMirror
    ? paintCellsForCounts(pattern, [{ row, column }], color, mirrorAxisCounts.value, mirrorCopyMode.value)
    : paintCells(pattern, [{ row, column }], color, mirrorAxes.value)

  const updated = keepFinishedRows(pattern, painted)
  if (updated !== pattern) {
    replaceActivePattern(updated)
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

/**
 * Where a Select-tool press started, and whether it has left that cell yet. A press under Select is ambiguous until
 * one of those happens: dragging marks out a new Selection, while a click in place stamps whatever was copied. So
 * the press only records its anchor here, and endSelectPress decides which it turned out to be.
 */
const selectPress = ref<{ anchor: GridPosition; moved: boolean } | null>(null)

function beginSelectPress(pattern: Pattern, row: number, column: number) {
  selectPress.value = { anchor: { row, column }, moved: false }

  // With nothing copied, the press can only be the start of a selection, so the marquee appears from the first cell.
  // With something copied the gesture is claimed by Paste instead, which is why re-selecting a single cell then
  // takes a drag out and back rather than a click: a click has to mean one thing, and stamping is the one it means.
  if (!copiedBlock.value) {
    selection.value = selectionBetween(pattern, { row, column }, { row, column })
  }
}

/** Grows the in-progress Selection to the cell the drag has reached. A drag replaces the previous Selection, and with it whatever was copied from one. */
function extendSelection(row: number, column: number) {
  const pattern = activePattern.value
  const press = selectPress.value
  if (!pattern || !press) {
    return
  }

  press.moved = true
  copiedBlock.value = undefined
  selection.value = selectionBetween(pattern, press.anchor, { row, column })
}

/** Ends a Select press: a click that never moved stamps the copied block where it landed (a drag has already updated the Selection as it went). */
function endSelectPress() {
  const pattern = activePattern.value
  const press = selectPress.value
  selectPress.value = null

  if (!pattern || !press || press.moved || !copiedBlock.value) {
    return
  }

  commitGridChange(pattern, pasteBlock(pattern, copiedBlock.value, press.anchor))
}

/**
 * Puts the copied block down without stamping it, so Select goes back to marking out areas — a click means Paste
 * only while something is on the clipboard (see beginSelectPress). The Selection itself is left alone, so the same
 * block can be picked back up with Copy rather than re-dragged.
 */
function cancelPaste() {
  copiedBlock.value = undefined
}

/**
 * Right-click or Escape under Select backs out one step at a time: a copied block goes first, keeping the Selection
 * so Copy can pick the same block back up (see cancelPaste); with nothing copied, the Selection itself goes.
 */
function backOutOfSelect() {
  if (copiedBlock.value) {
    cancelPaste()
  } else {
    selection.value = undefined
  }
}

/** Whether a keydown landed in a form field — text/number inputs, a textarea, or anything contenteditable — where it should be left to type normally rather than triggering an editor-wide shortcut. */
function isTypingInFormField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
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

/**
 * Escape reaches backOutOfSelect from anywhere, since the canvas takes no keyboard focus of its own and the cursor
 * may have left it (ticket 24). Undo/Redo's shortcuts (ticket 34) work the same way — bound to the window rather
 * than a focused element — except while the user is typing in a form field, where they're left to the field itself
 * (e.g. a browser's native text-undo) rather than firing the editor's own Undo/Redo. While the Delete all
 * confirmation modal is open, its own Escape handling (ConfirmModal.vue) owns the key instead — deferred to here so
 * Escape can't also unexpectedly drop a copied block or collapse a Tool group behind the modal.
 */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !deleteAllConfirmOpen.value) {
    /*
     * ticket 41: an expanded Tool group takes precedence — the first Escape only collapses it, and backOutOfSelect
     * (cancel Paste, then clear Selection) only runs once none is expanded, exactly as if that Escape never happened.
     */
    if (toolboxRef.value?.collapseExpandedGroup()) {
      return
    }
    backOutOfSelect()
    return
  }

  if (isTypingInFormField(event.target)) {
    return
  }

  if (isRedoShortcut(event)) {
    event.preventDefault()
    onRedo()
  } else if (isUndoShortcut(event)) {
    event.preventDefault()
    onUndo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

/** Snapshots the Selection into the in-session clipboard; from there a click on the canvas stamps it (see endSelectPress). */
function onCopy() {
  const pattern = activePattern.value
  if (!pattern || !selection.value) {
    return
  }

  copiedBlock.value = copySelection(pattern, selection.value)
}

function onCellPrimaryDown(row: number, column: number) {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  if (activeTool.value === 'select') {
    beginSelectPress(pattern, row, column)
    return
  }

  const color = selectedColorHex()
  if (!color) {
    return
  }

  beginOrCommitPress('paint', color, row, column)
}

function onCellPrimaryMove(row: number, column: number) {
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

/** Right-click erase, mapped to the active tool (ticket 25): flood-erase in one click under Fill, single-cell/dragged-line erase under Paint. */
function onCellSecondaryDown(row: number, column: number) {
  // Select never erases; under it the right button backs out of a pending Paste or the Selection, alongside Escape.
  if (activeTool.value === 'select') {
    backOutOfSelect()
    return
  }

  beginOrCommitPress('erase', null, row, column)
}

function onCellSecondaryMove(row: number, column: number) {
  if (strokeMode.value !== 'erase') {
    return
  }

  paintStrokeCell(row, column, null)
}

function onUndo() {
  const pattern = activePattern.value
  const step = pattern && undoStep(history.value, { grid: pattern.grid })
  if (!step) {
    return
  }

  history.value = step.history
  replaceActivePattern(restoreSnapshot(pattern, step.snapshot))
}

/** Re-applies whatever Undo most recently stepped back from (ticket 34); like Undo, replays history rather than drawing, so it's not blocked by the Row progress lock. */
function onRedo() {
  const pattern = activePattern.value
  const step = pattern && redoStep(history.value, { grid: pattern.grid })
  if (!step) {
    return
  }

  history.value = step.history
  replaceActivePattern(restoreSnapshot(pattern, step.snapshot))
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
  replaceActivePattern(updated)
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

  replaceActivePattern(toggleRotated(pattern))
  resetZoom()
}

/** Flips one Mirror axis on/off; live-mirroring while painting reads mirrorAxes directly (ADR 0006). */
function onToggleMirrorAxis(axis: 'horizontal' | 'vertical') {
  mirrorAxes.value[axis] = !mirrorAxes.value[axis]
}

/**
 * Sets one direction's rich-Mirror axis count (ticket 44), clamped to what the open Pattern's current size allows --
 * Toolbox.vue works out which grid-space field ('columns'/'rows') a screen direction maps to, since that's the
 * piece that swaps under rotation (see ToolGroup usage in Toolbox.vue).
 */
function onSetMirrorAxisCount(axis: 'columns' | 'rows', count: number) {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  const cellsAcross = axis === 'columns' ? pattern.columns : pattern.rows
  mirrorAxisCounts.value = { ...mirrorAxisCounts.value, [axis]: clampAxisCount(count, cellsAcross) }
}

/** Flips rich-Mirror's copy-mode switch (ticket 45): one switch for both directions. */
function onToggleMirrorCopyMode() {
  mirrorCopyMode.value = !mirrorCopyMode.value
}

/**
 * One-time reflect of whatever's currently painted across one direction, for content drawn before that direction's
 * live mirroring was turned on (ADR 0006). With the flag off, the legacy "bigger half" heuristic across the grid's
 * center, unchanged (ticket 44/45 decision: "Mirror current keeps its current behaviour until ticket 46"). With
 * rich Mirror on (ticket 46), the strip with the most painted cells becomes the source instead, using that
 * direction's own axis count (the other direction is left alone, same as the legacy per-axis buttons always did)
 * and honouring copy mode; a count of 0 still acts as a single center axis, so the button always does something.
 * 'horizontal'/'vertical' here are grid-space, same as they've always been for these two buttons -- unlike the
 * Left–right/Top–bottom counters (ticket 44), these were never rotation-relabeled, and ticket 46 doesn't change
 * that.
 */
function onMirrorCurrent(axis: 'horizontal' | 'vertical') {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  if (richMirror) {
    const gridAxis = axis === 'horizontal' ? 'columns' : 'rows'
    commitGridChange(
      pattern,
      mirrorCurrentForCounts(pattern, gridAxis, mirrorAxisCounts.value[gridAxis], mirrorCopyMode.value),
    )
    return
  }

  const axes: MirrorAxes =
    axis === 'horizontal' ? { horizontal: true, vertical: false } : { horizontal: false, vertical: true }
  commitGridChange(pattern, mirrorPattern(pattern, axes))
}

function onToggleRowProgress(enabled: boolean) {
  const pattern = activePattern.value
  if (pattern) {
    replaceActivePattern(setRowProgressEnabled(pattern, enabled))
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
    replaceActivePattern(toggleRowDirection(pattern))
  }
}

/** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
function onMoveRow(delta: number) {
  const pattern = activePattern.value
  if (pattern) {
    replaceActivePattern(moveToRow(pattern, rowProgressPosition(pattern).current + delta))
  }
}

function onImportPatterns(imported: Pattern[]) {
  imported.forEach(savePattern)
  patterns.value = [...patterns.value, ...imported]

  // Opening one of them would interrupt whatever is already open, so only step in when nothing is.
  activePatternId.value ??= mostRecentlyUpdated(imported)?.id
}
</script>

<template>
  <div class="app-shell" @mouseup="endStroke">
    <header class="app-shell__topbar" data-testid="app-topbar">
      <div class="app-shell__topbar-title">
        <h1>{{ t.app.title }}</h1>
      </div>
      <div class="app-shell__topbar-summary">
        <button
          type="button"
          data-testid="new-pattern-button"
          :disabled="patterns.length === 0"
          @click="onNewPattern"
        >
          {{ t.patterns.newPatternButton }}
        </button>
        <div v-if="activePattern" class="app-shell__summary-group">
          <p class="app-shell__summary" data-testid="current-pattern-summary">
            {{ t.patterns.currentLabel }}: {{ summarizePattern(activePattern) }}
          </p>
          <p class="app-shell__summary" data-testid="current-pattern-bead">
            {{ activeBeadLabel }}
          </p>
        </div>
        <LanguageSwitcher />
      </div>
    </header>

    <div class="app-shell__body">
      <aside
        class="app-shell__main"
        :class="{ 'app-shell__main--empty': activePattern }"
        data-testid="app-main-panel"
      >
        <template v-if="!activePattern">
          <h2>{{ t.patterns.newPatternButton }}</h2>
          <NewPatternForm @submit="onCreatePattern" />
        </template>
      </aside>

      <div class="app-shell__right">
        <div class="app-shell__above-canvas" data-testid="app-above-canvas">
          <Toolbox
            v-if="activePattern"
            ref="toolboxRef"
            :pattern="activePattern"
            :active-tool="activeTool"
            :selected-color-id="selectedColorId"
            :custom-color="customColor"
            :can-undo="canUndo(history)"
            :can-redo="canRedo(history)"
            :can-copy="!!selection"
            :mirror-axes="mirrorAxes"
            :rich-mirror="richMirror"
            :mirror-axis-counts="mirrorAxisCounts"
            :mirror-copy-mode="mirrorCopyMode"
            @select-tool="onSelectTool"
            @select-color="onSelectColor"
            @select-custom-color="onSelectCustomColor"
            @undo="onUndo"
            @redo="onRedo"
            @toggle-rotate="onToggleRotate"
            @copy="onCopy"
            @toggle-mirror-axis="onToggleMirrorAxis"
            @set-mirror-axis-count="onSetMirrorAxisCount"
            @toggle-mirror-copy-mode="onToggleMirrorCopyMode"
            @mirror-current="onMirrorCurrent"
            @mirror-current-hover="onMirrorCurrentHover"
            @toggle-row-progress="onToggleRowProgress"
            @toggle-row-direction="onToggleRowDirection"
            @move-row="onMoveRow"
            @delete-all="onRequestDeleteAll"
          />
        </div>

        <div ref="canvasAreaEl" class="app-shell__canvas" data-testid="app-canvas">
          <PatternCanvas
            v-if="activePattern"
            :pattern="activePattern"
            :zoom="zoom"
            :preview-cells="previewCells"
            :preview-color="previewColor"
            :selection="selection"
            :mirror-axis-counts="richMirror ? previewedMirrorAxisCounts : undefined"
            :dimmed-cells="mirrorCurrentDimmedCells"
            @cell-primary-down="onCellPrimaryDown"
            @cell-primary-move="onCellPrimaryMove"
            @cell-secondary-down="onCellSecondaryDown"
            @cell-secondary-move="onCellSecondaryMove"
            @cell-hover="onCellHover"
            @hover-end="onHoverEnd"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
            @zoom-reset="resetZoom"
          />
          <p v-else class="app-shell__placeholder" data-testid="app-canvas-placeholder">
            {{ t.shell.canvasPlaceholder }}
          </p>
        </div>

        <hr class="app-shell__below-canvas-divider" data-testid="app-below-canvas-divider" />

        <div class="app-shell__below-canvas" data-testid="app-below-canvas">
          <BeadQuantities :pattern="activePattern" />
          <PatternList
            :patterns="patterns"
            :active-pattern-id="activePatternId"
            @select="onSelectPattern"
            @remove="onRemovePattern"
          />
          <PatternTransfer :pattern="activePattern" :patterns="patterns" @import="onImportPatterns" />
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
  </div>
</template>

<style scoped>
.app-shell {
  padding: 24px;
}

/* Two distinct boxes (ticket 20) rather than one bar: a dark title box and an aqua-island status box. */
.app-shell__topbar {
  display: flex;
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
  background: var(--color-ink);
}

.app-shell__topbar-title h1 {
  margin: 0;
  color: var(--color-paper);
}

.app-shell__topbar-summary {
  flex: 1 1 auto;
  justify-content: space-between;
  gap: 16px;
  background: var(--color-aqua-island);
}

/* Groups the current-Pattern summary and its Bead (ticket 37); grows to fill whatever room New Pattern and the language switcher don't need, so those two stay pinned to the box's ends regardless of how long the summary text is (ticket 35). */
.app-shell__summary-group {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
}

.app-shell__summary {
  margin: 0;
  color: var(--color-aqua-island-ink);
}

.app-shell__body {
  display: flex;
  align-items: stretch;
  gap: 16px;
}

.app-shell__main {
  flex: 0 0 280px;
  padding: 16px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.app-shell__main h2 {
  margin-top: 0;
}

/*
 * The main panel's editing-tools role moved to the above-canvas tool strip (ADR 0005). While a Pattern is open this
 * panel has nothing to show, so it collapses to nothing rather than rendering the ADR 0004 "coming soon"
 * placeholder — that convention is for an unbuilt feature, not one that moved elsewhere on purpose — and
 * app-shell__right (flex: 1 1 auto) reclaims the freed width. Taken out of the flow entirely rather than sized to
 * zero, so app-shell__body's gap doesn't leave a dead strip where the panel used to be.
 */
.app-shell__main--empty {
  display: none;
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

.app-shell__right {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* New Pattern (ticket 35) has moved out to the header, and zoom (ticket 35) onto the canvas box, so the Toolbox is this panel's only remaining content — it renders directly here rather than as a second row below a first one that's now gone. */
.app-shell__above-canvas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/*
 * Opens the bottom section (ADR 0004 amendment, ticket 39): a faint divider, muted the same way the tool-strip's
 * dot-grid texture is (color-mix off --color-ink rather than a new token) so it separates the section without
 * competing with the boxes' own borders below it. A block child of app-shell__right like app-shell__canvas above it,
 * so it naturally spans just the canvas column's width, not the page (the app-shell__main panel sits outside this
 * column, to the left).
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
 * Pattern-level views (ADR 0004), each carrying the same card frame the rest of the shell uses. They share the row
 * the collapsed main panel freed up rather than stacking full-width down the page.
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
 * A full-width frame around the canvas box, on the same dot-grid notepad texture as the tool strip (ADR 0005), so
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
 */
.app-shell__canvas {
  flex: 1 1 auto;
  overflow-x: auto;
  padding: 24px;
  background-color: var(--color-paper-solid);
  background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 15%, transparent) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

</style>
