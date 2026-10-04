<script setup lang="ts">
import { projectDimensions } from '../../domain/project'
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { rotationSwapsAxes } from '../../domain/grid'
import { maxAxisCount, type MirrorAxisCounts } from '../../domain/mirror'
import type { Project } from '../../domain/project'
import AppButton from '../ui/AppButton.vue'
import IconButton from '../ui/IconButton.vue'

/**
 * The Mirror group's controls (MirrorSizeControls card; ticket 79), pulled out of Toolbox.vue so both it (inside a
 * DisclosureRow) and the phone tier's Mirror ToolSheet can use the same markup and axis-vs-rotation math, rather than
 * two copies drifting apart.
 */
const props = defineProps<{
  project: Project
  mirrorAxisCounts: MirrorAxisCounts
  /** Mirror's copy-mode switch (ticket 45). */
  mirrorCopyMode: boolean
}>()

const emit = defineEmits<{
  'set-mirror-axis-count': [axis: 'columns' | 'rows', count: number]
  'toggle-mirror-copy-mode': []
  'mirror-current': [axis: 'horizontal' | 'vertical']
  'mirror-current-hover': [axis: 'horizontal' | 'vertical' | null]
}>()

const { t } = useI18n()

/**
 * Which grid-space axis ('columns'/'rows') the on-screen Left–right and Top–bottom counters each drive, given the
 * Project's current view-only rotation (see Project.rotation, kept for Projects saved turned): a quarter turn either way
 * swaps the two (180° leaves them as they are), never a transform of the counts or grid data themselves.
 */
const swapped = computed(() => rotationSwapsAxes(props.project.rotation))
const leftRightAxis = computed<'columns' | 'rows'>(() => (swapped.value ? 'rows' : 'columns'))
const topBottomAxis = computed<'columns' | 'rows'>(() => (swapped.value ? 'columns' : 'rows'))

const leftRightCount = computed(() => props.mirrorAxisCounts[leftRightAxis.value])
const topBottomCount = computed(() => props.mirrorAxisCounts[topBottomAxis.value])

const leftRightMax = computed(() => maxAxisCount(swapped.value ? projectDimensions(props.project).rows : projectDimensions(props.project).columns))
const topBottomMax = computed(() => maxAxisCount(swapped.value ? projectDimensions(props.project).columns : projectDimensions(props.project).rows))
</script>

<template>
  <p class="mirror-controls__line mirror-axis-counter" data-testid="mirror-left-right">
    <span class="mirror-controls__line-label" data-testid="mirror-left-right-value">
      {{ t.mirror.leftRightLabel }}: {{ leftRightCount }}
    </span>
    <AppButton
      variant="toolbox"
      size="sm"
      data-testid="mirror-left-right-decrease"
      :title="`${t.mirror.decreaseLeftRightButton} (-)`"
      :aria-label="t.mirror.decreaseLeftRightButton"
      :disabled="leftRightCount === 0"
      @click="emit('set-mirror-axis-count', leftRightAxis, leftRightCount - 1)"
    >
      −
    </AppButton>
    <AppButton
      variant="toolbox"
      size="sm"
      data-testid="mirror-left-right-increase"
      :title="`${t.mirror.increaseLeftRightButton} (=)`"
      :aria-label="t.mirror.increaseLeftRightButton"
      :disabled="leftRightCount === leftRightMax"
      @click="emit('set-mirror-axis-count', leftRightAxis, leftRightCount + 1)"
    >
      +
    </AppButton>
  </p>
  <p class="mirror-controls__line mirror-axis-counter" data-testid="mirror-top-bottom">
    <span class="mirror-controls__line-label" data-testid="mirror-top-bottom-value">
      {{ t.mirror.topBottomLabel }}: {{ topBottomCount }}
    </span>
    <AppButton
      variant="toolbox"
      size="sm"
      data-testid="mirror-top-bottom-decrease"
      :title="`${t.mirror.decreaseTopBottomButton} ([)`"
      :aria-label="t.mirror.decreaseTopBottomButton"
      :disabled="topBottomCount === 0"
      @click="emit('set-mirror-axis-count', topBottomAxis, topBottomCount - 1)"
    >
      −
    </AppButton>
    <AppButton
      variant="toolbox"
      size="sm"
      data-testid="mirror-top-bottom-increase"
      :title="`${t.mirror.increaseTopBottomButton} (])`"
      :aria-label="t.mirror.increaseTopBottomButton"
      :disabled="topBottomCount === topBottomMax"
      @click="emit('set-mirror-axis-count', topBottomAxis, topBottomCount + 1)"
    >
      +
    </AppButton>
  </p>
  <p class="mirror-controls__line">
    <span class="mirror-controls__line-label">{{ t.mirror.copyModeLabel }}</span>
    <IconButton
      icon="mirror-copy-mode"
      variant="toolbox"
      :label="t.mirror.copyModeLabel"
      :title="`${t.mirror.copyModeLabel} (M)`"
      :selected="mirrorCopyMode"
      data-testid="mirror-copy-mode"
      @click="emit('toggle-mirror-copy-mode')"
    />
  </p>
  <p class="mirror-controls__line">
    <span class="mirror-controls__line-label">{{ t.mirror.mirrorCurrentLabel }}</span>
    <IconButton
      icon="mirror-horizontal"
      variant="toolbox"
      :label="t.mirror.mirrorCurrentHorizontalButton"
      :title="`${t.mirror.mirrorCurrentHorizontalButton} (H)`"
      data-testid="mirror-current-horizontal"
      @click="emit('mirror-current', 'horizontal')"
      @mouseenter="emit('mirror-current-hover', 'horizontal')"
      @mouseleave="emit('mirror-current-hover', null)"
    />
    <IconButton
      icon="mirror-vertical"
      variant="toolbox"
      :label="t.mirror.mirrorCurrentVerticalButton"
      :title="`${t.mirror.mirrorCurrentVerticalButton} (V)`"
      data-testid="mirror-current-vertical"
      @click="emit('mirror-current', 'vertical')"
      @mouseenter="emit('mirror-current-hover', 'vertical')"
      @mouseleave="emit('mirror-current-hover', null)"
    />
  </p>
</template>

<style scoped>
/* One control per line: its name, then its controls at the right (same layout Toolbox's disclosure rows use). */
.mirror-controls__line {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  margin: 0;
}

.mirror-controls__line-label {
  margin-right: auto;
  font: var(--type-body);
  color: var(--body);
}
</style>
