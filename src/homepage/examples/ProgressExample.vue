<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
import AppSwitch from '../../components/ui/AppSwitch.vue'
import { useI18n } from '../../i18n/useI18n'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'
import { HILLS } from './exampleArt'

/** Row progress (ticket 218): five rows done and faded, the sixth marked as the current one, and the mini Progress bar that moves it. */
const { t } = useI18n()
const ROW_PROGRESS = { direction: 'rows', currentRow: 5, currentColumn: 0 } as const
</script>

<template>
  <ExampleFrame>
    <div class="progress">
      <BeadPicture :grid="HILLS" :zoom="0.65" :row-progress="ROW_PROGRESS" />
      <div class="progress__bar">
        <AppSwitch class="progress__switch" :model-value="true" :label="t.rowProgress.highlightButton" tabindex="-1" data-testid="example-row-highlight" />
        <b class="progress__row">{{ t.homepage.examples.row }}</b>
        <span class="ex-label">{{ t.homepage.examples.ofRows }}</span>
        <span class="progress__track"><i /></span>
        <span class="progress__done"><AppIcon name="check" :size="14" />{{ t.rowProgress.nextButton }}</span>
      </div>
    </div>
  </ExampleFrame>
</template>

<style scoped>
.progress {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-12);
}

.progress > :first-child {
  align-self: center;
}

.progress__bar {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  padding: var(--space-6) var(--space-8) var(--space-6) var(--space-12);
  font: var(--type-body);
  color: var(--ink);
  background: var(--canvas);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}
</style>
