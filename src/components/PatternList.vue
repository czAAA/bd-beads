<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Pattern } from '../domain/pattern'
import { summarizePattern } from '../domain/pattern'
import { downloadFile } from '../domain/fileDownload'
import { libraryFileName, patternFileName, serializeLibrary, serializePattern } from '../domain/patternFile'
import { useI18n } from '../i18n/useI18n'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import ExpandablePanel from './ExpandablePanel.vue'
import PatternThumbnail from './PatternThumbnail.vue'

/**
 * Saved Patterns (ticket 147; SavedPatterns and SavedPatternsExpanded cards): the five most recently saved Patterns as
 * round thumbnails, with name and size under each; expanded, every Pattern and a footer with Export Pattern and Export
 * all. The open Pattern is ringed in the accent. Remove is a small × at a thumbnail's top-right, shown on hover or
 * keyboard focus. `patterns` comes in the library's own order, most recently saved first (ticket 145).
 */
const props = defineProps<{
  patterns: Pattern[]
  activePatternId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
}>()

const { t } = useI18n()

/** How many thumbnails the collapsed box holds: one row of five. */
const RECENT = 5

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.patterns : props.patterns.slice(0, RECENT)))

const meta = computed(() =>
  t.value.patterns.shownOf.replace('{shown}', String(shown.value.length)).replace('{total}', String(props.patterns.length)),
)

/** The Pattern open right now, if any — the one "Export Pattern" writes out. */
const activePattern = computed(() => props.patterns.find((pattern) => pattern.id === props.activePatternId))

/** A thumbnail's size line, as the Pattern shows on screen. */
function sizeOf(pattern: Pattern): string {
  return pattern.rotated ? `${pattern.rows}×${pattern.columns}` : `${pattern.columns}×${pattern.rows}`
}

/** Export pattern (ticket 118): the open Pattern as a Pattern file. */
function onExportPattern(): void {
  if (activePattern.value) {
    downloadFile(patternFileName(activePattern.value), serializePattern(activePattern.value))
  }
}

/** Export library: every saved Pattern in one file. */
function onExportLibrary(): void {
  downloadFile(libraryFileName(), serializeLibrary(props.patterns))
}
</script>

<template>
  <ExpandablePanel
    v-model:expanded="expanded"
    class="pattern-list"
    :title="t.patterns.heading"
    :expandable="patterns.length > 0"
    :empty="patterns.length === 0"
    :clip-overflow="false"
    collapsed-height="var(--saved-body-height)"
    data-testid="pattern-list"
  >
    <template v-if="patterns.length > 0" #meta>
      <span data-testid="pattern-list-meta">{{ meta }}</span>
    </template>

    <p v-if="patterns.length === 0" class="pattern-list__empty" data-testid="pattern-list-empty">
      {{ t.patterns.noSavedPatternsMessage }}
    </p>
    <ul v-else class="pattern-list__grid">
      <li
        v-for="pattern in shown"
        :key="pattern.id"
        class="pattern-list__item"
        data-testid="pattern-item"
        :class="{ 'pattern-list__item--active': pattern.id === activePatternId }"
      >
        <AppTooltip :text="pattern.name" :announce="false">
          <button
            type="button"
            class="ui-control pattern-list__select"
            :data-testid="`select-pattern-${pattern.id}`"
            :aria-label="summarizePattern(pattern)"
            :aria-pressed="pattern.id === activePatternId"
            @click="emit('select', pattern.id)"
          >
            <span class="pattern-list__circle">
              <PatternThumbnail :pattern="pattern" />
            </span>
            <span class="pattern-list__name">{{ pattern.name }}</span>
            <span class="pattern-list__size">{{ sizeOf(pattern) }}</span>
          </button>
        </AppTooltip>
        <button
          type="button"
          class="ui-control pattern-list__remove"
          :data-testid="`remove-pattern-${pattern.id}`"
          :aria-label="`${t.patterns.removeButton}: ${summarizePattern(pattern)}`"
          @click="emit('remove', pattern.id)"
        >
          <AppIcon name="close" :size="14" />
        </button>
      </li>
    </ul>

    <template #footer>
      <AppButton variant="in-box" size="sm" data-testid="export-pattern" :disabled="!activePattern" @click="onExportPattern">
        {{ t.transfer.exportPatternButton }}
      </AppButton>
      <AppButton variant="in-box" size="sm" data-testid="export-library" :disabled="patterns.length === 0" @click="onExportLibrary">
        {{ t.transfer.exportLibraryButton }}
      </AppButton>
    </template>
  </ExpandablePanel>
</template>

<style scoped>
.pattern-list__empty {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

/* Five columns, rows 12 apart, columns 8 apart (ticket 175: 4px read as no gap at all between names). */
.pattern-list__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-12) var(--space-8);
  margin: 0;
  padding: var(--space-4) 0 0;
  list-style: none;
}

.pattern-list__item {
  position: relative;
  display: flex;
  justify-content: center;
  min-width: 0;
}

.pattern-list__item > :deep(.app-tooltip) {
  min-width: 0;
}

.pattern-list__select {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: var(--ink);
  text-align: center;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.pattern-list__select:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

/* A 44px circle on `elevated`, holding the Pattern's own 36px thumbnail. */
.pattern-list__circle {
  display: grid;
  place-items: center;
  width: var(--thumbnail-circle);
  height: var(--thumbnail-circle);
  background: var(--elevated);
  border-radius: var(--radius-full);
  transition: box-shadow var(--duration-fast) var(--ease-standard);
}

@media (hover: hover) {
  .pattern-list__select:hover .pattern-list__circle {
    box-shadow: 0 0 0 1px var(--line-strong);
  }
}

.pattern-list__name {
  display: block;
  width: var(--thumbnail-name-width);
  margin-top: var(--space-6);
  overflow: hidden;
  font: var(--type-small);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pattern-list__size {
  font: var(--type-meta-tiny);
  color: var(--muted);
}

/* The open Pattern: the accent ring around its circle, and its name in the accent. */
.pattern-list__item--active .pattern-list__circle {
  box-shadow:
    0 0 0 2px var(--panel),
    0 0 0 4px var(--accent-strong);
}

.pattern-list__item--active .pattern-list__name {
  color: var(--accent-strong);
}

/* Remove: a 20px round × at the circle's top-right, shown on hover or keyboard focus, and always without hover. */
.pattern-list__remove {
  position: absolute;
  top: calc(-1 * var(--space-4));
  right: var(--space-2);
  display: grid;
  place-items: center;
  width: var(--thumbnail-remove);
  height: var(--thumbnail-remove);
  padding: 0;
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.pattern-list__remove :deep(.icon) {
  width: 0.6875rem !important;
  height: 0.6875rem !important;
}

.pattern-list__item:hover .pattern-list__remove,
.pattern-list__item:focus-within .pattern-list__remove {
  opacity: 1;
}

@media (hover: none) {
  .pattern-list__remove {
    opacity: 1;
  }
}

.pattern-list__remove:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 1px;
}

:root[data-theme='contrast'] .pattern-list__remove {
  border-width: 2px;
}

/* Forced colors: the open Pattern keeps a visible ring. */
@media (forced-colors: active) {
  .pattern-list__item--active .pattern-list__circle {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}
</style>
