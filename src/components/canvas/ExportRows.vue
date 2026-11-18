<script setup lang="ts">
import { computed } from 'vue'
import ExportSection from './ExportSection.vue'
import PanelItem from '../shell/PanelItem.vue'
import { fitToDrawing } from '../../domain/frame'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { frameOf } from '../../domain/layerRecord'
import type { ExportChoice } from '../../composables/shell/openPanel'

// What the Export panel holds (ticket 0652; ExportPanel card), also unfolded under the Project panel's Export row (ticket
// 1058): with a Frame, the export rows (ExportSection); with none, the line and the ways to set one: Fit a Frame to the
// drawing (first once something is drawn) and Drag a Frame.
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
  <ExportSection v-if="frameOf(project)" :project="project" :exporting="exporting" :opens-on="opensOn" @export-png="emit('export-png')" @export-pdf="emit('export-pdf')" />
  <template v-else>
    <p class="export-rows__line" data-testid="export-needs-frame">{{ t.frame.exportNeedsFrame }}</p>
    <!-- The one-tap way first once something is drawn (ticket 0944); `frame`, as `fit` is the zoom's. -->
    <PanelItem v-if="!nothingToFit" icon="frame" stays data-testid="export-fit" @select="emit('fit')">{{ t.frame.fitAFrame }}</PanelItem>
    <PanelItem icon="select" data-testid="export-select-frame" @select="emit('select-frame')">{{ t.frame.selectAFrame }}</PanelItem>
    <PanelItem v-if="nothingToFit" icon="frame" stays disabled :name="t.frame.fitAFrame" :disabled-body="t.frame.fitNothing" data-testid="export-fit">{{ t.frame.fitAFrame }}</PanelItem>
  </template>
</template>

<style scoped>
.export-rows__line {
  margin: 0;
  padding: var(--space-4) var(--space-10);
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
