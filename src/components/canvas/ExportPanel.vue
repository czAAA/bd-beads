<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import ExportRows from './ExportRows.vue'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { useI18n } from '../../i18n/useI18n'
import { fillBlanks } from '../../domain/fillBlanks'
import { projectNameOf } from '../../domain/layerRecord'
import { loadPrintCode, type PrintCode } from '../../rendering/loadPrintCode'
import type { ExportChoice } from '../../composables/shell/openPanel'

// The Export panel (ticket 0652; ExportPanel card): opened by the strip's Export button. Its title line over its rows
// (ExportRows), the ones the Project panel's Export row unfolds (ticket 1058).
const props = defineProps<{
  project: Project
  /** Exports this Selection alone, from the Selection bar's Export (ticket 1210); absent, the Project's Frame. */
  selection?: Selection
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: ExportChoice
  /** The row it opens on, focused (ticket 0847): Picture, from the Progress bar's Fit a Frame and export a picture. */
  opensOn?: ExportChoice
}>()

const emit = defineEmits<{
  fit: []
  'select-frame': []
  'select-piece-frame': []
  /** `part` is a Selection's Project to export in the open one's place (ticket 1210). */
  'export-png': [part?: Project]
  'export-pdf': [typedName?: string, part?: Project]
  'save-project-file': []
  'save-maker-name': [name: string]
}>()

const { t } = useI18n()
/** The print code lays the Selection as a Project of its own (selectionPart), as the rows' estimate is worked out with it. */
const printCode = shallowRef<PrintCode>()
loadPrintCode().then(
  (code) => (printCode.value = code),
  () => undefined,
)
/** The Project the rows are about: the Selection laid as a Frame, or the open Project itself. None while a Selection's is
 * not yet worked out, which leaves the rows out. */
const shown = computed(() => (props.selection ? printCode.value?.selectionPart(props.project, props.selection, t.value.frame.partFileName) : props.project))
/** An export of the Selection hands its part on (ticket 1210); the Frame's export carries nothing more. */
const onPng = () => (props.selection ? emit('export-png', shown.value) : emit('export-png'))
const onPdf = (typedName?: string) => (props.selection ? emit('export-pdf', typedName, shown.value) : emit('export-pdf', typedName))
const title = computed(() => (props.selection ? fillBlanks(t.value.frame.exportingSelection, { columns: props.selection.columns, rows: props.selection.rows }) : undefined))
</script>

<template>
  <div class="export-panel" role="group" :aria-label="t.panels.project.exportHeading" data-testid="export-panel">
    <div class="export-panel__title">
      <span v-if="title" class="export-panel__label" data-testid="export-panel-scope">{{ title }}</span>
      <span v-else class="export-panel__label">
        <span>{{ t.panels.project.exportHeading }}</span>
        <!-- The open Project's name, where the strip shows none (under 1024px, ticket 0986). -->
        <span class="export-panel__project" data-user-text data-testid="export-panel-project">· {{ projectNameOf(project) }}</span>
      </span>
    </div>
    <ExportRows v-if="shown" :project="shown" :exporting="exporting" :opens-on="opensOn" @fit="emit('fit')" @select-frame="emit('select-frame')" @select-piece-frame="emit('select-piece-frame')" @export-png="onPng" @export-pdf="onPdf" @save-project-file="emit('save-project-file')" @save-maker-name="emit('save-maker-name', $event)" />
  </div>
</template>

<style scoped>
.export-panel {
  display: flex;
  flex-direction: column;
  color: var(--ink);
}

.export-panel__title {
  display: flex;
  align-items: center;
  min-height: var(--panel-item-height);
  padding: var(--space-4) var(--space-10) 0;
}

.export-panel__label {
  display: flex;
  gap: var(--space-4);
  min-width: 0;
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

/* The Project's name after the title where the strip hides it (ticket 0986): as typed, one line, cut by an ellipsis. */
.export-panel__project {
  display: none;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
}

@container shell (max-width: 1023px) {
  .export-panel__project {
    display: block;
  }
}
</style>
