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
import { usePatternZoom } from './composables/usePatternZoom'
import { BEAD_CATALOG, type Bead } from './domain/beads'
import { mergeColorBeadDefaults, type ColorBeadDefaults } from './domain/beadMapping'
import {
  loadColorBeadDefaults,
  saveColorBeadDefault,
  saveColorBeadDefaults,
} from './domain/beadMappingStorage'
import { loadCustomBeads, removeCustomBead, saveCustomBead } from './domain/beadStorage'
import type { GridPosition } from './domain/grid'
import { findPaletteColor } from './domain/palette'
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

const { zoom, zoomPercent, zoomIn, zoomOut, resetZoom } = usePatternZoom(() => activePattern.value)

const selectedColorId = ref<string | undefined>()
const activeTool = ref<'paint' | 'fill'>('paint')
const mirrorAxes = ref<MirrorAxes>({ horizontal: false, vertical: false })
/** Grid snapshots to restore on undo, most recent last; reset whenever the open Pattern changes since it's an editing-session aid, not part of the saved Pattern. */
const undoStack = ref<Grid[]>([])

/** The cell the cursor is over, for the hover paint preview (ticket 23); cleared when the cursor leaves the canvas. */
const hoveredCell = ref<GridPosition | undefined>()

watch(activePatternId, () => {
  undoStack.value = []
})

/** The hovered cell plus its live-mirror counterpart(s), or none while nothing is hovered. */
const previewCells = computed<GridPosition[]>(() => {
  const pattern = activePattern.value
  if (!pattern || !hoveredCell.value) {
    return []
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

function onSelectTool(tool: 'paint' | 'fill') {
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

/** Ends an in-progress stroke, bound to mouseup on the whole app shell (ticket 24): a drag can end with the button released anywhere, not just back over the cell it started on. */
function endStroke() {
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

function onCellPrimaryDown(row: number, column: number) {
  const color = selectedColorHex()
  if (!color) {
    return
  }

  beginOrCommitPress('paint', color, row, column)
}

function onCellPrimaryMove(row: number, column: number) {
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
                :aria-label="t.palette.undoButton"
                :disabled="undoStack.length === 0"
                @click="onUndo"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 7 3 11l4 4" />
                  <path d="M3 11h11a7 7 0 1 1 -7 7" />
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
                  data-testid="mirror-current-horizontal"
                  @click="onMirrorCurrent('horizontal')"
                >
                  {{ t.mirror.mirrorCurrentHorizontalButton }}
                </button>
                <button
                  type="button"
                  data-testid="mirror-current-vertical"
                  @click="onMirrorCurrent('vertical')"
                >
                  {{ t.mirror.mirrorCurrentVerticalButton }}
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
                  data-testid="row-progress-previous"
                  :disabled="
                    !activePattern.rowProgress.enabled || activePattern.rowProgress.currentRow === 0
                  "
                  @click="onMoveRow(-1)"
                >
                  {{ t.rowProgress.previousButton }}
                </button>
                <button
                  type="button"
                  data-testid="row-progress-next"
                  :disabled="
                    !activePattern.rowProgress.enabled ||
                    activePattern.rowProgress.currentRow === activePattern.rows - 1
                  "
                  @click="onMoveRow(1)"
                >
                  {{ t.rowProgress.nextButton }}
                </button>
              </div>
            </section>
          </div>
        </div>

        <div class="app-shell__canvas" data-testid="app-canvas">
          <PatternCanvas
            v-if="activePattern"
            :pattern="activePattern"
            :zoom="zoom"
            :preview-cells="previewCells"
            :preview-color="previewColor"
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
 * app-shell__right (flex: 1 1 auto) reclaims the freed width.
 */
.app-shell__main--empty {
  flex: 0 0 0;
  padding: 0;
  border: none;
}

/* With the frame moved onto the canvas box, the empty-canvas message carries its own so the panel still reads as a box. */
.app-shell__placeholder {
  margin: 0;
  padding: 16px 24px;
  color: var(--color-ink);
  opacity: 0.5;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.tool-picker {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

/* The default button is already wedgewood, so the selected tool reads as ink-on-paper instead. */
.tool-picker__button--selected,
.tool-picker__button--selected:hover:not(:disabled) {
  background: var(--color-ink);
  color: var(--color-paper);
}

.mirror-axes {
  display: flex;
  gap: 16px;
  margin: 8px 0 16px;
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
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background-color: var(--color-paper-solid);
  background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 15%, transparent) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.tool-strip__card {
  flex: 0 0 auto;
  padding: 12px 16px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}

.tool-strip__card h2 {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 1rem;
}

.row-progress__position {
  margin: 8px 0;
}

.row-progress__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/*
 * The canvas area only centres the canvas box. The frame belongs to the box itself (see PatternCanvas), so it
 * follows the open Pattern's shape instead of stretching to fill this panel (ticket 18).
 */
.app-shell__canvas {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

</style>
