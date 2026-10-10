<script setup lang="ts">
import { ref, useId } from 'vue'
import type { Project } from '../../domain/project'
import { importProjects, parseProjectsFile } from '../../domain/projectFile'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'

const props = withDefaults(
  defineProps<{
    /** Every Project saved on this device, for spotting import collisions. */
    projects: Project[]
    /**
     * Icons only, each name kept as its tooltip and accessible name: the header's first step when it runs out of room
     * (ticket 142; `writing.md`, Fitting longer text), or the whole look inside the iPad mini tier's More menu
     * (ticket 168), where `toastResults` also applies.
     */
    compact?: boolean
    /**
     * The iPad mini tier's More menu (ticket 168; OverflowMenu card): a result doesn't fit beside the button in
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
  /** The Projects a file turned out to hold, ready to be saved locally, already given fresh ids where they collided. */
  import: [projects: Project[]]
  /** `toastResults` only: a toast id, its text and tone, ready for the app shell's own `useToasts`. */
  'import-result': [id: string, text: string, tone: 'success' | 'danger']
}>()

const fileInputId = useId()

const { t } = useI18n()
const importFile = controlAction('import-file')

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
    const contents = parseProjectsFile(await file.text())
    const added = importProjects(contents.projects, props.projects)
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

</script>

<template>
  <!--
    The Import control and its outcome (tickets 117, 142, 169): from a Project file. It is a text button (Button card) that is a label around a visually hidden file input, so the browser's own
    file picker opens from it, and keyboard focus on the input shows on the label. Icon-only (`compact`) wraps the
    same label in the design system's own Tooltip instead of a native `title`, so its background matches every other
    icon control's. A fragment, so the control and its one-line result sit in the header's own row.
  -->
  <AppTooltip v-if="compact" :name="importFile.name(t)" :body="importFile.body?.(t)" :announce="false">
    <label class="project-import__button project-import__button--compact" :for="fileInputId">
      <input
        :id="fileInputId"
        type="file"
        class="project-import__input"
        accept="application/json,.json"
        :data-testid="`${testidPrefix}import-file`"
        :aria-label="t.transfer.importLabel"
        @change="onImportFile"
      />
      <AppIcon name="import" :size="15" />
    </label>
  </AppTooltip>
  <AppTooltip v-else :name="importFile.name(t)" :body="importFile.body?.(t)" :announce="false">
    <label class="project-import__button" :for="fileInputId">
      <input
        :id="fileInputId"
        type="file"
        class="project-import__input"
        accept="application/json,.json"
        :data-testid="`${testidPrefix}import-file`"
        @change="onImportFile"
      />
      <AppIcon name="import" :size="15" />
      <span>{{ t.transfer.importLabel }}</span>
    </label>
  </AppTooltip>

  <!--
    One line beside the buttons, no shadow and no close (ImportResult card); role="status" / "alert" so it is
    announced as it appears, since the file picker has already closed by then. The iPad mini tier's More menu
    (`toastResults`) emits the same words as a toast instead (ticket 168): there is no room beside these buttons in
    a menu, and results arrive above the bottom toolbar there.
  -->
  <p v-if="!toastResults && importedCount !== null" class="project-import__result" role="status" data-testid="import-result">
    {{ t.transfer.importedLabel }}: {{ importedCount }}
  </p>
  <p v-if="!toastResults && importFailed" class="project-import__error" role="alert" data-testid="import-error">
    <AppIcon name="warning" :size="16" />{{ t.transfer.importErrorLabel }}
  </p>
</template>

<style scoped>
/* A text button (Button card) on a label: no fill or border, padding 0 6, hover fill with a fine pointer. */
.project-import__button {
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

.project-import__button--compact {
  justify-content: center;
  width: var(--control-height);
  padding: 0;
}

@media (hover: hover) {
  .project-import__button:hover {
    background: var(--hover-fill);
  }
}

.project-import__button:active {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

/* Visually hidden, not display: none, so it stays focusable and reachable by keyboard and screen reader. */
.project-import__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.project-import__button:has(:focus-visible) {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.project-import__result,
.project-import__error {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-6);
  margin: 0;
  font: var(--type-body);
  color: var(--body);
  white-space: nowrap;
}

.project-import__error {
  color: var(--danger);
}

@media (prefers-reduced-motion: reduce) {
  .project-import__button:active {
    transform: none;
  }
}
</style>
