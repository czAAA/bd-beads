<script setup lang="ts">
import { computed, useId } from 'vue'
import type { FrameSheet } from '../../domain/canvas'
import { FRINGE_STYLES, fringeStyleOf, settingValuesOf, type FrameSettings, type FringeStyle } from '../../domain/frameShape'
import { useI18n } from '../../i18n/useI18n'
import MarkedDoneLine from '../project/MarkedDoneLine.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

// A Custom frame's own settings, in its settings popover where Width and Height would be (tickets 0592, 0593, 0597, 0670,
// 1222; MarginSheet card): a stepper for each size setting and a Fringe earring's Fringe style. Growing adds empty rounds,
// rows or beads outside, shrinking folds what it leaves out (ticket 0640). It only asks.
const props = defineProps<{
  frame: Pick<FrameSheet, 'shape' | 'settings'>
  /** A Row progress pass is done: they wait. */
  locked?: boolean
}>()
const emit = defineEmits<{
  'set-settings': [change: FrameSettings]
  /** Reset progress, from the line under the settings rows marked done hold (ticket 0848); the caller asks. */
  'reset-progress': []
}>()

const { t } = useI18n()
const fringeLabelId = useId()

/** The settings, each its value, its range now and its words. */
const shapeSettings = computed(() => settingValuesOf(props.frame).map((setting) => ({ ...setting, words: t.value.frame.sizeSettings[setting.name] })))
/** A Fringe earring's Fringe style, the setup's names (ticket 0597); none for any other Frame. */
const fringeStyle = computed(() => fringeStyleOf(props.frame))
const fringeOptions = computed(() => FRINGE_STYLES.map((value) => ({ value, label: t.value.starters.picks.fringeStyle.options[value] })))
</script>

<template>
  <div class="frame-shape">
    <div v-for="setting in shapeSettings" :key="setting.name" class="frame-shape__row" :data-testid="`frame-setting-${setting.name}`">
      <span class="frame-shape__label">{{ setting.words.label }}</span>
      <AppStepper
        :model-value="setting.value"
        :min="setting.min"
        :max="setting.max"
        :decrease-label="setting.words.less"
        :increase-label="setting.words.more"
        :value-label="setting.words.label"
        :disabled="locked"
        tooltip
        :disabled-body="t.tooltips.frameSizeLocked"
        :decrease-testid="`frame-setting-${setting.name}-less`"
        :increase-testid="`frame-setting-${setting.name}-more`"
        :value-testid="`frame-setting-${setting.name}-value`"
        @update:model-value="emit('set-settings', { [setting.name]: $event })"
      />
    </div>
    <div v-if="fringeStyle" class="frame-shape__style">
      <span :id="fringeLabelId" class="frame-shape__label">{{ t.frame.fringeStyle.label }}</span>
      <SegmentedControl
        :model-value="fringeStyle"
        :options="fringeOptions"
        :labelledby="fringeLabelId"
        :disabled="locked"
        data-testid="frame-fringe-style"
        @update:model-value="emit('set-settings', { fringeStyle: $event as FringeStyle })"
      />
    </div>
    <MarkedDoneLine v-if="locked" testid="frame-size-locked" @reset-progress="emit('reset-progress')" />
  </div>
</template>

<style scoped>
.frame-shape {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.frame-shape__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

.frame-shape__style {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.frame-shape__label {
  font: var(--type-control);
  color: var(--ink);
}
</style>
