<script setup lang="ts">
import { ref } from 'vue'
import { decodeImageFile, type DecodeImage } from '../domain/imageDecode'
import type { Pattern } from '../domain/pattern'
import { importPatterns, parsePatternsFile } from '../domain/patternFile'
import { parsePatternFromQrImage } from '../domain/qrExport'
import { useI18n } from '../i18n/useI18n'
import AppIcon from './AppIcon.vue'

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
    /**
     * Icons only, each name kept as its tooltip and accessible name: the header's first step when it runs out of room
     * (ticket 142; `writing.md`, Fitting longer text).
     */
    compact?: boolean
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
    Both Import controls and their outcome (tickets 117, 142): from a Pattern file, and from a QR-code picture. Each is a
    text button (Button card) that is a label around a visually hidden file input, so the browser's own file picker
    opens from it, and keyboard focus on the input shows on the label. A fragment, so the controls and their one-line
    result sit in the header's own row.
  -->
  <label
    class="pattern-import__button"
    :class="{ 'pattern-import__button--compact': compact }"
    for="import-file"
    :title="compact ? t.transfer.importLabel : undefined"
  >
    <input
      id="import-file"
      type="file"
      class="pattern-import__input"
      accept="application/json,.json"
      data-testid="import-file"
      :aria-label="compact ? t.transfer.importLabel : undefined"
      @change="onImportFile"
    />
    <AppIcon name="import" :size="15" />
    <span v-if="!compact">{{ t.transfer.importLabel }}</span>
  </label>

  <label
    class="pattern-import__button"
    :class="{ 'pattern-import__button--compact': compact }"
    for="import-qr"
    :title="compact ? t.transfer.importQrLabel : undefined"
  >
    <input
      id="import-qr"
      type="file"
      class="pattern-import__input"
      accept="image/*"
      data-testid="import-qr"
      :aria-label="compact ? t.transfer.importQrLabel : undefined"
      @change="onImportQrImage"
    />
    <AppIcon name="scan" :size="15" />
    <span v-if="!compact">{{ t.transfer.importQrLabel }}</span>
  </label>

  <!--
    One line beside the buttons, no shadow and no close (ImportResult card); role="status" / "alert" so it is
    announced as it appears, since the file picker has already closed by then.
  -->
  <p v-if="importedCount !== null" class="pattern-import__result" role="status" data-testid="import-result">
    {{ t.transfer.importedLabel }}: {{ importedCount }}
  </p>
  <p v-if="importFailed" class="pattern-import__error" role="alert" data-testid="import-error">
    <AppIcon name="warning" :size="16" />{{ t.transfer.importErrorLabel }}
  </p>

  <p v-if="qrImportedCount !== null" class="pattern-import__result" role="status" data-testid="qr-import-result">
    {{ t.transfer.qrImportedLabel }}
  </p>
  <p v-if="qrImportFailed" class="pattern-import__error" role="alert" data-testid="qr-import-error">
    <AppIcon name="warning" :size="16" />{{ t.transfer.qrImportErrorLabel }}
  </p>
</template>

<style scoped>
/* A text button (Button card) on a label: no fill or border, padding 0 6, hover fill with a fine pointer. */
.pattern-import__button {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  height: var(--control-height);
  margin: 0;
  padding: 0 var(--space-6);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard);
}

.pattern-import__button--compact {
  justify-content: center;
  width: var(--control-height);
  padding: 0;
}

@media (hover: hover) {
  .pattern-import__button:hover {
    background: var(--hover-fill);
  }
}

.pattern-import__button:active {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
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

.pattern-import__button:has(:focus-visible) {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.pattern-import__result,
.pattern-import__error {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-6);
  margin: 0;
  font: var(--type-body);
  color: var(--body);
  white-space: nowrap;
}

.pattern-import__error {
  color: var(--danger);
}

@media (prefers-reduced-motion: reduce) {
  .pattern-import__button:active {
    transform: none;
  }
}
</style>
