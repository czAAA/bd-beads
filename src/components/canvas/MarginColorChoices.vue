<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import type { FrameId } from '../../domain/grid'
import type { Background, Project } from '../../domain/project'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import BackgroundSection from '../project/BackgroundSection.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import MarginColorPicker from './MarginColorPicker.vue'

// What Margin color offers (MarginSheet card, tickets 0657, 1222, 1260): the margin color's picker, the Frame's
// Background and the switch that shows or hides the name and size. In its popover and unfolded in the expanded rail.
const props = defineProps<{
  /** The Project whose Canvas's Background the margin's Auto follows (ticket 0666). */
  project: Project
  /** The Frame whose sheet it is: its Background is the second row. */
  frame: FrameId
  /** In the expanded sheet's rail: labels in the rail's style, without the line saying what the margin is. */
  rail?: boolean
}>()
const emit = defineEmits<{ 'set-background': [background: Background] }>()
const backgrounds = useCanvasBackground(() => props.project)
const margin = backgrounds.margin

const { t } = useI18n()
</script>

<template>
  <div class="margin-color" :class="{ 'margin-color--rail': rail }">
    <span class="margin-color__label">{{ t.frame.margin.colorLabel }}</span>
    <MarginColorPicker :project="project" />
    <span class="margin-color__label">{{ t.layerSettings.background }}</span>
    <BackgroundSection :background="backgrounds.shownOf(frame).background" :layer="frame" @pick="emit('set-background', $event)" />
    <div class="margin-color__switch">
      <span class="margin-color__switch-label">{{ t.frame.margin.titleBlock }}</span>
      <AppSwitch :model-value="margin.titleBlock.value" :label="t.frame.margin.titleBlock" data-testid="margin-title-block-switch" @update:model-value="margin.setTitleBlock" />
    </div>
    <p v-if="!rail" class="margin-color__line" data-testid="margin-line">{{ t.frame.margin.line }}</p>
  </div>
</template>

<style scoped>
.margin-color {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.margin-color__line {
  max-width: 18rem;
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.margin-color__switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding-top: var(--space-4);
}

.margin-color__switch-label {
  font: var(--type-control);
  color: var(--ink);
}

.margin-color__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.margin-color--rail .margin-color__label {
  font: var(--type-small);
  text-transform: none;
}
</style>
