<script setup lang="ts">
import { ref } from 'vue'
import { decodeImageFile, type DecodeImage } from '../domain/imageDecode'
import type { Pattern } from '../domain/pattern'
import { importPatterns, parsePatternsFile } from '../domain/patternFile'
import { parsePatternFromQrImage } from '../domain/qrExport'
import { useI18n } from '../i18n/useI18n'

const props = withDefaults(
  defineProps<{
    /** Every Pattern saved on this device, for spotting import collisions. */
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
  <!--
    Both Import controls and their outcome (ticket 117): from a Pattern file, and from a QR-code picture. Each control is
    a button-looking label around a visually hidden file input, so it reads as one of the top bar's actions while the
    browser's own file picker still opens from it — and keyboard focus on the input still shows on the label.
    A fragment of several roots rather than one wrapping box, so the controls flow in the same row as whatever sits
    beside them in the parent, and the results take a line of their own beneath (flex-basis: 100% below).
  -->
  <label class="pattern-import__button" for="import-file">
    <input
      id="import-file"
      type="file"
      class="pattern-import__input"
      accept="application/json,.json"
      data-testid="import-file"
      @change="onImportFile"
    />
    {{ t.transfer.importLabel }}
  </label>

  <label class="pattern-import__button" for="import-qr">
    <input
      id="import-qr"
      type="file"
      class="pattern-import__input"
      accept="image/*"
      data-testid="import-qr"
      @change="onImportQrImage"
    />
    {{ t.transfer.importQrLabel }}
  </label>

  <!-- role="status" / "alert": announced as they appear, since the file picker has already closed by then. -->
  <p v-if="importedCount !== null" class="pattern-import__result" role="status" data-testid="import-result">
    {{ t.transfer.importedLabel }}: {{ importedCount }}
  </p>
  <p v-if="importFailed" class="pattern-import__error" role="alert" data-testid="import-error">
    {{ t.transfer.importErrorLabel }}
  </p>

  <p v-if="qrImportedCount !== null" class="pattern-import__result" role="status" data-testid="qr-import-result">
    {{ t.transfer.qrImportedLabel }}
  </p>
  <p v-if="qrImportFailed" class="pattern-import__error" role="alert" data-testid="qr-import-error">
    {{ t.transfer.qrImportErrorLabel }}
  </p>
</template>

<style scoped>
/* Same look as every other button (style.css's `button`), on a label: the wedgewood pill with the ink outline. */
.pattern-import__button {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  margin: 0;
  padding: 10px 22px;
  font-weight: 700;
  color: var(--color-wedgewood-ink);
  background: var(--color-wedgewood);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-pill);
  cursor: pointer;
}

.pattern-import__button:hover {
  background: var(--color-wedgewood-deep);
}

/* Visually hidden, not display: none, so it stays focusable and reachable by keyboard and screen reader. */
.pattern-import__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.pattern-import__button:focus-within {
  outline: 3px solid var(--color-ink);
  outline-offset: 2px;
}

.pattern-import__result,
.pattern-import__error {
  flex: 1 1 100%;
  margin: 0;
  font-weight: var(--font-weight-bold);
}

.pattern-import__error {
  padding: 4px 12px;
  color: var(--color-amaranth-ink);
  background: var(--color-amaranth);
  border-radius: var(--radius-md);
}
</style>
