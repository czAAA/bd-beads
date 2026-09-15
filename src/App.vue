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
import { findPaletteColor } from './domain/palette'
import {
  createPattern,
  fillArea,
  mirrorPattern,
  mostRecentlyUpdated,
  moveToRow,
  paintCell,
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
const mirrorEnabled = ref(false)
const mirrorAxes = ref<MirrorAxes>({ horizontal: false, vertical: false })
/** Grid snapshots to restore on undo, most recent last; reset whenever the open Pattern changes since it's an editing-session aid, not part of the saved Pattern. */
const undoStack = ref<Grid[]>([])

watch(activePatternId, () => {
  undoStack.value = []
})

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

function onCellClick(row: number, column: number) {
  const pattern = activePattern.value
  const color = selectedColorId.value ? findPaletteColor(selectedColorId.value) : undefined
  if (!pattern || !color) {
    return
  }

  const updated =
    activeTool.value === 'fill'
      ? fillArea(pattern, row, column, color.hex)
      : paintCell(pattern, row, column, color.hex)
  commitGridChange(pattern, updated)
}

function onUndo() {
  const pattern = activePattern.value
  const previousGrid = undoStack.value.pop()
  if (!pattern || !previousGrid) {
    return
  }

  replaceActivePattern(restoreGrid(pattern, previousGrid))
}

function onApplyMirror() {
  const pattern = activePattern.value
  if (!pattern || !mirrorEnabled.value) {
    return
  }

  commitGridChange(pattern, mirrorPattern(pattern, mirrorAxes.value))
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
  <div class="app-shell">
    <header class="app-shell__topbar" data-testid="app-topbar">
      <h1>{{ t.app.title }}</h1>
      <p v-if="activePattern" class="app-shell__summary" data-testid="current-pattern-summary">
        {{ t.patterns.currentLabel }}: {{ summarizePattern(activePattern) }}
      </p>
      <LanguageSwitcher />
    </header>

    <div class="app-shell__body">
      <aside class="app-shell__main" data-testid="app-main-panel">
        <template v-if="!activePattern">
          <h2>{{ t.patterns.newPatternButton }}</h2>
          <NewPatternForm :beads="beads" @submit="onCreatePattern" />
        </template>
        <template v-else>
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

          <h2>{{ t.palette.heading }}</h2>
          <PalettePicker :selected-color-id="selectedColorId" @select="onSelectColor" />
          <button
            type="button"
            data-testid="undo-button"
            :disabled="undoStack.length === 0"
            @click="onUndo"
          >
            {{ t.palette.undoButton }}
          </button>

          <h2>{{ t.mirror.heading }}</h2>
          <label>
            <input
              v-model="mirrorEnabled"
              type="checkbox"
              data-testid="mirror-enabled"
            />
            {{ t.mirror.enabledLabel }}
          </label>
          <div class="mirror-axes">
            <label>
              <input
                v-model="mirrorAxes.horizontal"
                type="checkbox"
                data-testid="mirror-horizontal"
                :disabled="!mirrorEnabled"
              />
              {{ t.mirror.horizontalLabel }}
            </label>
            <label>
              <input
                v-model="mirrorAxes.vertical"
                type="checkbox"
                data-testid="mirror-vertical"
                :disabled="!mirrorEnabled"
              />
              {{ t.mirror.verticalLabel }}
            </label>
          </div>
          <button
            type="button"
            data-testid="mirror-apply"
            :disabled="!mirrorEnabled || (!mirrorAxes.horizontal && !mirrorAxes.vertical)"
            @click="onApplyMirror"
          >
            {{ t.mirror.applyButton }}
          </button>

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
        </template>
      </aside>

      <div class="app-shell__right">
        <div class="app-shell__above-canvas" data-testid="app-above-canvas">
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

        <div class="app-shell__canvas" data-testid="app-canvas">
          <PatternCanvas
            v-if="activePattern"
            :pattern="activePattern"
            :zoom="zoom"
            @cell-click="onCellClick"
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

.app-shell__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: var(--color-aqua-island);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.app-shell__topbar h1 {
  margin: 0;
  color: var(--color-aqua-island-ink);
}

.app-shell__summary {
  margin: 0;
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

.app-shell__right {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-shell__above-canvas {
  display: flex;
  align-items: center;
  gap: 16px;
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
