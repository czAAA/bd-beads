<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import NewPatternForm from './components/NewPatternForm.vue'
import PalettePicker from './components/PalettePicker.vue'
import PatternCanvas from './components/PatternCanvas.vue'
import PatternList from './components/PatternList.vue'
import { findPaletteColor } from './domain/palette'
import {
  createPattern,
  fillArea,
  mostRecentlyUpdated,
  paintCell,
  restoreGrid,
  summarizePattern,
  type CreatePatternInput,
  type Grid,
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

const selectedColorId = ref<string | undefined>()
const activeTool = ref<'paint' | 'fill'>('paint')
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
  if (updated === pattern) {
    return
  }

  undoStack.value.push(pattern.grid)
  replaceActivePattern(updated)
}

function onUndo() {
  const pattern = activePattern.value
  const previousGrid = undoStack.value.pop()
  if (!pattern || !previousGrid) {
    return
  }

  replaceActivePattern(restoreGrid(pattern, previousGrid))
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
      <!-- Mirror tool (ticket 09) joins the New Pattern form, Palette, and tools here as it's built;
           until a ticket assigns this panel new content, it shows a placeholder instead of blank space. -->
      <aside class="app-shell__main" data-testid="app-main-panel">
        <template v-if="!activePattern">
          <h2>{{ t.patterns.newPatternButton }}</h2>
          <NewPatternForm @submit="onCreatePattern" />
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
        </div>

        <div class="app-shell__canvas" data-testid="app-canvas">
          <PatternCanvas v-if="activePattern" :pattern="activePattern" @cell-click="onCellClick" />
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

.app-shell__placeholder {
  margin: 0;
  color: var(--color-ink);
  opacity: 0.5;
}

.tool-picker {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tool-picker__button--selected {
  background: var(--color-wedgewood);
  color: var(--color-wedgewood-ink);
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
}

.app-shell__canvas {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}
</style>
