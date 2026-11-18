<script setup lang="ts">
import ExportRows from './ExportRows.vue'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { projectNameOf } from '../../domain/layerRecord'
import type { ExportChoice } from '../../composables/shell/openPanel'

// The Export panel (ticket 0652; ExportPanel card): opened by the strip's Export button. Its title line over its rows
// (ExportRows), the ones the Project panel's Export row unfolds (ticket 1058).
defineProps<{
  project: Project
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: ExportChoice
  /** The row it opens on, focused (ticket 0847): Picture, from the Progress bar's Fit a Frame and export a picture. */
  opensOn?: ExportChoice
}>()

const emit = defineEmits<{
  fit: []
  'select-frame': []
  'export-png': []
  'export-pdf': []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="export-panel" role="group" :aria-label="t.panels.project.exportHeading" data-testid="export-panel">
    <div class="export-panel__title">
      <span class="export-panel__label">
        <span>{{ t.panels.project.exportHeading }}</span>
        <!-- The open Project's name, where the strip shows none (under 1024px, ticket 0986). -->
        <span class="export-panel__project" data-user-text data-testid="export-panel-project">· {{ projectNameOf(project) }}</span>
      </span>
    </div>
    <ExportRows :project="project" :exporting="exporting" :opens-on="opensOn" @fit="emit('fit')" @select-frame="emit('select-frame')" @export-png="emit('export-png')" @export-pdf="emit('export-pdf')" />
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
