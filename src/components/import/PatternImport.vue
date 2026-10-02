<script setup lang="ts">
import { ref, useId } from 'vue'
import type { DecodeImage } from '../../domain/imageConversion'
import type { Pattern } from '../../domain/pattern'
import { importPatterns, parsePatternsFile } from '../../domain/patternFile'
import { parsePatternFromQrImage } from '../../domain/qrExport'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'

const props = withDefaults(
  defineProps<{
    /** Every Pattern saved on this device, for spotting import collisions. */
    patterns: Pattern[]
    /**
     * How a picked QR-code picture is turned into pixels (ticket 68). The app shell hands over the browser's own
     * decoding, the same adapter Convert image uses (ADR 0020); a test hands over synthetic pixel data instead, since
     * jsdom decodes no image bytes.
     */
    decodeImage: DecodeImage
    /**
     * Icons only, each name kept as its tooltip and accessible name: the header's first step when it runs out of room
     * (ticket 142; `writing.md`, Fitting longer text), or the whole look inside the iPad mini tier's More menu
     * (ticket 168), where `toastResults` also applies.
     */
    compact?: boolean
    /**
     * The iPad mini tier's More menu (ticket 168; OverflowMenu card): a result doesn't fit beside the buttons in
     * there, so it's emitted as `import-result` instead of drawn inline -- the app shell turns it into a toast above
     * the bottom toolbar. The header's own instance leaves this off and keeps the inline result it always had.
     */
    toastResults?: boolean
    /** A second, simultaneously-mounted instance (the More menu's, alongside the header's own) needs its own testids. */
    testidPrefix?: string
  }>(),
  {
    compact: false,
    toastResults: false,
    testidPrefix: '',
  },
)

const emit = defineEmits<{
  /** The Patterns a file turned out to hold, ready to be saved locally, already given fresh ids where they collided. */
  import: [patterns: Pattern[]]
  /** `toastResults` only: a toast id, its text and tone, ready for the app shell's own `useToasts`. */
  'import-result': [id: string, text: string, tone: 'success' | 'danger']
}>()

const fileInputId = useId()
const qrInputId = useId()

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
    if (props.toastResults) emit('import-result', 'import-file', `${t.value.transfer.importedLabel}: ${added.length}`, 'success')
  } catch {
    importFailed.value = true
    if (props.toastResults) emit('import-result', 'import-file', t.value.transfer.importErrorLabel, 'danger')
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
    const pixels = await props.decodeImage(file)
    const [added] = importPatterns([parsePatternFromQrImage(pixels)], props.patterns)
    qrImportedCount.value = 1
    emit('import', [added!])
    if (props.toastResults) emit('import-result', 'import-qr', t.value.transfer.qrImportedLabel, 'success')
  } catch {
    qrImportFailed.value = true
    if (props.toastResults) emit('import-result', 'import-qr', t.value.transfer.qrImportErrorLabel, 'danger')
  } finally {
    // Clear the input so re-picking the same file still counts as a change.
    input.value = ''
  }
}
</script>

<template>
  <!--
    Both Import controls and their outcome (tickets 117, 142, 169): from a Pattern file, and from a QR-code picture.
    Each is a text button (Button card) that is a label around a visually hidden file input, so the browser's own
    file picker opens from it, and keyboard focus on the input shows on the label. Icon-only (`compact`) wraps the
    same label in the design system's own Tooltip instead of a native `title`, so its background matches every other
    icon control's. A fragment, so the controls and their one-line result sit in the header's own row.
  -->
  <AppTooltip v-if="compact" :text="t.transfer.importLabel" :announce="false">
    <label class="pattern-import__button pattern-import__button--compact" :for="fileInputId">
      <input
        :id="fileInputId"
        type="file"
        class="pattern-import__input"
        accept="application/json,.json"
        :data-testid="`${testidPrefix}import-file`"
        :aria-label="t.transfer.importLabel"
        @change="onImportFile"
      />
      <AppIcon name="import" :size="15" />
    </label>
  </AppTooltip>
  <label v-else class="pattern-import__button" :for="fileInputId">
    <input
      :id="fileInputId"
      type="file"
      class="pattern-import__input"
      accept="application/json,.json"
      :data-testid="`${testidPrefix}import-file`"
      @change="onImportFile"
    />
    <AppIcon name="import" :size="15" />
    <span>{{ t.transfer.importLabel }}</span>
  </label>

  <AppTooltip v-if="compact" :text="t.transfer.importQrLabel" :announce="false">
    <label class="pattern-import__button pattern-import__button--compact" :for="qrInputId">
      <input
        :id="qrInputId"
        type="file"
        class="pattern-import__input"
        accept="image/*"
        :data-testid="`${testidPrefix}import-qr`"
        :aria-label="t.transfer.importQrLabel"
        @change="onImportQrImage"
      />
      <AppIcon name="scan" :size="15" />
    </label>
  </AppTooltip>
  <label v-else class="pattern-import__button" :for="qrInputId">
    <input
      :id="qrInputId"
      type="file"
      class="pattern-import__input"
      accept="image/*"
      :data-testid="`${testidPrefix}import-qr`"
      @change="onImportQrImage"
    />
    <AppIcon name="scan" :size="15" />
    <span>{{ t.transfer.importQrLabel }}</span>
  </label>

  <!--
    One line beside the buttons, no shadow and no close (ImportResult card); role="status" / "alert" so it is
    announced as it appears, since the file picker has already closed by then. The iPad mini tier's More menu
    (`toastResults`) emits the same words as a toast instead (ticket 168): there is no room beside these buttons in
    a menu, and results arrive above the bottom toolbar there.
  -->
  <p v-if="!toastResults && importedCount !== null" class="pattern-import__result" role="status" data-testid="import-result">
    {{ t.transfer.importedLabel }}: {{ importedCount }}
  </p>
  <p v-if="!toastResults && importFailed" class="pattern-import__error" role="alert" data-testid="import-error">
    <AppIcon name="warning" :size="16" />{{ t.transfer.importErrorLabel }}
  </p>

  <p v-if="!toastResults && qrImportedCount !== null" class="pattern-import__result" role="status" data-testid="qr-import-result">
    {{ t.transfer.qrImportedLabel }}
  </p>
  <p v-if="!toastResults && qrImportFailed" class="pattern-import__error" role="alert" data-testid="qr-import-error">
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
