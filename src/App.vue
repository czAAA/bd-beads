<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BeadCatalog from './components/BeadCatalog.vue'
import BeadQuantities from './components/BeadQuantities.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import NewPatternForm from './components/NewPatternForm.vue'
import PalettePicker from './components/PalettePicker.vue'
import PatternCanvas from './components/PatternCanvas.vue'
import PatternList from './components/PatternList.vue'
import PatternTransfer from './components/PatternTransfer.vue'
import ZoomControls from './components/ZoomControls.vue'
import { useElementSize } from './composables/useElementSize'
import { usePatternZoom } from './composables/usePatternZoom'
import { BEAD_CATALOG, type Bead } from './domain/beads'
import { mergeColorBeadDefaults, type ColorBeadDefaults } from './domain/beadMapping'
import {
  loadColorBeadDefaults,
  saveColorBeadDefault,
  saveColorBeadDefaults,
} from './domain/beadMappingStorage'
import { loadCustomBeads, removeCustomBead, saveCustomBead } from './domain/beadStorage'
import type { GridPosition, PreviewCell } from './domain/grid'
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
  createPattern,
  fillArea,
  mirrorPattern,
  mirroredCells,
  mostRecentlyUpdated,
  moveToRow,
  paintCells,
  restoreGrid,
  setColorBeadOverride,
  setRowProgressEnabled,
  summarizePattern,
  toggleRotated,
  type CreatePatternInput,
  type Grid,
  type MirrorAxes,
  type Pattern,
} from './domain/pattern'
import { loadPatterns, removePattern, savePattern } from './domain/patternStorage'
import { provideI18n } from './i18n/useI18n'

const { t } = provideI18n()

const patterns = ref<Pattern[]>(loadPatterns())
const activePatternId = ref<string | undefined>(mostRecentlyUpdated(patterns.value)?.id)

const activePattern = computed(() =>
  patterns.value.find((pattern) => pattern.id === activePatternId.value),
)

const customBeads = ref<Bead[]>(loadCustomBeads())
const beads = computed(() => [...BEAD_CATALOG, ...customBeads.value])

/** Which Bead each Palette color means by default, across every Pattern (ADR 0002). */
const colorBeadDefaults = ref(loadColorBeadDefaults())

/** The canvas area's own element, measured live (ticket 27) so the Pattern's fit zoom tracks the real available space instead of a guessed constant. */
const canvasAreaEl = ref<HTMLElement | null>(null)
const { width: canvasAreaWidth } = useElementSize(canvasAreaEl)

const { zoom, zoomPercent, zoomIn, zoomOut, resetZoom } = usePatternZoom(
  () => activePattern.value,
  canvasAreaWidth,
)

/** Red is the Palette's first swatch and its default: a Pattern almost always opens ready to paint, not on a dead click-a-color-first step. */
const DEFAULT_PALETTE_COLOR_ID = 'red'

type Tool = 'paint' | 'fill' | 'select'

const selectedColorId = ref<string | undefined>(DEFAULT_PALETTE_COLOR_ID)
const activeTool = ref<Tool>('paint')
const mirrorAxes = ref<MirrorAxes>({ horizontal: false, vertical: false })
/** Grid snapshots to restore on undo, most recent last; reset whenever the open Pattern changes since it's an editing-session aid, not part of the saved Pattern. */
const undoStack = ref<Grid[]>([])

/** The rectangle the Select tool has marked out, or none (ticket 31). Only one is ever active: a new drag replaces it. */
const selection = ref<Selection | undefined>()
/** What Copy last snapshotted, ready to stamp. Like the undo stack it's an editing-session aid, never saved with the Pattern. */
const copiedBlock = ref<CopiedBlock | undefined>()

/** The cell the cursor is over, for the hover paint preview (ticket 23); cleared when the cursor leaves the canvas. */
const hoveredCell = ref<GridPosition | undefined>()

watch(activePatternId, () => {
  undoStack.value = []
  selection.value = undefined
  copiedBlock.value = undefined
})

/** What the hover preview shows: the block Paste would stamp under the cursor (ticket 31), or the cell Paint/Fill would touch plus its live-mirror counterpart(s) (tickets 22/23). */
const previewCells = computed<PreviewCell[]>(() => {
  const pattern = activePattern.value
  if (!pattern || !hoveredCell.value) {
    return []
  }
  if (activeTool.value === 'select') {
    // With nothing copied there's nothing a click would put down, so Select previews nothing.
    return copiedBlock.value ? pastedCells(pattern, copiedBlock.value, hoveredCell.value) : []
  }
  // Fill is unaffected by mirror state (ticket 22), so its preview only ever shows the hovered cell itself.
  const axes = activeTool.value === 'paint' ? mirrorAxes.value : { horizontal: false, vertical: false }
  return mirroredCells(pattern, hoveredCell.value, axes)
})

/** The selected Palette color's hex, or null when nothing is selected. */
function selectedColorHex(): string | null {
  return selectedColorId.value ? (findPaletteColor(selectedColorId.value)?.hex ?? null) : null
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

function onSelectColor(colorId: string) {
  selectedColorId.value = colorId
}

function onSelectTool(tool: Tool) {
  activeTool.value = tool
}

function replaceActivePattern(updated: Pattern) {
  savePattern(updated)
  patterns.value = patterns.value.map((pattern) => (pattern.id === updated.id ? updated : pattern))
}

/** Commits the result of a grid-changing command (paint/fill/mirror) as one undo step, unless it left the Pattern unchanged. */
function commitGridChange(pattern: Pattern, updated: Pattern) {
  if (updated === pattern) {
    return
  }

  undoStack.value.push(pattern.grid)
  replaceActivePattern(updated)
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
    undoStack.value.push(strokeBaseline.value)
  }
  strokeMode.value = null
  strokeBaseline.value = null
}

/** Paints (or, with a null color, erases) one cell of an in-progress stroke, live-mirrored per mirrorAxes. */
function paintStrokeCell(row: number, column: number, color: string | null) {
  const pattern = activePattern.value
  if (!pattern) {
    return
  }

  const updated = paintCells(pattern, [{ row, column }], color, mirrorAxes.value)
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
  if (activeTool.value === 'select') {
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
  const previousGrid = undoStack.value.pop()
  if (!pattern || !previousGrid) {
    return
  }

  replaceActivePattern(restoreGrid(pattern, previousGrid))
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

/** One-time reflect of whatever's currently painted across a single axis, via the old "bigger half" heuristic — for content drawn before that axis's live mirroring was turned on (ADR 0006). */
function onMirrorCurrent(axis: 'horizontal' | 'vertical') {
  const pattern = activePattern.value
  if (!pattern) {
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

/** Steps the row pointer forward as a row is finished, or back to revisit an earlier one. */
function onMoveRow(delta: number) {
  const pattern = activePattern.value
  if (pattern) {
    replaceActivePattern(moveToRow(pattern, pattern.rowProgress.currentRow + delta))
  }
}

function onSetDefaultBead(colorId: string, beadId: string | null) {
  saveColorBeadDefault(colorId, beadId)
  colorBeadDefaults.value = loadColorBeadDefaults()
}

function onSetOverrideBead(colorId: string, beadId: string | null) {
  const pattern = activePattern.value
  if (pattern) {
    replaceActivePattern(setColorBeadOverride(pattern, colorId, beadId))
  }
}

function onImportPatterns(imported: Pattern[], importedDefaults: ColorBeadDefaults) {
  imported.forEach(savePattern)
  patterns.value = [...patterns.value, ...imported]

  const merged = mergeColorBeadDefaults(colorBeadDefaults.value, importedDefaults)
  saveColorBeadDefaults(merged)
  colorBeadDefaults.value = merged

  // Opening one of them would interrupt whatever is already open, so only step in when nothing is.
  activePatternId.value ??= mostRecentlyUpdated(imported)?.id
}

function onAddBead(bead: Bead) {
  saveCustomBead(bead)
  customBeads.value.push(bead)
}

function onEditBead(bead: Bead) {
  saveCustomBead(bead)
  customBeads.value = customBeads.value.map((existing) => (existing.id === bead.id ? bead : existing))
}

function onRemoveBead(id: string) {
  removeCustomBead(id)
  customBeads.value = customBeads.value.filter((bead) => bead.id !== id)
}
</script>

<template>
  <div class="app-shell" @mouseup="endStroke">
    <header class="app-shell__topbar" data-testid="app-topbar">
      <div class="app-shell__topbar-title">
        <h1>{{ t.app.title }}</h1>
      </div>
      <div class="app-shell__topbar-summary">
        <p v-if="activePattern" class="app-shell__summary" data-testid="current-pattern-summary">
          {{ t.patterns.currentLabel }}: {{ summarizePattern(activePattern) }}
        </p>
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
          <NewPatternForm :beads="beads" @submit="onCreatePattern" />
        </template>
      </aside>

      <div class="app-shell__right">
        <div class="app-shell__above-canvas" data-testid="app-above-canvas">
          <div class="app-shell__above-canvas-row">
            <button
              type="button"
              data-testid="new-pattern-button"
              :disabled="patterns.length === 0"
              @click="onNewPattern"
            >
              {{ t.patterns.newPatternButton }}
            </button>
            <ZoomControls
              v-if="activePattern"
              :zoom-percent="zoomPercent"
              @zoom-in="zoomIn"
              @zoom-out="zoomOut"
              @reset="resetZoom"
            />
          </div>

          <div v-if="activePattern" class="tool-strip" data-testid="tool-strip">
            <section class="tool-strip__card">
              <h2>{{ t.tools.heading }}</h2>
              <div class="tool-picker" role="group" :aria-label="t.tools.heading">
                <button
                  type="button"
                  data-testid="tool-paint"
                  :aria-pressed="activeTool === 'paint'"
                  :class="{ 'tool-picker__button--selected': activeTool === 'paint' }"
                  @click="onSelectTool('paint')"
                >
                  {{ t.tools.paintLabel }}
                </button>
                <button
                  type="button"
                  data-testid="tool-fill"
                  :aria-pressed="activeTool === 'fill'"
                  :class="{ 'tool-picker__button--selected': activeTool === 'fill' }"
                  @click="onSelectTool('fill')"
                >
                  {{ t.tools.fillLabel }}
                </button>
                <button
                  type="button"
                  data-testid="tool-select"
                  :aria-pressed="activeTool === 'select'"
                  :class="{ 'tool-picker__button--selected': activeTool === 'select' }"
                  @click="onSelectTool('select')"
                >
                  {{ t.tools.selectLabel }}
                </button>
              </div>
            </section>

            <section class="tool-strip__card">
              <h2>{{ t.palette.heading }}</h2>
              <PalettePicker :selected-color-id="selectedColorId" @select="onSelectColor" />
            </section>

            <section class="tool-strip__card">
              <button
                type="button"
                class="icon-button"
                data-testid="undo-button"
                :title="t.palette.undoButton"
                :aria-label="t.palette.undoButton"
                :disabled="undoStack.length === 0"
                @click="onUndo"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 7 3 11l4 4" />
                  <path d="M3 11h11a7 7 0 1 1 -7 7" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-button"
                data-testid="rotate-button"
                :title="t.palette.rotateButton"
                :aria-label="t.palette.rotateButton"
                :aria-pressed="activePattern.rotated"
                :class="{ 'tool-picker__button--selected': activePattern.rotated }"
                @click="onToggleRotate"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="3" y="11" width="13" height="9" rx="1.5" />
                  <rect x="9" y="4" width="9" height="13" rx="1.5" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-button"
                data-testid="copy-button"
                :title="t.tools.copyButton"
                :aria-label="t.tools.copyButton"
                :disabled="!selection"
                @click="onCopy"
              >
                <!-- One sheet laid over a second: the duplicate the Selection becomes. Only the back sheet's exposed corner is drawn, so it doesn't read as Rotate's two full rectangles. -->
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="8" y="8" width="13" height="13" rx="2" />
                  <path d="M16 8V3H3v13h5" />
                </svg>
              </button>
            </section>

            <section class="tool-strip__card">
              <h2>{{ t.mirror.heading }}</h2>
              <div class="mirror-axes">
                <label>
                  <input v-model="mirrorAxes.horizontal" type="checkbox" data-testid="mirror-horizontal" />
                  {{ t.mirror.horizontalLabel }}
                </label>
                <label>
                  <input v-model="mirrorAxes.vertical" type="checkbox" data-testid="mirror-vertical" />
                  {{ t.mirror.verticalLabel }}
                </label>
              </div>
              <div class="mirror-current">
                <button
                  type="button"
                  class="icon-button"
                  data-testid="mirror-current-horizontal"
                  :title="t.mirror.mirrorCurrentHorizontalButton"
                  :aria-label="t.mirror.mirrorCurrentHorizontalButton"
                  @click="onMirrorCurrent('horizontal')"
                >
                  <!-- Two shapes facing away from a dashed vertical axis: the left-right flip this button performs. -->
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 3v3M12 10.5v3M12 18v3" />
                    <path d="M8.5 7 3.5 12l5 5z" />
                    <path d="M15.5 7l5 5-5 5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="icon-button"
                  data-testid="mirror-current-vertical"
                  :title="t.mirror.mirrorCurrentVerticalButton"
                  :aria-label="t.mirror.mirrorCurrentVerticalButton"
                  @click="onMirrorCurrent('vertical')"
                >
                  <!-- The same glyph turned a quarter turn: a dashed horizontal axis with the shapes above and below it. -->
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 12h3M10.5 12h3M18 12h3" />
                    <path d="M7 8.5 12 3.5l5 5z" />
                    <path d="M7 15.5 12 20.5l5-5z" />
                  </svg>
                </button>
              </div>
            </section>

            <section class="tool-strip__card">
              <h2>{{ t.rowProgress.heading }}</h2>
              <label>
                <input
                  type="checkbox"
                  data-testid="row-progress-enabled"
                  :checked="activePattern.rowProgress.enabled"
                  @change="onToggleRowProgress(($event.target as HTMLInputElement).checked)"
                />
                {{ t.rowProgress.enabledLabel }}
              </label>
              <p class="row-progress__position" data-testid="row-progress-position">
                {{ t.rowProgress.positionLabel }}
                {{ activePattern.rowProgress.currentRow + 1 }} / {{ activePattern.rows }}
              </p>
              <div class="row-progress__steps">
                <button
                  type="button"
                  class="icon-button"
                  data-testid="row-progress-previous"
                  :title="t.rowProgress.previousButton"
                  :aria-label="t.rowProgress.previousButton"
                  :disabled="
                    !activePattern.rowProgress.enabled || activePattern.rowProgress.currentRow === 0
                  "
                  @click="onMoveRow(-1)"
                >
                  <!-- Rows are woven top to bottom, so stepping back up the Pattern is a plain up arrow. -->
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 20V5" />
                    <path d="M5.5 11.5 12 5l6.5 6.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="icon-button"
                  data-testid="row-progress-next"
                  :title="t.rowProgress.nextButton"
                  :aria-label="t.rowProgress.nextButton"
                  :disabled="
                    !activePattern.rowProgress.enabled ||
                    activePattern.rowProgress.currentRow === activePattern.rows - 1
                  "
                  @click="onMoveRow(1)"
                >
                  <!-- A tick, not a down arrow: what this button means is "this row is woven", and advancing is the consequence. -->
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 13l5.5 5.5L20 6" />
                  </svg>
                </button>
              </div>
            </section>
          </div>
        </div>

        <div ref="canvasAreaEl" class="app-shell__canvas" data-testid="app-canvas">
          <PatternCanvas
            v-if="activePattern"
            :pattern="activePattern"
            :zoom="zoom"
            :preview-cells="previewCells"
            :preview-color="previewColor"
            :selection="selection"
            @cell-primary-down="onCellPrimaryDown"
            @cell-primary-move="onCellPrimaryMove"
            @cell-secondary-down="onCellSecondaryDown"
            @cell-secondary-move="onCellSecondaryMove"
            @cell-hover="onCellHover"
            @hover-end="onHoverEnd"
          />
          <p v-else class="app-shell__placeholder" data-testid="app-canvas-placeholder">
            {{ t.shell.canvasPlaceholder }}
          </p>
        </div>

        <div class="app-shell__below-canvas" data-testid="app-below-canvas">
          <PatternList
            :patterns="patterns"
            :active-pattern-id="activePatternId"
            @select="onSelectPattern"
            @remove="onRemovePattern"
          />
          <BeadQuantities
            :pattern="activePattern"
            :beads="beads"
            :defaults="colorBeadDefaults"
            @set-default="onSetDefaultBead"
            @set-override="onSetOverrideBead"
          />
          <PatternTransfer
            :pattern="activePattern"
            :patterns="patterns"
            :color-bead-defaults="colorBeadDefaults"
            @import="onImportPatterns"
          />
          <BeadCatalog
            :seeded-beads="BEAD_CATALOG"
            :custom-beads="customBeads"
            @add="onAddBead"
            @edit="onEditBead"
            @remove="onRemoveBead"
          />
        </div>
      </div>
    </div>
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

.tool-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* The default button is already wedgewood, so the selected tool reads as ink-on-paper instead. */
.tool-picker__button--selected,
.tool-picker__button--selected:hover:not(:disabled) {
  background: var(--color-ink);
  color: var(--color-paper);
}

.mirror-axes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.mirror-current {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.app-shell__right {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-shell__above-canvas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-shell__above-canvas-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

/*
 * A strip of small cards, one per editing-tool group (ADR 0005), on a dot-grid notepad-paper texture. The dots are
 * a muted tint of --color-ink, derived with color-mix rather than a new token — a decorative texture, not a
 * palette addition (ticket 20's "no new tokens" constraint is about the header boxes, not this).
 */
.tool-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 10px;
  padding: 8px;
  background-color: var(--color-paper-solid);
  background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 15%, transparent) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/*
 * Grows (1 1 220px) rather than sitting at its own content width: five cards of very different natural widths
 * (a two-button tool picker vs. a twelve-swatch palette vs. two long mirror buttons) left most of a wide strip as
 * bare dot-grid texture at flex-shrink:0/flex-grow:0. Growing shares that leftover width back out across the row,
 * and shrinking below content width lets a card's own wrap rules (.mirror-current, .row-progress__steps) fire and
 * stack its buttons instead of forcing the whole strip wider. The 220px basis is only where wrapping to a new line
 * kicks in on a narrow window; min-width:0 lets a card shrink past its natural content width instead of overflowing.
 *
 * display:flex here (not the old block/stacked layout) is what makes the strip lean rather than tall (ticket 27):
 * the heading and its controls sit side by side, one line, instead of a heading row on top of a controls row —
 * three or four times the height for no reason once the strip is allowed to grow sideways instead. A card's own
 * content (.mirror-axes, .mirror-current, .row-progress__steps, ...) still wraps internally first if a narrow card
 * genuinely can't fit everything on one line.
 */
.tool-strip__card {
  flex: 1 1 220px;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 12px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}

/* An inline label rather than a block heading above the controls — see .tool-strip__card above. */
.tool-strip__card h2 {
  margin: 0;
  font-size: 0.85rem;
  white-space: nowrap;
}

/* A size step down from the app's default button (10px 22px): right for a compact toolbar row, not for the form/list buttons elsewhere that keep the default. The bare icon-button keeps its own fixed 44x44 touch target. */
.tool-strip__card button:not(.icon-button) {
  padding: 6px 16px;
}

.row-progress__position {
  margin: 0;
  white-space: nowrap;
}

.row-progress__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
