<script setup lang="ts">
import { ref } from 'vue'
import QrCode from './QrCode.vue'
import { decodeImageFile, type DecodeImage } from '../domain/imageDecode'
import type { Pattern } from '../domain/pattern'
import {
  importPatterns,
  libraryFileName,
  parsePatternsFile,
  patternFileName,
  serializeLibrary,
  serializePattern,
} from '../domain/patternFile'
import { parsePatternFromQrImage, patternQrMatrix, type QrMatrix } from '../domain/qrExport'
import { useI18n } from '../i18n/useI18n'

const props = withDefaults(
  defineProps<{
    /** The Pattern open right now, if any — the one "Export Pattern" (and "Export as QR code") writes out. */
    pattern?: Pattern
    /** Every Pattern saved on this device, for the whole-library export and for spotting import collisions. */
    patterns: Pattern[]
    /**
     * How a picked QR-code picture is turned into pixels (ticket 68). Defaults to the browser's own decoding, the
     * same adapter Convert image uses; a test hands over synthetic pixel data instead, since jsdom decodes no image
     * bytes. Resolved where it is called rather than through withDefaults, where a function default would be taken
     * as the value itself.
     */
    decodeImage?: DecodeImage
  }>(),
  {
    decodeImage: undefined,
  },
)

const emit = defineEmits<{
  /** The Patterns a file turned out to hold, ready to be saved locally, already given fresh ids where they collided. */
  import: [patterns: Pattern[]]
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
    const contents = parsePatternsFile(await file.text())
    const added = importPatterns(contents.patterns, props.patterns)
    importedCount.value = added.length
    emit('import', added)
  } catch {
    importFailed.value = true
  } finally {
    // Clear the input so re-picking the same file still counts as a change.
    input.value = ''
  }
}

/**
 * QR export (ticket 68, ADR 0015): undefined while the panel below is closed; once open, either the code to show or
 * `'too-large'` when the open Pattern doesn't fit a single QR code's capacity — one value gates both, so the panel
 * can never disagree with itself about which to show.
 */
const qrExport = ref<QrMatrix | 'too-large' | undefined>()

function onExportQr(): void {
  if (props.pattern) {
    qrExport.value = patternQrMatrix(props.pattern) ?? 'too-large'
  }
}

function onCloseQr(): void {
  qrExport.value = undefined
}

const qrImportedCount = ref<number | null>(null)
const qrImportFailed = ref(false)

/** Import from a QR-code picture (ticket 68): a photo/screenshot of the code shown on another device, decoded the same way Convert image reads a picture's pixels. */
async function onImportQrImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  qrImportedCount.value = null
  qrImportFailed.value = false

  try {
    const pixels = await (props.decodeImage ?? decodeImageFile)(file)
    const [added] = importPatterns([parsePatternFromQrImage(pixels)], props.patterns)
    qrImportedCount.value = 1
    emit('import', [added!])
  } catch {
    qrImportFailed.value = true
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
      <button
        type="button"
        data-testid="export-qr"
        :disabled="!pattern"
        @click="onExportQr"
      >
        {{ t.transfer.exportQrButton }}
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

      <div class="pattern-transfer__import">
        <label for="import-qr">{{ t.transfer.importQrLabel }}</label>
        <input
          id="import-qr"
          type="file"
          accept="image/*"
          data-testid="import-qr"
          @change="onImportQrImage"
        />
      </div>
    </div>

    <p v-if="importedCount !== null" data-testid="import-result">
      {{ t.transfer.importedLabel }}: {{ importedCount }}
    </p>
    <p v-if="importFailed" class="pattern-transfer__error" data-testid="import-error">
      {{ t.transfer.importErrorLabel }}
    </p>

    <p v-if="qrImportedCount !== null" data-testid="qr-import-result">
      {{ t.transfer.qrImportedLabel }}
    </p>
    <p v-if="qrImportFailed" class="pattern-transfer__error" data-testid="qr-import-error">
      {{ t.transfer.qrImportErrorLabel }}
    </p>

    <div v-if="qrExport" class="pattern-transfer__qr" data-testid="qr-export-panel">
      <p v-if="qrExport === 'too-large'" class="pattern-transfer__error" data-testid="qr-too-large">
        {{ t.transfer.qrTooLargeMessage }}
      </p>
      <QrCode v-else :matrix="qrExport" />
      <button type="button" data-testid="qr-export-close" @click="onCloseQr">
        {{ t.transfer.closeQrButton }}
      </button>
    </div>
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

.pattern-transfer__qr {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-top: 12px;
}
</style>
