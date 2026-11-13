<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useI18n } from '../../i18n/useI18n'
import AppSwitch from '../ui/AppSwitch.vue'

// Auto-fix lighting's row (ConvertImage card DS-3, ticket 0907): under the picture row, as it changes the picture before
// it becomes beads. Its name in `control` takes the room and wraps; the switch beside it. Ticket 0908's sun button,
// More for the lighting, goes at the right end.
const { t } = useI18n()
const { lighting } = useConvertImageWizardState()
const nameId = useId()
const on = computed({ get: () => lighting.on.value, set: (next: boolean) => lighting.setOn(next) })
</script>

<template>
  <div class="convert-lighting" data-testid="convert-lighting">
    <span :id="nameId" class="convert-lighting__name">{{ t.convertImage.wizard.autoFixLighting }}</span>
    <AppSwitch v-model="on" :label="t.convertImage.wizard.autoFixLighting" :aria-labelledby="nameId" data-testid="convert-lighting-switch" />
  </div>
</template>

<style scoped>
/* 10 under the picture row: the section's 8 and 2 (DS-3). */
.convert-lighting {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  min-height: var(--control-height);
  margin-top: var(--space-2);
}

.convert-lighting__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  font: var(--type-control);
  color: var(--ink);
}
</style>
