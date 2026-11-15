<script setup lang="ts">
import { computed } from 'vue'
import ExportSection from './ExportSection.vue'
import PanelItem from '../shell/PanelItem.vue'
import { fitToDrawing } from '../../domain/frame'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { frameOf, projectNameOf } from '../../domain/layerRecord'
import type { ExportChoice } from '../../composables/shell/openPanel'

// The Export panel (ticket 0652; ExportPanel card): opened by the strip's Export button. With a Frame, the Frame panel's
// export rows (ExportSection); with none, the ways to set one: Fit a Frame to the drawing (first once something is drawn) and Drag a Frame.
const props = defineProps<{
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
/** Fit a Frame to the drawing needs something drawn. */
const nothingToFit = computed(() => fitToDrawing(props.project) === undefined)
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
    <ExportSection v-if="frameOf(project)" :project="project" :exporting="exporting" :opens-on="opensOn" @export-png="emit('export-png')" @export-pdf="emit('export-pdf')" />
    <template v-else>
      <p class="export-panel__line" data-testid="export-needs-frame">{{ t.frame.exportNeedsFrame }}</p>
      <!-- The one-tap way first once something is drawn (ticket 0944); `frame`, as `fit` is the zoom's. -->
      <PanelItem v-if="!nothingToFit" icon="frame" stays data-testid="export-fit" @select="emit('fit')">{{ t.frame.fitAFrame }}</PanelItem>
      <PanelItem icon="select" data-testid="export-select-frame" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
      <PanelItem v-if="nothingToFit" icon="frame" stays disabled :name="t.frame.fitAFrame" :disabled-body="t.frame.fitNothing" data-testid="export-fit">{{ t.frame.fitAFrame }}</PanelItem>
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

.export-panel__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
