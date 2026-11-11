<script setup lang="ts">
import AppButton from '../ui/AppButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'

// The lock's one line (ticket 0848; Frame and LayerSettings cards): under a Frame's size, off while a row is marked
// done, it says so and offers Reset progress, the same action as the Progress bar's button, which asks first.
defineProps<{
  /** Its test id; its button's is this with `-reset`. */
  testid: string
}>()
const emit = defineEmits<{ 'reset-progress': [] }>()

const { t } = useI18n()
const resetAction = controlAction('reset-progress')
</script>

<template>
  <div class="marked-done-line">
    <p class="marked-done-line__text" :data-testid="testid">{{ t.frame.sizeLockedLine }}</p>
    <!-- Shown only while a row is marked done, when the action is always on. -->
    <AppButton size="sm" :action="resetAction" :disabled="false" :data-testid="`${testid}-reset`" @click="emit('reset-progress')" />
  </div>
</template>

<style scoped>
.marked-done-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4) var(--space-8);
}

.marked-done-line__text {
  flex: 1 1 auto;
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
