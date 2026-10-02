<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
import { useI18n } from '../../i18n/useI18n'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'
import { HILLS } from './exampleArt'

/** Row progress (ticket 218): five rows done and faded, the sixth marked as the current one, and the mini Progress bar that moves it. */
const { t } = useI18n()
const ROW_PROGRESS = { enabled: true, direction: 'rows', currentRow: 5, currentColumn: 0 } as const
</script>

<template>
  <ExampleFrame>
    <div class="progress">
      <BeadPicture :grid="HILLS" :zoom="0.65" :row-progress="ROW_PROGRESS" />
      <div class="progress__bar">
        <span class="progress__switch"><i /></span>
        <b class="progress__row">{{ t.overview.examples.row }}</b>
        <span class="ex-label">{{ t.overview.examples.ofRows }}</span>
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

.progress__switch {
  position: relative;
  flex: none;
  width: 1.625rem;
  height: 1rem;
  background: var(--ink);
  border-radius: var(--radius-full);
}

.progress__switch i {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 0.75rem;
  height: 0.75rem;
  background: var(--canvas);
  border-radius: var(--radius-full);
}

.progress__row {
  font: var(--type-control);
  white-space: nowrap;
}

.progress__track {
  flex: 1;
  min-width: 3rem;
  height: var(--space-4);
  background: var(--line);
  border-radius: var(--radius-xs);
}

.progress__track i {
  display: block;
  width: 28%;
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius-xs);
}

.progress__done {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  height: 1.75rem;
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--on-accent);
  white-space: nowrap;
  background: var(--accent);
  border-radius: var(--radius-md);
}
</style>
