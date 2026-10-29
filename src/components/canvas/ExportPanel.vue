<script setup lang="ts">
import { computed } from 'vue'
import ExportSection from './ExportSection.vue'
import PanelItem from '../shell/PanelItem.vue'
import { fitToDrawing } from '../../domain/frame'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { frameOf } from '../../domain/layerRecord'

// The Export panel (ticket 0652; ExportPanel card): opened by the strip's Export button. With a Frame, the Frame panel's
// export rows (ExportSection); with none, the way to set one: Select a frame and Fit a frame to the drawing.
const props = defineProps<{
  project: Project
  /** A PNG or PDF is being drawn: those two wait, so a second press doesn't start a second one. */
  exporting?: 'png' | 'pdf'
}>()

const emit = defineEmits<{
  fit: []
  'select-frame': []
  'export-png': []
  'export-pdf': []
}>()

const { t } = useI18n()
/** Fit a frame to the drawing needs something drawn. */
const nothingToFit = computed(() => fitToDrawing(props.project) === undefined)
</script>

<template>
  <div class="export-panel" role="group" :aria-label="t.panels.project.exportHeading" data-testid="export-panel">
    <div class="export-panel__title">
      <span class="export-panel__label">{{ t.panels.project.exportHeading }}:</span>
    </div>
    <ExportSection v-if="frameOf(project)" :project="project" :exporting="exporting" @export-png="emit('export-png')" @export-pdf="emit('export-pdf')" />
    <template v-else>
      <p class="export-panel__line" data-testid="export-needs-frame">{{ t.frame.exportNeedsFrame }}</p>
      <PanelItem icon="select" data-testid="export-select-frame" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
      <PanelItem icon="fit" stays :disabled="nothingToFit" :name="t.frame.fitAFrame" :disabled-body="t.frame.fitNothing" data-testid="export-fit" @select="emit('fit')">{{ t.frame.fitAFrame }}</PanelItem>
    </template>
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
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.export-panel__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
