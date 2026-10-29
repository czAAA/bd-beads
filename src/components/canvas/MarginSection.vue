<script setup lang="ts">
import { useMarginSwatches } from '../../composables/canvas/useMarginSwatches'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import PanelSection from '../shell/PanelSection.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import MarginColorPicker from './MarginColorPicker.vue'

// The Frame panel's last section, margin (tickets 0656, 0657; MarginSheet and Frame cards): the margin color, the Switch
// that shows or hides the sheet's title block, and the line on what the margin is. High contrast keeps the sheet white.
const props = defineProps<{
  /** The Project whose Canvas's Background the margin's Auto follows (ticket 0666). */
  project: Project
}>()
const { t } = useI18n()
const picker = useMarginSwatches(() => props.project)
const margin = useCanvasBackground(() => props.project).margin
</script>

<template>
  <PanelSection id="frame:margin" :label="t.frame.margin.heading" :summary="picker.offered.value ? picker.summary.value : undefined" data-testid="margin-section">
    <div class="margin-section">
      <MarginColorPicker :project="project" />
      <div class="margin-section__switch">
        <span class="margin-section__switch-label">{{ t.frame.margin.titleBlock }}</span>
        <AppSwitch :model-value="margin.titleBlock.value" :label="t.frame.margin.titleBlock" data-testid="margin-title-block-switch" @update:model-value="margin.setTitleBlock" />
      </div>
      <p class="margin-section__line" data-testid="margin-line">{{ t.frame.margin.line }}</p>
    </div>
  </PanelSection>
</template>

<style scoped>
.margin-section {
  --swatch-gap: var(--overlay-fill);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10) var(--space-8);
}

.margin-section__switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

.margin-section__switch-label {
  font: var(--type-control);
  color: var(--ink);
}

.margin-section__line {
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
