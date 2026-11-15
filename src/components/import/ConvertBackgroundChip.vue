<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'

// The chip over the beads while the background is found and not yet removed, with the Background popover closed
// (ConvertImage card, ticket 0930): the hatch, what was found in the popover's words, its Remove what was found and a
// Turn off that is the switch's. The hatched beads are never a state with no name and no way out in view.
const { t } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const textId = useId()
const percent = computed(() => wizard.backgroundFound.value?.percent ?? 0)
</script>

<template>
  <div class="convert-background-chip" role="group" :aria-labelledby="textId" data-testid="convert-background-chip">
    <span class="convert-background-chip__hatch" aria-hidden="true" />
    <span :id="textId" class="convert-background-chip__text">{{ fillBlanks(words.backgroundChip, { n: percent }) }}</span>
    <span class="convert-background-chip__actions">
      <AppButton size="sm" class="convert-background-chip__button" data-testid="convert-background-chip-remove" @click="wizard.removeFound">{{ words.removeFound }}</AppButton>
      <AppButton size="sm" variant="text" class="convert-background-chip__button" data-testid="convert-background-chip-off" @click="wizard.setRemoveBackground(false)">{{ words.backgroundTurnOff }}</AppButton>
    </span>
  </div>
</template>

<style scoped>
/* In the kept chip's look (a `canvas` chip with a 1px edge), its buttons as Keep all's; it may wrap on a phone. */
.convert-background-chip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-4) var(--space-8);
  box-sizing: border-box;
  max-width: 100%;
  min-height: var(--convert-kept-chip-height);
  padding: var(--space-4) var(--space-4) var(--space-4) var(--space-12);
  font: var(--type-meta);
  color: var(--ink);
  pointer-events: auto;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
}

:root[data-theme='dark'] .convert-background-chip {
  border-color: var(--line-strong);
  box-shadow: none;
}

@media (pointer: coarse) {
  .convert-background-chip {
    min-height: var(--convert-kept-chip-height-touch);
  }
}

.convert-background-chip__hatch {
  flex: none;
  box-sizing: border-box;
  width: var(--space-16);
  height: var(--space-16);
  background: var(--found-hatch);
  border: 1px solid var(--marker);
  border-radius: var(--radius-xs);
}

.convert-background-chip__text {
  min-width: 0;
}

.convert-background-chip__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.convert-background-chip__button {
  height: var(--convert-keep-all-height);
  min-height: 0;
  font: var(--type-tab);
  border-radius: var(--radius-full);
}
</style>
