<script setup lang="ts">
import { computed } from 'vue'
import type { Pattern } from '../domain/pattern'
import { summarizePattern } from '../domain/pattern'
import { libraryFileName, patternFileName, serializeLibrary, serializePattern } from '../domain/patternFile'
import { useI18n } from '../i18n/useI18n'

const props = defineProps<{
  patterns: Pattern[]
  activePatternId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
}>()

const { t } = useI18n()

/** The Pattern open right now, if any — the one "Export Pattern" writes out. */
const activePattern = computed(() => props.patterns.find((pattern) => pattern.id === props.activePatternId))

/**
 * There is no backend to fetch from (ADR 0001), so the file is built in the page and handed straight to the
 * browser. The link has to be in the document for Firefox to act on the click, and the blob URL has to outlive the
 * click for Safari to finish reading it — hence revoking on the next tick rather than immediately.
 */
function download(fileName: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url))
}

/** Export pattern (ticket 118, moved here from the retired Export and import box): the open Pattern as a Pattern file. */
function onExportPattern(): void {
  if (activePattern.value) {
    download(patternFileName(activePattern.value), serializePattern(activePattern.value))
  }
}

/** Export library: every saved Pattern in one file. */
function onExportLibrary(): void {
  download(libraryFileName(), serializeLibrary(props.patterns))
}
</script>

<template>
  <section class="pattern-list" data-testid="pattern-list">
    <h2>{{ t.patterns.heading }}</h2>
    <p v-if="patterns.length === 0" data-testid="pattern-list-empty">
      {{ t.patterns.noSavedPatternsMessage }}
    </p>
    <ul v-else>
      <li
        v-for="pattern in patterns"
        :key="pattern.id"
        class="pattern-list__item"
        data-testid="pattern-item"
        :class="{ 'pattern-list__item--active': pattern.id === activePatternId }"
      >
        <button
          type="button"
          class="pattern-list__select"
          :data-testid="`select-pattern-${pattern.id}`"
          :aria-pressed="pattern.id === activePatternId"
          @click="emit('select', pattern.id)"
        >
          {{ summarizePattern(pattern) }}
        </button>
        <button
          type="button"
          class="pattern-list__remove button--danger icon-button"
          :data-testid="`remove-pattern-${pattern.id}`"
          :aria-label="`${t.patterns.removeButton}: ${summarizePattern(pattern)}`"
          @click="emit('remove', pattern.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </li>
    </ul>
    <div class="pattern-list__exports">
      <button type="button" data-testid="export-pattern" :disabled="!activePattern" @click="onExportPattern">
        {{ t.transfer.exportPatternButton }}
      </button>
      <button type="button" data-testid="export-library" :disabled="patterns.length === 0" @click="onExportLibrary">
        {{ t.transfer.exportLibraryButton }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.pattern-list h2 {
  margin: 0 0 12px;
}

.pattern-list ul {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pattern-list__exports {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.pattern-list__item {
  display: flex;
  align-items: stretch;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pattern-list__item--active {
  border-color: var(--color-wedgewood);
}

.pattern-list__select {
  color: var(--color-ink);
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 8px 14px;
}

.pattern-list__item--active .pattern-list__select {
  color: var(--color-wedgewood-ink);
  background: var(--color-wedgewood);
}

.pattern-list__remove {
  border: none;
  border-left: var(--border-width) solid var(--color-ink);
  border-radius: 0;
  padding: 0;
}
</style>
