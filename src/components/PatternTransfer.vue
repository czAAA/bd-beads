<script setup lang="ts">
import { ref } from 'vue'
import type { Pattern } from '../domain/pattern'
import {
  importPatterns,
  libraryFileName,
  parsePatternsFile,
  patternFileName,
  serializeLibrary,
  serializePattern,
} from '../domain/patternFile'
import { useI18n } from '../i18n/useI18n'

const props = defineProps<{
  /** The Pattern open right now, if any — the one "Export Pattern" writes out. */
  pattern?: Pattern
  /** Every Pattern saved on this device, for the whole-library export and for spotting import collisions. */
  patterns: Pattern[]
}>()

const emit = defineEmits<{
  /** Patterns read out of a file and ready to be saved locally, already given fresh ids where they collided. */
  import: [patterns: Pattern[]]
}>()

const { t } = useI18n()

const importedCount = ref<number | null>(null)
const importFailed = ref(false)

/** There is no backend to fetch from (ADR 0001), so the file is built in the page and handed straight to the browser. */
function download(fileName: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function onExportPattern(): void {
  if (props.pattern) {
    download(patternFileName(props.pattern), serializePattern(props.pattern))
  }
}

function onExportLibrary(): void {
  download(libraryFileName(), serializeLibrary(props.patterns))
}

async function onImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  importedCount.value = null
  importFailed.value = false

  try {
    const added = importPatterns(parsePatternsFile(await file.text()), props.patterns)
    importedCount.value = added.length
    emit('import', added)
  } catch {
    importFailed.value = true
  } finally {
    // Clear the input so re-picking the same file still counts as a change.
    input.value = ''
  }
}
</script>

<template>
  <section class="pattern-transfer" data-testid="pattern-transfer">
    <h2>{{ t.transfer.heading }}</h2>

    <div class="pattern-transfer__actions">
      <button
        type="button"
        data-testid="export-pattern"
        :disabled="!pattern"
        @click="onExportPattern"
      >
        {{ t.transfer.exportPatternButton }}
      </button>
      <button
        type="button"
        data-testid="export-library"
        :disabled="patterns.length === 0"
        @click="onExportLibrary"
      >
        {{ t.transfer.exportLibraryButton }}
      </button>

      <div class="pattern-transfer__import">
        <label for="import-file">{{ t.transfer.importLabel }}</label>
        <input
          id="import-file"
          type="file"
          accept="application/json,.json"
          data-testid="import-file"
          @change="onImportFile"
        />
      </div>
    </div>

    <p v-if="importedCount !== null" data-testid="import-result">
      {{ t.transfer.importedLabel }}: {{ importedCount }}
    </p>
    <p v-if="importFailed" class="pattern-transfer__error" data-testid="import-error">
      {{ t.transfer.importErrorLabel }}
    </p>
  </section>
</template>

<style scoped>
.pattern-transfer h2 {
  margin: 0 0 12px;
}

.pattern-transfer__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.pattern-transfer__import {
  display: flex;
  flex-direction: column;
}

.pattern-transfer__error {
  color: var(--color-amaranth);
  font-weight: 700;
}
</style>
