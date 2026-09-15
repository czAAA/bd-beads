<script setup lang="ts">
import { ref } from 'vue'
import type { ColorBeadDefaults } from '../domain/beadMapping'
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
  /** This device's global color-to-bead defaults, which travel in the file so the Patterns still resolve elsewhere. */
  colorBeadDefaults: ColorBeadDefaults
}>()

const emit = defineEmits<{
  /**
   * What a file turned out to hold: Patterns ready to be saved locally, already given fresh ids where they
   * collided, plus the defaults the file carried for the app to fold into its own.
   */
  import: [patterns: Pattern[], colorBeadDefaults: ColorBeadDefaults]
}>()

const { t } = useI18n()

const importedCount = ref<number | null>(null)
const importFailed = ref(false)

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

function onExportPattern(): void {
  if (props.pattern) {
    download(
      patternFileName(props.pattern),
      serializePattern(props.pattern, props.colorBeadDefaults),
    )
  }
}

function onExportLibrary(): void {
  download(libraryFileName(), serializeLibrary(props.patterns, props.colorBeadDefaults))
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
    const contents = parsePatternsFile(await file.text())
    const added = importPatterns(contents.patterns, props.patterns)
    importedCount.value = added.length
    emit('import', added, contents.colorBeadDefaults)
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
  font-weight: var(--font-weight-bold);
}
</style>
